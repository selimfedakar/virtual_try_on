import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    AsyncStorage.getItem('antigravity_profile').then(stored => {
      if (stored) setProfile(JSON.parse(stored));
    }).catch(() => {});
  }, []);

  const save = async (updated: ProfileData) => {
    setProfile(updated);
    await AsyncStorage.setItem('antigravity_profile', JSON.stringify(updated)).catch(() => {});
  };

  const updatePhoto = async (uri: string) => {
    await save({ ...profile, photoUri: uri });
  };

  const updateProfile = async (data: Partial<ProfileData>) => {
    const updated = { ...profile, ...data };
    await save(updated);
  };

  return (
    <ProfileContext.Provider value={{ profile, updatePhoto, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
