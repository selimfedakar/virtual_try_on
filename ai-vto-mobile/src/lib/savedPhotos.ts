import { Directory, File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getScopedKey } from './userScope';

const BASE_STORAGE_KEY = 'vto_saved_person_photos';
const PHOTOS_DIR = new Directory(Paths.document, 'person_photos');

export interface SavedPhoto {
  id: string;
  uri: string; // permanent file:// path on device
}

function ensureDir(): void {
  if (!PHOTOS_DIR.exists) {
    PHOTOS_DIR.create({ intermediates: true, idempotent: true });
  }
}

export async function getSavedPhotos(): Promise<SavedPhoto[]> {
  try {
    const key = await getScopedKey(BASE_STORAGE_KEY);
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function savePhoto(sourceUri: string): Promise<SavedPhoto> {
  ensureDir();
  const id = Date.now().toString();
  const dest = new File(PHOTOS_DIR, `${id}.jpg`);
  new File(sourceUri).copy(dest);

  const photos = await getSavedPhotos();
  const newPhoto: SavedPhoto = { id, uri: dest.uri };
  const updated = [newPhoto, ...photos].slice(0, 6); // max 6 saved
  const key = await getScopedKey(BASE_STORAGE_KEY);
  await AsyncStorage.setItem(key, JSON.stringify(updated));
  return newPhoto;
}

export async function deletePhoto(id: string): Promise<SavedPhoto[]> {
  const photos = await getSavedPhotos();
  const target = photos.find(p => p.id === id);
  if (target) {
    try {
      const file = new File(target.uri);
      if (file.exists) file.delete();
    } catch {}
  }
  const updated = photos.filter(p => p.id !== id);
  const key = await getScopedKey(BASE_STORAGE_KEY);
  await AsyncStorage.setItem(key, JSON.stringify(updated));
  return updated;
}

export async function clearSavedPhotos(): Promise<void> {
  try {
    const key = await getScopedKey(BASE_STORAGE_KEY);
    await AsyncStorage.removeItem(key);
  } catch {}
}

export async function readPhotoAsBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}
