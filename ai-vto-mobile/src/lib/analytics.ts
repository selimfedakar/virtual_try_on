import { supabase } from './supabase';

/**
 * Fire-and-forget analytics event. Inserts a row into the Supabase `events`
 * table with the current user id. Silently does nothing when the user is
 * signed out or the insert fails — it must never throw or block the UI.
 */
export function track(name: string, props?: Record<string, unknown>): void {
  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      await supabase.from('events').insert({
        user_id: userId,
        name,
        props: props ?? {},
      });
    } catch {
      // Analytics must never surface errors to the user.
    }
  })();
}
