import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/apiAuth';
import { createServiceClient } from '@/lib/supabase/service';

export const maxDuration = 60;

// Fashn.ai tryon-v1.6 supported garment categories
const VALID_CATEGORIES = ['tops', 'bottoms', 'one-piece'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

// Fashn.ai tryon-v1.6 quality/speed tradeoff modes
const VALID_MODES = ['performance', 'balanced', 'quality'] as const;
type Mode = (typeof VALID_MODES)[number];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { baseImage, garments } = body;

    if (!baseImage || !garments?.[0]?.image) {
      return NextResponse.json({ error: 'baseImage and garment required' }, { status: 400 });
    }

    // Optional category — defaults to 'tops' for backwards compatibility
    const category: Category = body.category ?? 'tops';
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 },
      );
    }

    // Optional mode — defaults to 'balanced'
    let mode: Mode = body.mode ?? 'balanced';
    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json(
        { error: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}` },
        { status: 400 },
      );
    }

    // Auth
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin bypass — comma-separated whitelist from env (empty by default)
    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isAdmin = adminEmails.includes((user.email ?? '').toLowerCase());

    const serviceClient = createServiceClient();

    // 'quality' mode requires premium — silently downgrade to 'balanced' otherwise
    if (mode === 'quality') {
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('is_premium')
        .eq('id', user.id)
        .single();
      if (!profile?.is_premium) {
        mode = 'balanced';
      }
    }

    // Daily quota (atomic RPC). Track consumption so we can refund on failure.
    let quotaConsumed = false;
    if (!isAdmin) {
      const { data: allowed, error: quotaError } = await serviceClient.rpc(
        'check_and_increment_generation',
        { p_user_id: user.id },
      );
      if (quotaError || !allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'daily_limit_reached',
            message: 'You have used your 5 free generations today. Upgrade to Premium for unlimited access.',
          },
          { status: 429 },
        );
      }
      quotaConsumed = true;
    }

    try {
      // Fashn.ai — virtual try-on specific API
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/fashn?secret=${encodeURIComponent(process.env.FASHN_WEBHOOK_SECRET ?? '')}`;

      const fashnPayload = {
        model_name: 'tryon-v1.6',
        inputs: {
          model_image: baseImage,
          garment_image: garments[0].image,
          category,
          mode,
          garment_photo_type: 'auto',
        },
        webhook_url: webhookUrl,
      };

      console.log('[Fashn.ai] Sending request:', {
        model_image_len: baseImage.length,
        garment_image_len: garments[0].image.length,
        category,
        mode,
      });

      const fashnRes = await fetch('https://api.fashn.ai/v1/run', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FASHN_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fashnPayload),
      });

      if (!fashnRes.ok) {
        const errText = await fashnRes.text();
        console.error('[Fashn.ai] Request failed:', fashnRes.status, errText);
        throw new Error(`Fashn.ai ${fashnRes.status}: ${errText}`);
      }

      const { id: predictionId } = await fashnRes.json();

      // Track prediction → user mapping so the webhook can broadcast to the right user.
      // Category is stored so the result row can carry it (see webhook/predictions).
      await serviceClient.from('pending_generations').insert({
        prediction_id: predictionId,
        user_id: user.id,
        category,
      });

      return NextResponse.json({ success: true, data: { predictionId } });

    } catch (fashnError) {
      // The Fashn.ai call failed after the quota was consumed — refund it
      // so the user does not lose a generation for a server-side failure.
      if (quotaConsumed) {
        const { error: refundError } = await serviceClient.rpc('refund_generation', {
          p_user_id: user.id,
        });
        if (refundError) {
          console.error('[Quota] Refund failed:', refundError.message);
        } else {
          console.log('[Quota] Refunded 1 generation for user', user.id);
        }
      }
      throw fashnError;
    }

  } catch (error: any) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start generation.' },
      { status: 500 },
    );
  }
}
