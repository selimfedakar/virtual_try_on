import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// Event types that GRANT premium access.
// Note: CANCELLATION alone does NOT revoke — the user keeps access until EXPIRATION.
const GRANT_EVENTS = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'];
const REVOKE_EVENTS = ['EXPIRATION'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A6 — RevenueCat server-to-server webhook.
 * Closes the revenue leak where is_premium was written from the client:
 * this endpoint is now the single source of truth for entitlement state.
 *
 * RevenueCat sends the configured Authorization header value verbatim —
 * set the SAME value in the RevenueCat dashboard and in REVENUECAT_WEBHOOK_AUTH.
 *
 * Returns 200 for every handled/unknown event (RevenueCat retries on non-200);
 * 401 only for missing/invalid auth (fail-closed if the env var is unset).
 */
export async function POST(req: Request) {
  // Fail-closed auth
  const auth = req.headers.get('Authorization');
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const event = body?.event;

    if (!event?.type) {
      console.warn('[RevenueCat] Payload without event.type');
      return NextResponse.json({ received: true });
    }

    console.log('[RevenueCat] Event:', event.type, 'app_user_id:', event.app_user_id);

    // app_user_id is the Supabase user id (mobile calls Purchases.logIn(userId)).
    // Anonymous ids ($RCAnonymousID:...) are not Supabase users — skip them.
    const appUserId: string | undefined = event.app_user_id;
    if (!appUserId || !UUID_RE.test(appUserId)) {
      console.warn('[RevenueCat] app_user_id is not a Supabase uuid — skipping:', appUserId);
      return NextResponse.json({ received: true });
    }

    let isPremium: boolean | null = null;
    if (GRANT_EVENTS.includes(event.type)) isPremium = true;
    else if (REVOKE_EVENTS.includes(event.type)) isPremium = false;

    if (isPremium === null) {
      // Unknown / no-op event type (CANCELLATION, BILLING_ISSUE, TEST, etc.) —
      // acknowledge so RevenueCat does not retry.
      console.log('[RevenueCat] No entitlement change for event type:', event.type);
      return NextResponse.json({ received: true });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('profiles')
      .update({ is_premium: isPremium })
      .eq('id', appUserId);

    if (error) {
      // Log but still return 200 — a retry would hit the same DB error,
      // and RevenueCat's retry storm won't fix a data problem.
      console.error('[RevenueCat] Failed to update is_premium:', error.message);
    } else {
      console.log(`[RevenueCat] is_premium=${isPremium} for user ${appUserId}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('[RevenueCat] Webhook error:', error);
    // Malformed body — return 200 to stop retries of an unparseable payload
    return NextResponse.json({ received: true });
  }
}
