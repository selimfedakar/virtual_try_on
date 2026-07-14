import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

/**
 * Shared Bearer-token authentication for API routes.
 * Extracts the Authorization header, validates the Supabase JWT,
 * and returns the authenticated user (or null).
 */
export async function getAuthenticatedUser(req: Request): Promise<User | null> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return user;
}
