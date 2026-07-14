import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    // Fashn.ai doesn't sign webhooks — secret passed as query param in the webhook URL.
    // FAIL-CLOSED: if the secret env is unset, or doesn't match, reject.
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');
    if (!process.env.FASHN_WEBHOOK_SECRET || secret !== process.env.FASHN_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[Webhook] Fashn.ai payload:', JSON.stringify(body));
    const { id: predictionId, status } = body;

    if (!predictionId) return NextResponse.json({ received: true });

    const supabase = createServiceClient();

    // Fashn.ai may use either "output" or "outputs" field
    const imageUrl: string | undefined = body.output?.[0] ?? body.outputs?.[0];

    // ── Failure path: refund quota, notify client, clean up ──
    if (status === 'failed' || status === 'error') {
      // Atomic claim: delete-with-returning ensures a webhook retry
      // (or the polling endpoint) can't double-process this prediction.
      const { data: claimed } = await supabase
        .from('pending_generations')
        .delete()
        .eq('prediction_id', predictionId)
        .select('user_id')
        .single();

      if (claimed) {
        // Give the user their generation back — the failure was not their fault.
        const { error: refundError } = await supabase.rpc('refund_generation', {
          p_user_id: claimed.user_id,
        });
        if (refundError) console.error('[Webhook] Refund failed:', refundError.message);

        // Tell the mobile app the generation failed (same topic as success events)
        await broadcast(claimed.user_id, 'failed', {
          predictionId,
          error: body.error ?? 'Generation failed',
        });
      }

      return NextResponse.json({ received: true });
    }

    // ── Success path ──
    if (status !== 'completed' || !imageUrl) {
      return NextResponse.json({ received: true });
    }

    // Atomic claim: only one of (polling, webhook, webhook-retry) will get this row
    const { data: pending } = await supabase
      .from('pending_generations')
      .delete()
      .eq('prediction_id', predictionId)
      .select('user_id, category')
      .single();

    if (!pending) return NextResponse.json({ received: true });

    // Upload Fashn.ai CDN image to Supabase Storage for a permanent URL
    const { publicUrl, storagePath } = await uploadImageFromUrl(supabase, imageUrl, pending.user_id);

    // Persist to generations table — prediction_id + storage_path let the
    // polling endpoint find exactly this row (no "latest in 15 min" guessing).
    await supabase.from('generations').insert({
      user_id: pending.user_id,
      base_image_url: 'saved_on_device',
      garment_image_url: 'data_uri_omitted',
      garment_title: 'Mobile Upload',
      generated_image_url: publicUrl,
      prediction_id: predictionId,
      storage_path: storagePath,
      category: pending.category ?? 'tops',
    });

    // Broadcast to the mobile app via Supabase Realtime REST API
    await broadcast(pending.user_id, 'completed', { predictionId, imageUrl: publicUrl });

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Supabase Realtime REST broadcast — the JS client .send() doesn't work
// reliably in serverless without subscribe(), so we hit the REST API directly.
async function broadcast(userId: string, event: string, payload: Record<string, unknown>) {
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
          topic: `realtime:generation:${userId}`,
          event,
          payload,
        }],
      }),
    },
  );
}

async function uploadImageFromUrl(
  supabase: SupabaseClient,
  imageUrl: string,
  userId: string,
): Promise<{ publicUrl: string; storagePath: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('Failed to download generated image');

  const buffer = await response.arrayBuffer();
  const storagePath = `${userId}/${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from('try-ons')
    .upload(storagePath, new Uint8Array(buffer), { contentType: 'image/jpeg' });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from('try-ons').getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, storagePath };
}
