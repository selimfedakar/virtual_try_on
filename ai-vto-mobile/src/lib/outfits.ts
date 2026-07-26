import AsyncStorage from '@react-native-async-storage/async-storage';
import { getScopedKey } from './userScope';

const BASE_STORAGE_KEY = 'vto_saved_outfits';

/** A locally saved outfit combo: one top + one bottom from the closet. */
export interface SavedOutfit {
  id: string;
  topId: string;
  bottomId: string;
  createdAt: string;
}

export async function getOutfits(): Promise<SavedOutfit[]> {
  try {
    const key = await getScopedKey(BASE_STORAGE_KEY);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveOutfit(topId: string, bottomId: string): Promise<SavedOutfit[]> {
  const outfits = await getOutfits();
  const newOutfit: SavedOutfit = {
    id: Date.now().toString(),
    topId,
    bottomId,
    createdAt: new Date().toISOString(),
  };
  const updated = [newOutfit, ...outfits].slice(0, 30);
  const key = await getScopedKey(BASE_STORAGE_KEY);
  await AsyncStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

export async function deleteOutfit(id: string): Promise<SavedOutfit[]> {
  const outfits = await getOutfits();
  const updated = outfits.filter(o => o.id !== id);
  const key = await getScopedKey(BASE_STORAGE_KEY);
  await AsyncStorage.setItem(key, JSON.stringify(updated));
  return updated;
}
