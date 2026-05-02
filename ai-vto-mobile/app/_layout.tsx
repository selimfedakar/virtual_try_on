import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { ProfileProvider } from '../src/context/ProfileContext';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
