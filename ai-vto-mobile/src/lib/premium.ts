import Purchases, { PurchasesOffering } from 'react-native-purchases';

export const PREMIUM_ENTITLEMENT = 'premium';

/**
 * Whether the current user has an active `premium` entitlement.
 * Entitlement state is owned by RevenueCat (validated server-side via the
 * RevenueCat → Supabase webhook); the client only reads it.
 */
export async function getIsPremium(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];
  } catch {
    return false;
  }
}

/** Returns the current offering (all configured packages), or null on failure. */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}
