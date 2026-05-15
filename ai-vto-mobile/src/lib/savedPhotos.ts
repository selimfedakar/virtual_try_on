import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'vto_saved_person_photos';
const PHOTOS_DIR = `${FileSystem.documentDirectory}person_photos/`;

export interface SavedPhoto {
  id: string;
  uri: string; // permanent file:// path on device
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

export async function getSavedPhotos(): Promise<SavedPhoto[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function savePhoto(sourceUri: string): Promise<SavedPhoto> {
  await ensureDir();
  const id = Date.now().toString();
  const destUri = `${PHOTOS_DIR}${id}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });

  const photos = await getSavedPhotos();
  const newPhoto: SavedPhoto = { id, uri: destUri };
  const updated = [newPhoto, ...photos].slice(0, 6); // max 6 saved
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newPhoto;
}

export async function deletePhoto(id: string): Promise<SavedPhoto[]> {
  const photos = await getSavedPhotos();
  const target = photos.find(p => p.id === id);
  if (target) {
    await FileSystem.deleteAsync(target.uri, { idempotent: true });
  }
  const updated = photos.filter(p => p.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function clearSavedPhotos(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}

export async function readPhotoAsBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
