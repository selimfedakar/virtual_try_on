import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../src/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { ProfileProvider } from '../src/context/ProfileContext';
import Purchases from 'react-native-purchases';

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // RevenueCat init — configure before any purchase calls
    if (REVENUECAT_IOS_KEY) {
      Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Identify user to RevenueCat for cross-device purchase sync
      if (session?.user?.id && REVENUECAT_IOS_KEY) {
        Purchases.logIn(session.user.id).catch(() => {});
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id && REVENUECAT_IOS_KEY) {
        Purchases.logIn(session.user.id).catch(() => {});
      }
    });
  }, []);

  return (
    <ProfileProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ProfileProvider>
  );
}
