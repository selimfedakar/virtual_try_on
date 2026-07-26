import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getScopedKey } from './userScope';

const BASE_STORAGE_KEY = 'vto_saved_garments';
const GARMENTS_DIR = new Directory(Paths.document, 'garments');

export type GarmentCategory = 'tops' | 'bottoms' | 'one-piece';

export const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  'tops': 'Tops',
  'bottoms': 'Bottoms',
  'one-piece': 'Full body',
};

export interface SavedGarment {
  id: string;
  uri: string;
  addedAt: string;
  /** Optional wardrobe category. Old items (pre-v1.1) simply have no category. */
  category?: GarmentCategory;
}

function ensureDir(): void {
  if (!GARMENTS_DIR.exists) {
    GARMENTS_DIR.create({ intermediates: true, idempotent: true });
  }
}

export async function getSavedGarments(): Promise<SavedGarment[]> {
  try {
    const key = await getScopedKey(BASE_STORAGE_KEY);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    // Graceful migration: keep only well-formed items, category stays optional.
    return parsed.filter(
      (g: any): g is SavedGarment => g && typeof g.id === 'string' && typeof g.uri === 'string',
    );
  } catch {
    return [];
  }
}

async function persist(garments: SavedGarment[]): Promise<void> {
  const key = await getScopedKey(BASE_STORAGE_KEY);
  await AsyncStorage.setItem(key, JSON.stringify(garments));
}

export async function saveGarment(
  sourceUri: string,
  category?: GarmentCategory,
): Promise<SavedGarment> {
  ensureDir();
  const id = Date.now().toString();
  const dest = new File(GARMENTS_DIR, `${id}.jpg`);
  new File(sourceUri).copy(dest);

  const garments = await getSavedGarments();
  const newGarment: SavedGarment = {
    id,
    uri: dest.uri,
    addedAt: new Date().toISOString(),
    ...(category ? { category } : {}),
  };
  const updated = [newGarment, ...garments].slice(0, 30);
  await persist(updated);
  return newGarment;
}

export async function setGarmentCategory(
  id: string,
  category: GarmentCategory | null,
): Promise<SavedGarment[]> {
  const garments = await getSavedGarments();
  const updated = garments.map(g => {
    if (g.id !== id) return g;
    const next = { ...g };
    if (category) next.category = category;
    else delete next.category;
    return next;
  });
  await persist(updated);
  return updated;
}

export async function clearSavedGarments(): Promise<void> {
  try {
    const key = await getScopedKey(BASE_STORAGE_KEY);
    await AsyncStorage.removeItem(key);
  } catch {}
}

export async function deleteGarment(id: string): Promise<SavedGarment[]> {
  const garments = await getSavedGarments();
  const target = garments.find(g => g.id === id);
  if (target) {
    try {
      const file = new File(target.uri);
      if (file.exists) file.delete();
    } catch {}
  }
  const updated = garments.filter(g => g.id !== id);
  await persist(updated);
  return updated;
}
