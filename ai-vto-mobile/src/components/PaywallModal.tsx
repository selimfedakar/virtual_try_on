import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useState } from 'react';
import Purchases, { PACKAGE_TYPE, PurchasesPackage } from 'react-native-purchases';
import { supabase } from '../lib/supabase';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgraded: () => void;
}

export default function PaywallModal({ visible, onClose, onUpgraded }: PaywallModalProps) {
  const [loading, setLoading] = useState(false);
  const [activePackage, setActivePackage] = useState<PurchasesPackage | null>(null);
  const [priceString, setPriceString] = useState('');

  const loadOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages.find(
        p => p.packageType === PACKAGE_TYPE.MONTHLY,
      ) ?? offerings.current?.availablePackages[0];
      if (pkg) {
        setActivePackage(pkg);
        setPriceString(pkg.product.priceString);
      }
    } catch {}
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = activePackage ?? (
        offerings.current?.availablePackages.find(p => p.packageType === PACKAGE_TYPE.MONTHLY)
        ?? offerings.current?.availablePackages[0]
      );

      if (!pkg) {
        Alert.alert('Unavailable', 'Premium is not available in your region yet.');
        return;
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isPremium = !!customerInfo.entitlements.active['premium'];

      if (isPremium) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('profiles').update({ is_premium: true }).eq('id', session.user.id);
        }
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
      const isPremium = !!customerInfo.entitlements.active['premium'];
      if (isPremium) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('profiles').update({ is_premium: true }).eq('id', session.user.id);
        }
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={loadOfferings}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.badge}>FREE LIMIT REACHED</Text>
          <Text style={styles.title}>Upgrade to Premium</Text>
          <Text style={styles.subtitle}>
            You've used your 5 free try-ons today.{'\n'}
            Upgrade for unlimited generations.
          </Text>

          <View style={styles.features}>
            {[
              'Unlimited AI try-ons every day',
              'Priority generation queue',
              'Unlimited Closet history',
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.upgradeBtn, loading && { opacity: 0.6 }]}
            onPress={handleUpgrade}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.upgradeBtnText}>
                Upgrade — {priceString || '$4.99'} / month
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
    color: '#ef4444', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, marginBottom: 12,
  },
  title: {
    color: '#ffffff', fontSize: 26, fontWeight: 'bold',
    textAlign: 'center', marginBottom: 10,
  },
  subtitle: {
    color: '#71717a', fontSize: 15, textAlign: 'center',
    lineHeight: 22, marginBottom: 28,
  },
  features: { width: '100%', marginBottom: 28, gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureCheck: { color: '#22c55e', fontSize: 16, fontWeight: 'bold' },
  featureText: { color: '#d4d4d8', fontSize: 15 },
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
  closeBtn: { paddingVertical: 10 },
  closeBtnText: { color: '#3f3f46', fontSize: 13 },
});
