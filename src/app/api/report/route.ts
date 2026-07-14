import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/apiAuth';
import { createServiceClient } from '@/lib/supabase/service';

// Max reports per user per day (light abuse protection)
const DAILY_REPORT_LIMIT = 10;

/**
 * A3 — Real content reporting (App Store Guideline 1.2 / UGC compliance).
 * Body: { imageUrl: string, reason?: string }
 * Inserts into the service-role-only `reports` table for manual review.
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { imageUrl, reason } = body ?? {};

    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.length > 2048) {
      return NextResponse.json({ error: 'imageUrl (string) is required' }, { status: 400 });
    }
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 1000)) {
      return NextResponse.json({ error: 'reason must be a string (max 1000 chars)' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Light rate limit: max 10 reports per user per rolling 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since);

    if ((count ?? 0) >= DAILY_REPORT_LIMIT) {
      return NextResponse.json(
        { success: false, error: 'report_limit_reached' },
        { status: 429 },
      );
    }

    const { error } = await supabase.from('reports').insert({
      user_id: user.id,
      image_url: imageUrl,
      reason: reason ?? null,
    });

    if (error) {
      console.error('[Report] Insert failed:', error.message);
      return NextResponse.json({ success: false, error: 'Failed to submit report' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Report error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit report.' },
      { status: 500 },
    );
  }
}
