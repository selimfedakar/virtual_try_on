-- ─────────────────────────────────────────────
-- 1. generations table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.generations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    base_image_url TEXT NOT NULL,
    garment_image_url TEXT NOT NULL,
    garment_title TEXT,
    generated_image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generations" ON public.generations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generations" ON public.generations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 2. profiles table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users PRIMARY KEY,
    name TEXT,
    height TEXT,
    weight TEXT,
    gender TEXT DEFAULT 'Male',
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Auto-create an empty profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────
-- 3. try-ons Storage bucket
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
    VALUES ('try-ons', 'try-ons', true)
    ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload try-ons" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'try-ons' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Try-on images are publicly readable" ON storage.objects
    FOR SELECT USING (bucket_id = 'try-ons');

CREATE POLICY "Users can delete their own try-ons" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'try-ons' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────
-- 4. avatars Storage bucket (profile photos)
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
    VALUES ('avatars', 'avatars', true)
    ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Avatar images are publicly readable" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatar" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────
-- 5. Account deletion RPC (required by App Store)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_user_data()
RETURNS void AS $$
BEGIN
    DELETE FROM public.generations WHERE user_id = auth.uid();
    DELETE FROM public.profiles WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
