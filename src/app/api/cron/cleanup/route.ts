import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * B7 — Hygiene cron. Deletes pending_generations rows older than 2 hours
 * (orphans left behind when a webhook never fired or a generation timed out).
 *
 * Protected by CRON_SECRET: when the env var is set on Vercel, Vercel cron
 * automatically sends `Authorization: Bearer ${CRON_SECRET}`. Fail-closed
 * if the env var is unset.
 *
 * Scheduled via vercel.json: daily at 06:00 UTC.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('Authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { error, count } = await supabase
      .from('pending_generations')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff);

    if (error) {
      console.error('[Cron] Cleanup failed:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log(`[Cron] Deleted ${count ?? 0} stale pending_generations rows`);
    return NextResponse.json({ success: true, deleted: count ?? 0 });

  } catch (error: any) {
    console.error('[Cron] Cleanup error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
