import {
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity,
  Image, ScrollView, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useState, useEffect } from 'react';
import { supabase } from '../../src/lib/supabase';
import { useRouter } from 'expo-router';
import { useProfile } from '../../src/context/ProfileContext';
import { uploadProfilePhoto } from '../../src/lib/storage';

function isValidHeight(v: string) {
  const n = parseFloat(v);
  return v === '' || (!isNaN(n) && n >= 50 && n <= 250);
}
function isValidWeight(v: string) {
  const n = parseFloat(v);
  return v === '' || (!isNaN(n) && n >= 20 && n <= 300);
}

export default function Profile() {
  const router = useRouter();
  const { profile, updatePhoto, updateProfile } = useProfile();

  const [email, setEmail] = useState('');
  const [name, setName] = useState(profile.name);
  const [height, setHeight] = useState(profile.height);
  const [weight, setWeight] = useState(profile.weight);
  const [gender, setGender] = useState(profile.gender || 'Male');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

  useEffect(() => {
    setName(profile.name);
    setHeight(profile.height);
    setWeight(profile.weight);
    setGender(profile.gender || 'Male');
  }, [profile]);

  const pickProfilePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled) {
      const localUri = result.assets[0].uri;
      setUploadingPhoto(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const cloudUrl = await uploadProfilePhoto(localUri, user.id);
          await updatePhoto(cloudUrl);
        } else {
          await updatePhoto(localUri);
        }
      } catch {
        await updatePhoto(localUri);
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  const handleSave = async () => {
    if (height && !isValidHeight(height)) {
      Alert.alert('Invalid height', 'Please enter a height between 50 and 250 cm.');
      return;
    }
    if (weight && !isValidWeight(weight)) {
      Alert.alert('Invalid weight', 'Please enter a weight between 20 and 300 kg.');
      return;
    }
    setSaving(true);
    await updateProfile({ name, height, weight, gender });
    setSaving(false);
    Alert.alert('Saved', 'Your profile has been updated.');
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/auth');
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete all your try-ons and profile data. This action cannot be undone.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await supabase.rpc('delete_user_data');
              await supabase.auth.signOut();
              router.replace('/auth');
            } catch {
              Alert.alert('Error', 'Failed to delete your account. Please try again or contact support.');
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Profile Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile Photo */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoCircle} onPress={pickProfilePhoto} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <View style={styles.photoPlaceholder}>
                <ActivityIndicator color="#ffffff" />
              </View>
            ) : profile.photoUri ? (
              <Image source={{ uri: profile.photoUri }} style={styles.photoImage} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderIcon}>📷</Text>
                <Text style={styles.photoPlaceholderText}>Add Photo</Text>
              </View>
            )}
            {!uploadingPhoto && (
              <View style={styles.cameraBadge}>
                <Text style={{ fontSize: 14 }}>📷</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.photoHint}>Tap to upload from your phone</Text>
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.fieldBox}>
              <Text style={styles.fieldReadOnly}>{email || 'Loading...'}</Text>
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#52525b"
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Body Measurements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Body Measurements</Text>
          <Text style={styles.sectionNote}>Used for fit analysis and size recommendations.</Text>

          <View style={styles.rowFields}>
            <View style={[styles.field, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.fieldLabel}>Height (cm)</Text>
              <TextInput
                style={styles.fieldInput}
                value={height}
                onChangeText={setHeight}
                placeholder="e.g. 175 cm"
                placeholderTextColor="#52525b"
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Weight (kg)</Text>
              <TextInput
                style={styles.fieldInput}
                value={weight}
                onChangeText={setWeight}
                placeholder="e.g. 70 kg"
                placeholderTextColor="#52525b"
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.toggleRow}>
              {(['Male', 'Female', 'Other'] as const).map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.toggleBtn, gender === g && styles.toggleActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={gender === g ? styles.toggleTextOn : styles.toggleTextOff}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={[styles.deleteAccountButton, deletingAccount && { opacity: 0.6 }]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount
              ? <ActivityIndicator color="#ef4444" />
              : <Text style={styles.deleteAccountText}>Delete My Account</Text>
            }
          </TouchableOpacity>
          <Text style={styles.dangerNote}>
            Permanently deletes all your try-ons and profile data.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  topBarTitle: { color: '#ffffff', fontSize: 17, fontWeight: 'bold' },
  scroll: { padding: 24, paddingBottom: 100 },

  photoSection: { alignItems: 'center', marginBottom: 32 },
  photoCircle: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: '#18181b', borderWidth: 2, borderColor: '#3f3f46',
    overflow: 'hidden', marginBottom: 10, position: 'relative',
  },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoPlaceholderIcon: { fontSize: 36 },
  photoPlaceholderText: { color: '#a1a1aa', fontSize: 13, fontWeight: '600' },
  cameraBadge: {
    position: 'absolute', bottom: 6, right: 6,
    backgroundColor: '#ffffff', borderRadius: 14, width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  photoHint: { color: '#52525b', fontSize: 13 },

  section: {
    backgroundColor: '#111111', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#1a1a1a', marginBottom: 16,
  },
  sectionTitle: { color: '#ffffff', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  sectionNote: { color: '#52525b', fontSize: 12, marginBottom: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { color: '#a1a1aa', fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5 },
  fieldBox: {
    backgroundColor: '#000000', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 12, padding: 14,
  },
  fieldReadOnly: { color: '#52525b', fontSize: 15 },
  fieldInput: {
    backgroundColor: '#000000', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 12, padding: 14, color: '#ffffff', fontSize: 15,
  },
  rowFields: { flexDirection: 'row' },
  toggleRow: {
    flexDirection: 'row', backgroundColor: '#000000',
    borderRadius: 12, borderWidth: 1, borderColor: '#27272a', overflow: 'hidden',
  },
  toggleBtn: { flex: 1, padding: 14, alignItems: 'center' },
  toggleActive: { backgroundColor: '#ffffff' },
  toggleTextOn: { color: '#000000', fontSize: 14, fontWeight: '600' },
  toggleTextOff: { color: '#a1a1aa', fontSize: 14, fontWeight: '600' },

  saveButton: {
    backgroundColor: '#ffffff', padding: 18, borderRadius: 100,
    alignItems: 'center', marginBottom: 14,
  },
  saveButtonText: { color: '#000000', fontSize: 17, fontWeight: 'bold' },
  logoutButton: {
    backgroundColor: 'transparent', padding: 18, borderRadius: 100,
    alignItems: 'center', borderWidth: 1, borderColor: '#3f3f46',
    marginBottom: 32,
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },

  dangerSection: {
    borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 24,
    alignItems: 'center',
  },
  dangerTitle: {
    color: '#3f3f46', fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 14,
  },
  deleteAccountButton: {
    paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: 100, borderWidth: 1, borderColor: '#3f1a1a',
    backgroundColor: '#0a0000', marginBottom: 8,
  },
  deleteAccountText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  dangerNote: { color: '#3f3f46', fontSize: 12, textAlign: 'center' },
});
