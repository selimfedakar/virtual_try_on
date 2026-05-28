import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
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

    // Handle Supabase auth deep links (email verification, password reset)
    const handleAuthUrl = async (url: string) => {
      // Parse params from both query string (?) and hash fragment (#)
      const params: Record<string, string> = {};
      const parts = url.split(/[?#]/);
      for (let i = 1; i < parts.length; i++) {
        parts[i].split('&').forEach(pair => {
          const eq = pair.indexOf('=');
          if (eq > 0) {
            params[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
          }
        });
      }

      if (params.access_token && params.refresh_token) {
        await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        }).catch(() => {});
      } else if (params.token_hash && params.type) {
        await supabase.auth.verifyOtp({
          token_hash: params.token_hash,
          type: params.type as any,
        }).catch(() => {});
      }
    };

    // Cold-start: app opened by tapping email link
    Linking.getInitialURL().then(url => { if (url) handleAuthUrl(url); }).catch(() => {});

    // Warm: app in background, email link tapped
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));

    return () => linkingSub.remove();
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
