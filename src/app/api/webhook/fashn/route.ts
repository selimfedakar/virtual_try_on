import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST(req: Request) {
  try {
    // Fashn.ai doesn't sign webhooks — secret passed as query param in the webhook URL
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    if (process.env.FASHN_WEBHOOK_SECRET && secret !== process.env.FASHN_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id: predictionId, status, output } = body;

    // Only process successful completions
    if (status !== 'completed' || !output?.[0]) {
      return NextResponse.json({ received: true });
    }

    const imageUrl: string = output[0];
    const supabase = createServiceClient();

    // Find which user triggered this prediction
    const { data: pending } = await supabase
      .from('pending_generations')
      .select('user_id')
      .eq('prediction_id', predictionId)
      .single();

    if (!pending) return NextResponse.json({ received: true });

    // Upload Fashn.ai CDN image to Supabase Storage for permanent URL
    const storageUrl = await uploadImageFromUrl(supabase, imageUrl, pending.user_id);

    // Persist to generations table
    await supabase.from('generations').insert({
      user_id: pending.user_id,
      base_image_url: 'saved_on_device',
      garment_image_url: 'data_uri_omitted',
      garment_title: 'Mobile Upload',
      generated_image_url: storageUrl,
    });

    // Broadcast to mobile app via Supabase Realtime — replaces polling
    await supabase.channel(`generation:${pending.user_id}`).send({
      type: 'broadcast',
      event: 'completed',
      payload: { predictionId, imageUrl: storageUrl },
    });

    // Clean up pending row
    await supabase.from('pending_generations').delete().eq('prediction_id', predictionId);

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
