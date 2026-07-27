import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'vto_onboarding_done';

export default function Index() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then(flag => setOnboardingDone(!!flag))
      .catch(() => setOnboardingDone(true)); // fail open — never trap users in onboarding
  }, []);

  if (onboardingDone === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // First launch → onboarding; otherwise straight to home (auth is optional).
  if (!onboardingDone) {
    return <Redirect href="/onboarding" />;
  }
  return <Redirect href="/(tabs)/home" />;
}
