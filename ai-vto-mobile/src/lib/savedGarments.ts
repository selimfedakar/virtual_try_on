import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'vto_saved_garments';
const GARMENTS_DIR = `${FileSystem.documentDirectory}garments/`;

export interface SavedGarment {
  id: string;
  uri: string;
  addedAt: string;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(GARMENTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(GARMENTS_DIR, { intermediates: true });
  }
}

export async function getSavedGarments(): Promise<SavedGarment[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function saveGarment(sourceUri: string): Promise<SavedGarment> {
  await ensureDir();
  const id = Date.now().toString();
  const destUri = `${GARMENTS_DIR}${id}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });

  const garments = await getSavedGarments();
  const newGarment: SavedGarment = { id, uri: destUri, addedAt: new Date().toISOString() };
  const updated = [newGarment, ...garments].slice(0, 30);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newGarment;
}

export async function clearSavedGarments(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

export async function deleteGarment(id: string): Promise<SavedGarment[]> {
  const garments = await getSavedGarments();
  const target = garments.find(g => g.id === id);
  if (target) {
    await FileSystem.deleteAsync(target.uri, { idempotent: true });
  }
  const updated = garments.filter(g => g.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
