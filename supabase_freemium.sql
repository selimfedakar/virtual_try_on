-- ============================================================
-- VTO — Freemium Quota + Webhook Architecture
-- Supabase Dashboard > SQL Editor'da çalıştır
-- ============================================================

-- 1. Profiles tablosunu oluştur (yoksa) — tüm kolonlarla birlikte
CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID        REFERENCES auth.users PRIMARY KEY,
  name           TEXT,
  height         TEXT,
  weight         TEXT,
  gender         TEXT        DEFAULT 'Male',
  avatar_url     TEXT,
  updated_at     TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  is_premium     BOOLEAN     DEFAULT false,
  daily_generations INT      DEFAULT 0,
  daily_reset_at DATE        DEFAULT CURRENT_DATE
);

-- Tablo zaten varsa eksik kolonları ekle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium        BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_generations INT      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_reset_at    DATE     DEFAULT CURRENT_DATE;

-- RLS (zaten açıksa hata vermez)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. Atomic günlük quota kontrolü
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_and_increment_generation(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile    profiles%ROWTYPE;
  FREE_LIMIT   CONSTANT int := 3;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO profiles (id) VALUES (p_user_id) ON CONFLICT (id) DO NOTHING;
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;
  END IF;

  IF v_profile.daily_reset_at IS NULL OR v_profile.daily_reset_at < CURRENT_DATE THEN
    UPDATE profiles SET daily_generations = 0, daily_reset_at = CURRENT_DATE WHERE id = p_user_id;
    v_profile.daily_generations := 0;
  END IF;

  IF v_profile.is_premium OR v_profile.daily_generations < FREE_LIMIT THEN
    UPDATE profiles SET daily_generations = daily_generations + 1 WHERE id = p_user_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ============================================================
-- 3. Webhook için pending_generations tablosu
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pending_generations (
  prediction_id TEXT        PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pending_generations ENABLE ROW LEVEL SECURITY;
-- Yalnızca service role erişir — kullanıcı politikası yok
