import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';

const TRY_ONS_BUCKET = 'try-ons';
const AVATARS_BUCKET = 'avatars';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Native-level binary upload — avoids the fetch().blob() empty-blob bug on React Native
async function nativeUpload(
  localUri: string,
  bucket: string,
  path: string,
  upsert: boolean,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_ANON_KEY;

  const res = await FileSystem.uploadAsync(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
    localUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'image/jpeg',
        'x-upsert': upsert ? 'true' : 'false',
      },
    },
  );

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`storage upload failed: ${res.status}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadTryOnImage(imageUrl: string, userId: string): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`;
  const tmpPath = `${FileSystem.cacheDirectory}vto_tmp.jpg`;

  // Download Replicate CDN URL to local file first — reliable on all Expo versions
  await FileSystem.downloadAsync(imageUrl, tmpPath);

  return await nativeUpload(tmpPath, TRY_ONS_BUCKET, path, false);
}

export async function uploadProfilePhoto(localUri: string, userId: string): Promise<string> {
  try {
    const path = `${userId}/avatar.jpg`;
    return await nativeUpload(localUri, AVATARS_BUCKET, path, true);
  } catch {
    return localUri;
  }
}
