import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Modal, Alert, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useProfile } from '../context/ProfileContext';
import { supabase } from '../lib/supabase';

const NAV_ITEMS = [
  { label: 'Try On', icon: '📸', route: '/(tabs)/home' },
  { label: 'Fit Analysis', icon: '📏', route: '/(tabs)/analysis' },
  { label: 'My Closet', icon: '👕', route: '/(tabs)/history' },
  { label: 'AI Stylist', icon: '🪄', route: '/(tabs)/stylist' },
  { label: 'Share & Analyze', icon: '✨', route: '/(tabs)/share' },
  { label: 'Profile Settings', icon: '⚙️', route: '/(tabs)/profile' },
] as const;

export default function AppHeader() {
  const router = useRouter();
  const { profile } = useProfile();
  const [showDrawer, setShowDrawer] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const confirmLogout = () => {
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

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setShowDrawer(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.hamburger}>☰</Text>
        </TouchableOpacity>

        <Text style={styles.logo}>Virtual Try-On</Text>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setShowProfileMenu(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {profile.photoUri ? (
            <Image source={{ uri: profile.photoUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarDefault}>
              <Text style={{ fontSize: 16 }}>👤</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Side Drawer */}
      <Modal
        visible={showDrawer}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDrawer(false)}
      >
        <Pressable style={styles.drawerOverlay} onPress={() => setShowDrawer(false)}>
          <Pressable style={styles.drawer} onPress={e => e.stopPropagation()}>
            <View style={styles.drawerTop}>
              {profile.photoUri ? (
                <Image source={{ uri: profile.photoUri }} style={styles.drawerAvatar} />
              ) : (
                <View style={[styles.drawerAvatar, styles.drawerAvatarDefault]}>
                  <Text style={{ fontSize: 32 }}>👤</Text>
                </View>
              )}
              <Text style={styles.drawerBrand}>Virtual Try-On</Text>
              <Text style={styles.drawerSub}>AI Fashion Studio</Text>
            </View>

            <View style={{ flex: 1 }}>
              {NAV_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={styles.drawerItem}
                  onPress={() => {
                    setShowDrawer(false);
                    router.navigate(item.route as any);
                  }}
                >
                  <Text style={styles.drawerItemIcon}>{item.icon}</Text>
                  <Text style={styles.drawerItemLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.drawerItem, styles.drawerLogout]}
              onPress={() => { setShowDrawer(false); confirmLogout(); }}
            >
              <Text style={styles.drawerItemIcon}>🚪</Text>
              <Text style={[styles.drawerItemLabel, { color: '#ef4444' }]}>Log Out</Text>
            </TouchableOpacity>

            <Text style={styles.drawerTagline}>
              _fedakar's product, always for something better!
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Profile Quick Menu */}
      <Modal
        visible={showProfileMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowProfileMenu(false)}>
          <View style={styles.profileMenu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowProfileMenu(false);
                router.navigate('/(tabs)/profile' as any);
              }}
            >
              <Text style={styles.menuItemText}>⚙️  Profile Settings</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowProfileMenu(false); confirmLogout(); }}
            >
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>🚪  Log Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    backgroundColor: '#000000',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hamburger: { fontSize: 24, color: '#ffffff' },
  logo: { fontSize: 15, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#ffffff' },
  avatarDefault: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#27272a',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#3f3f46',
  },
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', flexDirection: 'row' },
  drawer: {
    width: '78%', backgroundColor: '#080808', borderRightWidth: 1,
    borderRightColor: '#1a1a1a', paddingTop: 56, paddingBottom: 20,
  },
  drawerTop: {
    alignItems: 'center', paddingBottom: 24, borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a', marginBottom: 12, paddingHorizontal: 24,
  },
  drawerAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  drawerAvatarDefault: {
    backgroundColor: '#18181b', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#27272a',
  },
  drawerBrand: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  drawerSub: { fontSize: 11, color: '#52525b', marginTop: 3 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24, gap: 14 },
  drawerLogout: { borderTopWidth: 1, borderTopColor: '#1a1a1a', marginTop: 4 },
  drawerItemIcon: { fontSize: 19, width: 26, textAlign: 'center' },
  drawerItemLabel: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
  drawerTagline: {
    color: '#4a4a4a', fontSize: 10, textAlign: 'center',
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 4, fontStyle: 'italic',
    letterSpacing: 0.3,
  },
  menuOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 92, paddingRight: 16,
  },
  profileMenu: {
    backgroundColor: '#18181b', borderRadius: 16, borderWidth: 1,
    borderColor: '#27272a', minWidth: 210, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16,
  },
  menuItem: { paddingVertical: 16, paddingHorizontal: 20 },
  menuItemText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  menuDivider: { height: 1, backgroundColor: '#27272a' },
});
