import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Returns the storage scope for the current session: the Supabase user id,
 * or 'guest' when nobody is signed in. Used to namespace local storage keys
 * so a new login never sees the previous user's local data.
 */
export async function getUserScope(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? 'guest';
  } catch {
    return 'guest';
  }
}

/**
 * Builds a user-scoped AsyncStorage key from a legacy device-global base key.
 * Also migrates any data still stored under the legacy global key into the
 * current scope (one time only — the legacy key is removed after migration).
 */
export async function getScopedKey(baseKey: string): Promise<string> {
  const scope = await getUserScope();
  const scopedKey = `${baseKey}_${scope}`;
  try {
    const legacyValue = await AsyncStorage.getItem(baseKey);
    if (legacyValue !== null) {
      const existing = await AsyncStorage.getItem(scopedKey);
      if (existing === null) {
        await AsyncStorage.setItem(scopedKey, legacyValue);
      }
      await AsyncStorage.removeItem(baseKey);
    }
  } catch {}
  return scopedKey;
}
