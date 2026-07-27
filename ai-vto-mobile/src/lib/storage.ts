import { fetch as expoFetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import { supabase } from './supabase';

const TRY_ONS_BUCKET = 'try-ons';
const AVATARS_BUCKET = 'avatars';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Binary upload via expo/fetch with the file's raw bytes as body —
// avoids the fetch().blob() empty-blob bug on React Native.
async function nativeUpload(
  localUri: string,
  bucket: string,
  path: string,
  upsert: boolean,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_ANON_KEY;

  const bytes = await new File(localUri).arrayBuffer();

  const res = await expoFetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'image/jpeg',
        'x-upsert': upsert ? 'true' : 'false',
      },
      body: new Uint8Array(bytes),
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

  // Download the CDN URL to a local file first — reliable on all Expo versions
  const tmpFile = new File(Paths.cache, 'vto_tmp.jpg');
  await File.downloadFileAsync(imageUrl, tmpFile, { idempotent: true });

  return await nativeUpload(tmpFile.uri, TRY_ONS_BUCKET, path, false);
}

export async function uploadProfilePhoto(localUri: string, userId: string): Promise<string> {
  try {
    const path = `${userId}/avatar.jpg`;
    return await nativeUpload(localUri, AVATARS_BUCKET, path, true);
  } catch {
    return localUri;
  }
}
