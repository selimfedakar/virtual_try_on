import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useState } from 'react';
import Purchases, { PACKAGE_TYPE, PurchasesPackage } from 'react-native-purchases';
import { getOfferings, PREMIUM_ENTITLEMENT } from '../lib/premium';
import { track } from '../lib/analytics';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgraded: () => void;
}

function packageLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.MONTHLY: return 'Monthly';
    case PACKAGE_TYPE.ANNUAL: return 'Annual';
    case PACKAGE_TYPE.WEEKLY: return 'Weekly';
    case PACKAGE_TYPE.SIX_MONTH: return '6 Months';
    case PACKAGE_TYPE.THREE_MONTH: return '3 Months';
    case PACKAGE_TYPE.TWO_MONTH: return '2 Months';
    case PACKAGE_TYPE.LIFETIME: return 'Lifetime';
    default: return pkg.identifier;
  }
}

/** e.g. "3 days free trial" or "$0.99 for the first month" */
function introOfferText(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;
  if (!intro) return null;
  const unit = intro.periodUnit.toLowerCase(); // DAY/WEEK/MONTH/YEAR
  const n = intro.periodNumberOfUnits;
  const period = n === 1 ? unit : `${n} ${unit}s`;
  if (intro.price === 0) {
    return `${period} free trial`;
  }
  return `${intro.priceString} for the first ${period}`;
}

/** Percent saved on the annual package vs paying monthly for a year. */
function annualSavingsPct(annual: PurchasesPackage, monthly: PurchasesPackage): number | null {
  const yearAtMonthlyRate = monthly.product.price * 12;
  if (yearAtMonthlyRate <= 0) return null;
  const pct = Math.round((1 - annual.product.price / yearAtMonthlyRate) * 100);
  return pct > 0 ? pct : null;
}

export default function PaywallModal({ visible, onClose, onUpgraded }: PaywallModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);

  const loadOfferings = async () => {
    track('paywall_shown');
    setLoadingOfferings(true);
    try {
      const offering = await getOfferings();
      const available = offering?.availablePackages ?? [];
      // Annual first, then monthly, then the rest
      const order = (p: PurchasesPackage) =>
        p.packageType === PACKAGE_TYPE.ANNUAL ? 0 : p.packageType === PACKAGE_TYPE.MONTHLY ? 1 : 2;
      const sorted = [...available].sort((a, b) => order(a) - order(b));
      setPackages(sorted);
      setSelected(prev => prev ?? sorted[0] ?? null);
    } finally {
      setLoadingOfferings(false);
    }
  };

  const handleUpgrade = async () => {
    const pkg = selected ?? packages[0];
    if (!pkg) {
      Alert.alert('Unavailable', 'Premium is not available in your region yet.');
      return;
    }
    setLoading(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      // Entitlement state is validated server-side via the RevenueCat webhook;
      // the client only checks the entitlement locally.
      const isPremium = !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];
      if (isPremium) {
        track('paywall_purchased', { package: pkg.identifier });
        onUpgraded();
      }
    } catch (err: any) {
      if (!err.userCancelled) {
        Alert.alert('Purchase failed', 'Please try again or contact support.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPremium = !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT];
      if (isPremium) {
        onUpgraded();
      } else {
        Alert.alert('No active subscription', 'No Premium purchase found for this Apple ID.');
      }
    } catch {
      Alert.alert('Restore failed', 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const monthly = packages.find(p => p.packageType === PACKAGE_TYPE.MONTHLY) ?? null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={loadOfferings}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.badge}>GO UNLIMITED</Text>
          <Text style={styles.title}>Upgrade to Premium</Text>
          <Text style={styles.subtitle}>
            Unlimited AI try-ons and stylist advice.{'\n'}
            Cancel anytime.
          </Text>

          <View style={styles.features}>
            {[
              'Unlimited AI try-ons every day',
              'Unlimited AI Stylist suggestions',
              'Priority generation queue',
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Package cards */}
          {loadingOfferings ? (
            <View style={styles.packagesLoading}>
              <ActivityIndicator color="#ffffff" />
            </View>
          ) : packages.length === 0 ? (
            <View style={styles.packagesLoading}>
              <Text style={styles.packagesEmptyText}>
                Premium is not available right now. Please try again later.
              </Text>
            </View>
          ) : (
            <View style={styles.packages}>
              {packages.map(pkg => {
                const isSelected = selected?.identifier === pkg.identifier;
                const isAnnual = pkg.packageType === PACKAGE_TYPE.ANNUAL;
                const savings = isAnnual && monthly ? annualSavingsPct(pkg, monthly) : null;
                const intro = introOfferText(pkg);
                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                    onPress={() => setSelected(pkg)}
                    disabled={loading}
                  >
                    <View style={styles.packageTopRow}>
                      <Text style={[styles.packageLabel, isSelected && { color: '#ffffff' }]}>
                        {packageLabel(pkg)}
                      </Text>
                      {savings !== null && (
                        <View style={styles.savingsBadge}>
                          <Text style={styles.savingsText}>SAVE {savings}%</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.packagePrice, isSelected && { color: '#ffffff' }]}>
                      {pkg.product.priceString}
                    </Text>
                    {intro && <Text style={styles.packageIntro}>{intro}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={[styles.upgradeBtn, (loading || !selected) && { opacity: 0.6 }]}
            onPress={handleUpgrade}
            disabled={loading || !selected}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.upgradeBtnText}>
                {selected ? `Continue — ${selected.product.priceString}` : 'Continue'}
              </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={loading}>
            <Text style={styles.restoreBtnText}>Restore Purchase</Text>
          </TouchableOpacity>

          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => Linking.openURL('https://virtual-try-on-three-sage.vercel.app/privacy')}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalSep}> · </Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}>
              <Text style={styles.legalLink}>Terms of Use</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cancelNote}>
            Subscriptions can be cancelled anytime in{'\n'}iOS Settings → Apple ID → Subscriptions.
          </Text>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111111', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 48, alignItems: 'center',
    borderTopWidth: 1, borderColor: '#2a2a2a',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#3a3a3a', marginBottom: 24,
  },
  badge: {
    color: '#4a90d0', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 12,
  },
  title: {
    color: '#ffffff', fontSize: 26, fontWeight: 'bold',
    textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    color: '#71717a', fontSize: 15, textAlign: 'center',
    lineHeight: 22, marginBottom: 22,
  },
  features: { width: '100%', marginBottom: 20, gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureCheck: { color: '#22c55e', fontSize: 16, fontWeight: 'bold' },
  featureText: { color: '#d4d4d8', fontSize: 15 },

  packagesLoading: {
    width: '100%', paddingVertical: 24, alignItems: 'center', marginBottom: 16,
  },
  packagesEmptyText: { color: '#52525b', fontSize: 13, textAlign: 'center' },
  packages: { width: '100%', flexDirection: 'row', gap: 10, marginBottom: 18 },
  packageCard: {
    flex: 1, backgroundColor: '#0a1b2e', borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: '#1e4878',
  },
  packageCardSelected: { borderColor: '#ffffff', backgroundColor: '#10263e' },
  packageTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6, gap: 6,
  },
  packageLabel: { color: '#7eb8d6', fontSize: 13, fontWeight: '700' },
  savingsBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 100,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)',
  },
  savingsText: { color: '#22c55e', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  packagePrice: { color: '#c0d8f0', fontSize: 19, fontWeight: '800' },
  packageIntro: { color: '#22c55e', fontSize: 11, fontWeight: '600', marginTop: 4 },

  upgradeBtn: {
    backgroundColor: '#ffffff', borderRadius: 100,
    paddingVertical: 18, width: '100%', alignItems: 'center', marginBottom: 12,
  },
  upgradeBtnText: { color: '#000000', fontSize: 16, fontWeight: 'bold' },
  restoreBtn: { paddingVertical: 10, marginBottom: 4 },
  restoreBtnText: { color: '#52525b', fontSize: 13 },
  legalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, marginTop: 8 },
  legalLink: { color: '#52525b', fontSize: 12, textDecorationLine: 'underline' },
  legalSep: { color: '#3f3f46', fontSize: 12 },
  cancelNote: {
    color: '#3f3f46', fontSize: 11, textAlign: 'center', lineHeight: 17, marginBottom: 4,
  },
  closeBtn: { paddingVertical: 10 },
  closeBtnText: { color: '#3f3f46', fontSize: 13 },
});
