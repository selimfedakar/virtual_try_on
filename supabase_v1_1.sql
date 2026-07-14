-- ============================================================================
-- VTO v1.1 — Backend migration
-- Paste this whole file into Supabase Dashboard > SQL Editor and run it.
-- Every statement is idempotent — safe to run more than once.
--
-- Prerequisites: supabase_schema.sql and supabase_freemium.sql already applied
-- (profiles with is_premium/daily_generations, generations, pending_generations,
--  check_and_increment_generation must exist).
--
-- Contents:
--   1. generations: prediction_id / storage_path / category columns  (race fix)
--   2. pending_generations: category column + created_at index       (B1 + B7)
--   3. refund_generation() — quota refund on failed generations      (A7)
--   4. reports table — real content reporting                        (A3)
--   5. check_and_increment_stylist() + stylist_usage — AI Stylist    (A2)
--   6. Social schema: shared_looks, look_likes, RPCs, challenges     (C5)
--   7. events table — lightweight analytics                          (A5 support)
-- ============================================================================


-- ============================================================================
-- 1. generations — identify each row by its Fashn.ai prediction
--    Fixes the wrong-result race: /api/predictions/[id] previously fell back
--    to "newest generation in the last 15 min", which could return the wrong
--    image when two generations ran concurrently. Now rows are looked up by
--    prediction_id directly.
-- ============================================================================
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS prediction_id TEXT,     -- Fashn.ai prediction id
  ADD COLUMN IF NOT EXISTS storage_path  TEXT,     -- path inside the try-ons bucket
  ADD COLUMN IF NOT EXISTS category      TEXT;     -- tops | bottoms | one-piece

-- Lookup path used by the polling endpoint: prediction_id + user_id
CREATE INDEX IF NOT EXISTS generations_prediction_id_idx
  ON public.generations (prediction_id)
  WHERE prediction_id IS NOT NULL;


-- ============================================================================
-- 2. pending_generations — carry the garment category through the webhook,
--    and index created_at for the daily cleanup cron (B7).
-- ============================================================================
ALTER TABLE public.pending_generations
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'tops';

CREATE INDEX IF NOT EXISTS pending_generations_created_at_idx
  ON public.pending_generations (created_at);


-- ============================================================================
-- 3. refund_generation — give back one daily-quota unit (floor 0).
--    Called by the backend when:
--      a) the Fashn.ai /run call fails right after the quota was consumed, or
--      b) the Fashn.ai webhook reports status = 'failed'.
--    Only refunds against TODAY's counter — if the day already rolled over,
--    the counter was reset anyway and there is nothing to refund.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refund_generation(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
     SET daily_generations = GREATEST(daily_generations - 1, 0)
   WHERE id = p_user_id
     AND daily_reset_at = CURRENT_DATE;
END;
$$;


-- ============================================================================
-- 4. reports — real content reporting (A3, App Store Guideline 1.2).
--    Service-role only: RLS is enabled with NO policies, so anon/authenticated
--    clients cannot read or write. The backend uses the service key.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users NOT NULL,  -- reporter
  image_url  TEXT        NOT NULL,                        -- reported content
  reason     TEXT,                                        -- optional free text
  status     TEXT        NOT NULL DEFAULT 'open',         -- open | reviewed | actioned | dismissed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the service role may access this table.

-- Backend rate-limit query filters on (user_id, created_at)
CREATE INDEX IF NOT EXISTS reports_user_created_idx
  ON public.reports (user_id, created_at);


-- ============================================================================
-- 5. AI Stylist quota (A2) — 10 free requests/day, unlimited for premium.
--    Separate usage table (one row per user per day) instead of extra columns
--    on profiles, so it cannot interfere with the generation counter/reset.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stylist_usage (
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  used_on DATE NOT NULL DEFAULT CURRENT_DATE,
  count   INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, used_on)
);

ALTER TABLE public.stylist_usage ENABLE ROW LEVEL SECURITY;
-- Service-role only (the RPC below is SECURITY DEFINER) — no client policies.

CREATE OR REPLACE FUNCTION public.check_and_increment_stylist(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_is_premium boolean;
  v_count      int;
  FREE_LIMIT   CONSTANT int := 10;
BEGIN
  -- Premium users are unlimited (and their usage is not counted)
  SELECT is_premium INTO v_is_premium FROM profiles WHERE id = p_user_id;
  IF COALESCE(v_is_premium, false) THEN
    RETURN true;
  END IF;

  -- Atomic upsert-and-increment for today's row, locking it against races
  INSERT INTO stylist_usage (user_id, used_on, count)
       VALUES (p_user_id, CURRENT_DATE, 0)
  ON CONFLICT (user_id, used_on) DO NOTHING;

  SELECT count INTO v_count
    FROM stylist_usage
   WHERE user_id = p_user_id AND used_on = CURRENT_DATE
     FOR UPDATE;

  IF v_count >= FREE_LIMIT THEN
    RETURN false;
  END IF;

  UPDATE stylist_usage
     SET count = count + 1
   WHERE user_id = p_user_id AND used_on = CURRENT_DATE;

  RETURN true;
END;
$$;


-- ============================================================================
-- 6. Social schema (C5) — shared looks, likes, views, weekly challenges.
--    Consumed directly from the mobile app via supabase-js under RLS.
-- ============================================================================

-- ── 6a. shared_looks ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_looks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES auth.users NOT NULL,
  image_url    TEXT        NOT NULL,
  caption      TEXT,
  likes_count  INT         NOT NULL DEFAULT 0,
  views_count  INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_looks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shared_looks' AND policyname='Authenticated users can view shared looks') THEN
    CREATE POLICY "Authenticated users can view shared looks" ON public.shared_looks
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shared_looks' AND policyname='Users can share their own looks') THEN
    CREATE POLICY "Users can share their own looks" ON public.shared_looks
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='shared_looks' AND policyname='Users can delete their own looks') THEN
    CREATE POLICY "Users can delete their own looks" ON public.shared_looks
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Feed query pattern: newest first
CREATE INDEX IF NOT EXISTS shared_looks_created_at_idx
  ON public.shared_looks (created_at DESC);

-- ── 6b. look_likes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.look_likes (
  look_id UUID NOT NULL REFERENCES public.shared_looks ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  PRIMARY KEY (look_id, user_id)
);

ALTER TABLE public.look_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='look_likes' AND policyname='Authenticated users can view likes') THEN
    CREATE POLICY "Authenticated users can view likes" ON public.look_likes
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='look_likes' AND policyname='Users can like as themselves') THEN
    CREATE POLICY "Users can like as themselves" ON public.look_likes
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='look_likes' AND policyname='Users can remove their own likes') THEN
    CREATE POLICY "Users can remove their own likes" ON public.look_likes
      FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 6c. toggle_look_like — like/unlike atomically, keep likes_count in sync ──
-- Returns the NEW state: true = now liked, false = now unliked.
CREATE OR REPLACE FUNCTION public.toggle_look_like(p_look_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM look_likes
   WHERE look_id = p_look_id AND user_id = v_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    -- Was liked → now unliked
    UPDATE shared_looks
       SET likes_count = GREATEST(likes_count - 1, 0)
     WHERE id = p_look_id;
    RETURN false;
  ELSE
    -- Was not liked → like it
    INSERT INTO look_likes (look_id, user_id) VALUES (p_look_id, v_user_id);
    UPDATE shared_looks
       SET likes_count = likes_count + 1
     WHERE id = p_look_id;
    RETURN true;
  END IF;
END;
$$;

-- ── 6d. record_look_view — fire-and-forget view counter ──────────────────────
CREATE OR REPLACE FUNCTION public.record_look_view(p_look_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE shared_looks
     SET views_count = views_count + 1
   WHERE id = p_look_id;
END;
$$;

-- ── 6e. style_challenges — weekly style challenges ───────────────────────────
CREATE TABLE IF NOT EXISTS public.style_challenges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT,
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at     TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days'
);

ALTER TABLE public.style_challenges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='style_challenges' AND policyname='Anyone can view challenges') THEN
    CREATE POLICY "Anyone can view challenges" ON public.style_challenges
      FOR SELECT USING (true);
  END IF;
END $$;
-- Writes are service-role/dashboard only (no insert/update policies).

-- Seed one sample weekly challenge (only if the table is empty)
INSERT INTO public.style_challenges (title, description, starts_at, ends_at)
SELECT
  'Summer Layers Challenge',
  'Show us your best layered summer look! Try on a light jacket or overshirt over a summer outfit and share your favorite result. The most-liked look wins a feature on the community feed.',
  date_trunc('week', now()),
  date_trunc('week', now()) + interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM public.style_challenges);


-- ============================================================================
-- 7. events — lightweight analytics (mobile inserts directly via supabase-js).
--    Clients may only INSERT their own events; no client SELECT (analytics is
--    read via the dashboard / service role only).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users ON DELETE SET NULL,
  name       TEXT        NOT NULL,               -- e.g. generate_started, paywall_shown
  props      JSONB       NOT NULL DEFAULT '{}',  -- arbitrary event properties
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='events' AND policyname='Users can insert their own events') THEN
    CREATE POLICY "Users can insert their own events" ON public.events
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
-- Intentionally no SELECT policy for clients.

CREATE INDEX IF NOT EXISTS events_name_created_at_idx
  ON public.events (name, created_at);

-- ============================================================================
-- Done. After running this file:
--   * Set Vercel env vars: ADMIN_EMAILS, REVENUECAT_WEBHOOK_AUTH,
--     ANTHROPIC_API_KEY, CRON_SECRET (FASHN_WEBHOOK_SECRET must already be set —
--     the webhook is now fail-closed and rejects requests when it is missing).
--   * Configure the RevenueCat dashboard webhook to POST to
--     https://<your-vercel-domain>/api/webhook/revenuecat with the same
--     Authorization header value as REVENUECAT_WEBHOOK_AUTH.
-- ============================================================================
