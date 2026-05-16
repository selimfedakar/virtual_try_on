import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const maxDuration = 30;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const res = await fetch(`https://api.fashn.ai/v1/status/${id}`, {
      headers: { 'Authorization': `Bearer ${process.env.FASHN_API_KEY}` },
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Failed to check status' }, { status: 500 });
    }

    const data = await res.json();
    console.log('[Fashn.ai] Status response:', JSON.stringify(data));

    const statusMap: Record<string, string> = {
      starting: 'starting',
      in_queue: 'starting',
      processing: 'processing',
      completed: 'succeeded',
      failed: 'failed',
      error: 'failed',
    };

    const fashnImageUrl: string | null =
      data.outputs?.[0] ??
      data.output?.[0] ??
      data.outputs?.result ??
      null;

    // When Fashn.ai is done, guarantee the result is persisted before returning.
    // We atomically claim the pending_generations row (delete + returning).
    // - If we claim it: webhook hasn't processed this yet — we do it ourselves.
    // - If it's already gone: webhook already ran — fetch the stored URL.
    if (data.status === 'completed' && fashnImageUrl) {
      const serviceClient = createServiceClient();

      // Atomic claim: only one of (polling, webhook) will get this row
      const { data: claimed } = await serviceClient
        .from('pending_generations')
        .delete()
        .eq('prediction_id', id)
        .select('user_id')
        .single();

      if (claimed) {
        // We won the race — process and persist
        try {
          const storageUrl = await uploadImageFromUrl(serviceClient, fashnImageUrl, claimed.user_id);

          await serviceClient.from('generations').insert({
            user_id: claimed.user_id,
            base_image_url: 'saved_on_device',
            garment_image_url: 'data_uri_omitted',
            garment_title: 'Mobile Upload',
            generated_image_url: storageUrl,
          });

          // Broadcast in case Realtime subscription is still alive
          await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
              },
              body: JSON.stringify({
                messages: [{
                  topic: `realtime:generation:${claimed.user_id}`,
                  event: 'completed',
                  payload: { predictionId: id, imageUrl: storageUrl },
                }],
              }),
            },
          );

          return NextResponse.json({
            success: true,
            status: 'succeeded',
            data: { generatedImage: storageUrl },
          });
        } catch (err) {
          console.error('[Polling] Failed to process result:', err);
          // Fall through — return Fashn.ai URL as last resort
        }
      } else {
        // Webhook already claimed and processed this prediction.
        // Return the permanent Supabase Storage URL from the generations table.
        const { data: gen } = await serviceClient
          .from('generations')
          .select('generated_image_url')
          .eq('user_id', user.id)
          .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (gen?.generated_image_url) {
          return NextResponse.json({
            success: true,
            status: 'succeeded',
            data: { generatedImage: gen.generated_image_url },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: statusMap[data.status] ?? data.status,
      data: { generatedImage: fashnImageUrl },
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to check prediction status.' },
      { status: 500 },
    );
  }
}

async function uploadImageFromUrl(supabase: any, imageUrl: string, userId: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('Failed to download generated image');

  const buffer = await response.arrayBuffer();
  const path = `${userId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from('try-ons')
    .upload(path, new Uint8Array(buffer), { contentType: 'image/jpeg' });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from('try-ons').getPublicUrl(path);
  return data.publicUrl;
}
