import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { baseImage, garments } = body;

    if (!baseImage || !garments?.[0]?.image) {
      return NextResponse.json({ error: 'baseImage and garment required' }, { status: 400 });
    }

    // Auth
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin bypass — unlimited generations for whitelisted accounts
    const ADMIN_EMAILS = ['selimfedakar1@gmail.com'];
    const isAdmin = ADMIN_EMAILS.includes(user.email ?? '');

    if (!isAdmin) {
      const { data: allowed, error: quotaError } = await supabase.rpc(
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
    }

    // Fashn.ai — virtual try-on specific API, faster and more accurate than IDM-VTON
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/fashn?secret=${encodeURIComponent(process.env.FASHN_WEBHOOK_SECRET ?? '')}`;

    const fashnPayload = {
      model_name: 'tryon-v1.6',
      inputs: {
        model_image: baseImage,
        garment_image: garments[0].image,
        category: 'tops',
        nsfw_filter: true,
        garment_photo_type: 'auto',
      },
      webhook_url: webhookUrl,
    };

    console.log('[Fashn.ai] Sending request, image sizes:', {
      model_image_len: baseImage.length,
      garment_image_len: garments[0].image.length,
      webhook_url: webhookUrl,
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
      console.error('[Fashn.ai] BadRequest details:', fashnRes.status, errText);
      throw new Error(`Fashn.ai ${fashnRes.status}: ${errText}`);
    }

    const { id: predictionId } = await fashnRes.json();

    // Track prediction → user mapping so the webhook can broadcast to the right user
    const serviceClient = createServiceClient();
    await serviceClient.from('pending_generations').insert({
      prediction_id: predictionId,
      user_id: user.id,
    });

    return NextResponse.json({ success: true, data: { predictionId } });

  } catch (error: any) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start generation.' },
      { status: 500 },
    );
  }
}
