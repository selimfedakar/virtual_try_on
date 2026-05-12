import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export interface ProfileData {
  photoUri: string | null;
  name: string;
  height: string;
  weight: string;
  gender: string;
}

interface ProfileContextType {
  profile: ProfileData;
  updatePhoto: (uri: string) => Promise<void>;
  updateProfile: (data: Partial<ProfileData>) => Promise<void>;
}

const defaultProfile: ProfileData = {
  photoUri: null,
  name: '',
  height: '',
  weight: '',
  gender: 'Male',
};

const ProfileContext = createContext<ProfileContextType>({
  profile: defaultProfile,
  updatePhoto: async () => {},
  updateProfile: async () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ProfileData>(defaultProfile);

  useEffect(() => {
    loadProfile();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') loadProfile();
      if (event === 'SIGNED_OUT') setProfile(defaultProfile);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async () => {
    // Load local cache first so UI is immediate
    try {
      const cached = await AsyncStorage.getItem('antigravity_profile');
      if (cached) setProfile(JSON.parse(cached));
    } catch {}

    // Then sync from Supabase (overwrites local with server truth)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('name, height, weight, gender, avatar_url')
        .eq('id', user.id)
        .single();

      if (error || !data) return;

      const merged: ProfileData = {
        photoUri: data.avatar_url ?? null,
        name: data.name ?? '',
        height: data.height ?? '',
        weight: data.weight ?? '',
        gender: data.gender ?? 'Male',
      };
      setProfile(merged);
      await AsyncStorage.setItem('antigravity_profile', JSON.stringify(merged)).catch(() => {});
    } catch {}
  };

  const persistLocally = async (updated: ProfileData) => {
    setProfile(updated);
    await AsyncStorage.setItem('antigravity_profile', JSON.stringify(updated)).catch(() => {});
  };

  const persistToSupabase = async (updated: ProfileData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('profiles').upsert({
        id: user.id,
        name: updated.name || null,
        height: updated.height || null,
        weight: updated.weight || null,
        gender: updated.gender || 'Male',
        avatar_url: updated.photoUri || null,
        updated_at: new Date().toISOString(),
      });
    } catch {}
  };

  const updatePhoto = async (uri: string) => {
    const updated = { ...profile, photoUri: uri };
    await persistLocally(updated);
    await persistToSupabase(updated);
  };

  const updateProfile = async (data: Partial<ProfileData>) => {
    const updated = { ...profile, ...data };
    await persistLocally(updated);
    await persistToSupabase(updated);
  };

  return (
    <ProfileContext.Provider value={{ profile, updatePhoto, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
