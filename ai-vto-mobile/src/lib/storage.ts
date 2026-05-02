import { supabase } from './supabase';

const BUCKET = 'try-ons';

/**
 * Downloads a Replicate CDN image and uploads it to Supabase Storage.
 * Falls back to the original (temporary) URL if the bucket doesn't exist
 * or any error occurs — so saves always succeed in some form.
 *
 * To enable permanent storage: create a public bucket called "try-ons"
 * in your Supabase dashboard → Storage.
 */
export async function uploadTryOnImage(
  imageUrl: string,
  userId: string,
): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('fetch failed');

    const blob = await response.blob();
    const path = `${userId}/${Date.now()}.jpg`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch {
    // Bucket not set up yet — use the Replicate URL as fallback
    return imageUrl;
  }
}
