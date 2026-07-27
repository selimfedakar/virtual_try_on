import {
  StyleSheet, Text, View, SafeAreaView,
  Image, ActivityIndicator, TouchableOpacity, ScrollView, Dimensions,
  Alert, Switch, Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../src/lib/supabase';
import { useState, useEffect } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import AppHeader from '../../src/components/AppHeader';
import {
  getSavedGarments, deleteGarment, setGarmentCategory,
  SavedGarment, GarmentCategory, CATEGORY_LABELS,
} from '../../src/lib/savedGarments';
import { getOutfits, saveOutfit, deleteOutfit, SavedOutfit } from '../../src/lib/outfits';
import {
  isDailyOutfitReminderEnabled, enableDailyOutfitReminder, disableDailyOutfitReminder,
} from '../../src/lib/notifications';
import { track } from '../../src/lib/analytics';

const { width } = Dimensions.get('window');
const COL_GAP = 12;
const PADDING = 12;
const ITEM_SIZE = (width - PADDING * 2 - COL_GAP) / 2;

const FILTERS: { key: 'all' | GarmentCategory; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tops', label: 'Tops' },
  { key: 'bottoms', label: 'Bottoms' },
  { key: 'one-piece', label: 'Full body' },
];

interface Generation {
  id: string;
  generated_image_url: string;
  garment_title: string;
  created_at: string;
}

export default function History() {
  const router = useRouter();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [garments, setGarments] = useState<SavedGarment[]>([]);
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [tryOnError, setTryOnError] = useState(false);
  const [selected, setSelected] = useState<Generation | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  // Closet 2.0
  const [filter, setFilter] = useState<'all' | GarmentCategory>('all');
  const [building, setBuilding] = useState(false);
  const [buildTop, setBuildTop] = useState<SavedGarment | null>(null);
  const [buildBottom, setBuildBottom] = useState<SavedGarment | null>(null);
  const [reminderOn, setReminderOn] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchAll();
    }, [])
  );

  useEffect(() => {
    isDailyOutfitReminderEnabled().then(setReminderOn);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setGenerations([]);
        setGarments([]);
        setOutfits([]);
        setIsGuest(true);
      } else if (event === 'SIGNED_IN') {
        setIsGuest(false);
        fetchAll();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchTryOns(), fetchGarments(), fetchOutfits()]);
    setLoading(false);
  };

  const fetchTryOns = async () => {
    setTryOnError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsGuest(true); return; }
      setIsGuest(false);
      const { data, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      if (data) setGenerations(data.filter((g: Generation) => g.generated_image_url));
    } catch {
      setTryOnError(true);
    }
  };

  const fetchGarments = async () => {
    const saved = await getSavedGarments();
    setGarments(saved);
  };

  const fetchOutfits = async () => {
    const saved = await getOutfits();
    setOutfits(saved);
  };

  const handleDeleteGarment = async (id: string) => {
    const updated = await deleteGarment(id);
    setGarments(updated);
  };

  // ── Closet 2.0: category assignment ─────────────────────────────────
  const handleLongPressGarment = (item: SavedGarment) => {
    Alert.alert(
      'Garment category',
      'Categorize this garment to filter your closet and build outfits.',
      [
        ...(['tops', 'bottoms', 'one-piece'] as GarmentCategory[]).map(cat => ({
          text: `${CATEGORY_LABELS[cat]}${item.category === cat ? ' ✓' : ''}`,
          onPress: async () => setGarments(await setGarmentCategory(item.id, cat)),
        })),
        ...(item.category ? [{
          text: 'Remove category',
          onPress: async () => setGarments(await setGarmentCategory(item.id, null)),
        }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  // ── Closet 2.0: outfit builder ──────────────────────────────────────
  const startBuilding = () => {
    const hasTop = garments.some(g => g.category === 'tops');
    const hasBottom = garments.some(g => g.category === 'bottoms');
    if (!hasTop || !hasBottom) {
      Alert.alert(
        'Categorize first',
        'You need at least one Top and one Bottom in your closet. Long-press a garment to set its category.',
      );
      return;
    }
    setBuildTop(null);
    setBuildBottom(null);
    setBuilding(true);
  };

  const handleBuildPick = (item: SavedGarment) => {
    if (item.category === 'tops') setBuildTop(item);
    else if (item.category === 'bottoms') setBuildBottom(item);
    else if (item.category === 'one-piece') {
      Alert.alert('Full-body item', 'Outfits combine a Top with a Bottom. Full-body garments are already a complete look.');
    } else {
      Alert.alert('No category', 'Long-press this garment first to set its category.');
    }
  };

  const handleSaveOutfit = async () => {
    if (!buildTop || !buildBottom) return;
    const updated = await saveOutfit(buildTop.id, buildBottom.id);
    setOutfits(updated);
    setBuilding(false);
    setBuildTop(null);
    setBuildBottom(null);
    track('outfit_created');
  };

  const handleDeleteOutfit = async (id: string) => {
    setOutfits(await deleteOutfit(id));
  };

  const garmentById = (id: string) => garments.find(g => g.id === id);

  // ── Daily reminder toggle ───────────────────────────────────────────
  const handleReminderToggle = async (value: boolean) => {
    if (value) {
      const ok = await enableDailyOutfitReminder();
      if (!ok) {
        Alert.alert(
          'Notifications disabled',
          'Enable notifications for VTO in Settings to get a daily outfit reminder.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
        setReminderOn(false);
        return;
      }
      setReminderOn(true);
      track('daily_reminder_toggled', { enabled: true });
    } else {
      await disableDailyOutfitReminder();
      setReminderOn(false);
      track('daily_reminder_toggled', { enabled: false });
    }
  };

  const visibleGarments = filter === 'all'
    ? garments
    : garments.filter(g => g.category === filter);

  // Detail view for try-ons
  if (selected) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle}>Past Try-On</Text>
          <View style={{ width: 60 }} />
        </View>
        <Image source={{ uri: selected.generated_image_url }} style={styles.detailImage} />
        <View style={styles.detailInfo}>
          <Text style={styles.detailDate}>
            Tried on{' '}
            {new Date(selected.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <AppHeader />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Your Last Try-Ons ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Last Try-Ons</Text>
            <Text style={styles.sectionCount}>{generations.length}</Text>
          </View>

          {isGuest ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyEmoji}>🔒</Text>
              <Text style={styles.emptyTitle}>Sign in to see your try-ons</Text>
              <Text style={styles.emptySub}>Create an account to save and view your generated looks.</Text>
              <TouchableOpacity onPress={() => router.push('/auth')} style={{ marginTop: 14 }}>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700', backgroundColor: '#27272a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, overflow: 'hidden' }}>Sign In / Create Account</Text>
              </TouchableOpacity>
            </View>
          ) : tryOnError ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyEmoji}>⚠️</Text>
              <Text style={styles.emptyTitle}>Failed to load</Text>
              <Text style={styles.emptySub}>Check your connection.</Text>
              <TouchableOpacity onPress={fetchAll} style={{ marginTop: 10 }}>
                <Text style={{ color: '#4a90d0', fontSize: 13, fontWeight: '600' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : generations.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyEmoji}>👗</Text>
              <Text style={styles.emptyTitle}>No try-ons yet</Text>
              <Text style={styles.emptySub}>Generate your first look on the Try On tab.</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {generations.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.gridItem}
                  onPress={() => setSelected(item)}
                >
                  <Image
                    source={{ uri: item.generated_image_url }}
                    style={styles.image}
                  />
                  <View style={styles.itemOverlay}>
                    <Text style={styles.itemDate}>
                      {new Date(item.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short',
                      })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── My Outfits ── */}
          <View style={[styles.sectionHeader, { marginTop: 28 }]}>
            <Text style={styles.sectionTitle}>My Outfits</Text>
            <TouchableOpacity onPress={building ? () => setBuilding(false) : startBuilding}>
              <Text style={styles.actionLink}>{building ? 'Cancel' : '+ Create outfit'}</Text>
            </TouchableOpacity>
          </View>

          {building && (
            <View style={styles.builderCard}>
              <Text style={styles.builderTitle}>Build an outfit</Text>
              <Text style={styles.builderSub}>Tap a Top and a Bottom below to pair them.</Text>
              <View style={styles.builderSlots}>
                <View style={styles.builderSlot}>
                  {buildTop
                    ? <Image source={{ uri: buildTop.uri }} style={styles.builderSlotImg} />
                    : <Text style={styles.builderSlotLabel}>👕 Top</Text>}
                </View>
                <Text style={styles.builderPlus}>＋</Text>
                <View style={styles.builderSlot}>
                  {buildBottom
                    ? <Image source={{ uri: buildBottom.uri }} style={styles.builderSlotImg} />
                    : <Text style={styles.builderSlotLabel}>👖 Bottom</Text>}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.builderSaveBtn, !(buildTop && buildBottom) && { opacity: 0.35 }]}
                onPress={handleSaveOutfit}
                disabled={!(buildTop && buildBottom)}
              >
                <Text style={styles.builderSaveText}>Save Outfit</Text>
              </TouchableOpacity>
            </View>
          )}

          {outfits.length === 0 && !building ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyEmoji}>🧥</Text>
              <Text style={styles.emptyTitle}>No outfits yet</Text>
              <Text style={styles.emptySub}>
                Pair a top with a bottom from your closet. Long-press garments to categorize them first.
              </Text>
            </View>
          ) : (
            outfits.map(outfit => {
              const top = garmentById(outfit.topId);
              const bottom = garmentById(outfit.bottomId);
              if (!top || !bottom) return null;
              return (
                <View key={outfit.id} style={styles.outfitCard}>
                  <Image source={{ uri: top.uri }} style={styles.outfitImg} />
                  <Text style={styles.outfitPlus}>＋</Text>
                  <Image source={{ uri: bottom.uri }} style={styles.outfitImg} />
                  <View style={styles.outfitMeta}>
                    <Text style={styles.outfitDate}>
                      {new Date(outfit.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Text>
                    <TouchableOpacity onPress={() => handleDeleteOutfit(outfit.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.outfitDelete}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* ── My Garments ── */}
          <View style={[styles.sectionHeader, { marginTop: 28 }]}>
            <Text style={styles.sectionTitle}>My Garments</Text>
            <Text style={styles.sectionCount}>{garments.length}</Text>
          </View>

          {garments.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text style={filter === f.key ? styles.filterTextOn : styles.filterTextOff}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {garments.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyEmoji}>👕</Text>
              <Text style={styles.emptyTitle}>No garments saved</Text>
              <Text style={styles.emptySub}>
                Every garment you pick on the Try On tab is saved here automatically.
              </Text>
            </View>
          ) : visibleGarments.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyEmoji}>🔎</Text>
              <Text style={styles.emptyTitle}>Nothing in this category</Text>
              <Text style={styles.emptySub}>Long-press a garment to assign it a category.</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {visibleGarments.map((item) => {
                const isPicked = building && (buildTop?.id === item.id || buildBottom?.id === item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.gridItem, isPicked && styles.gridItemPicked]}
                    activeOpacity={building ? 0.7 : 1}
                    onPress={() => building && handleBuildPick(item)}
                    onLongPress={() => !building && handleLongPressGarment(item)}
                  >
                    <Image source={{ uri: item.uri }} style={styles.image} />
                    {!building && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeleteGarment(item.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    )}
                    {item.category && (
                      <View style={styles.categoryTag}>
                        <Text style={styles.categoryTagText}>{CATEGORY_LABELS[item.category]}</Text>
                      </View>
                    )}
                    <View style={styles.itemOverlay}>
                      <Text style={styles.itemDate}>
                        {new Date(item.addedAt).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short',
                        })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {garments.length > 0 && (
            <Text style={styles.categoryHint}>Long-press a garment to set its category</Text>
          )}

          {/* ── Daily reminder ── */}
          <View style={styles.reminderCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderTitle}>Daily outfit reminder</Text>
              <Text style={styles.reminderSub}>A gentle 9:00 AM nudge — "what are you wearing today?"</Text>
            </View>
            <Switch
              value={reminderOn}
              onValueChange={handleReminderToggle}
              trackColor={{ false: '#27272a', true: '#4a90d0' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { paddingHorizontal: PADDING, paddingTop: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  sectionCount: {
    fontSize: 13, fontWeight: '600', color: '#52525b',
    backgroundColor: '#18181b', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 100, borderWidth: 1, borderColor: '#27272a',
    overflow: 'hidden',
  },
  actionLink: { color: '#4a90d0', fontSize: 14, fontWeight: '700' },

  emptyBlock: {
    alignItems: 'center', paddingVertical: 28, backgroundColor: '#0d0d0d',
    borderRadius: 16, borderWidth: 1, borderColor: '#1a1a1a', marginBottom: 4,
  },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { color: '#ffffff', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  emptySub: { color: '#52525b', fontSize: 13, textAlign: 'center', paddingHorizontal: 24, lineHeight: 18 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: COL_GAP,
  },
  gridItem: {
    width: ITEM_SIZE, aspectRatio: 3 / 4, backgroundColor: '#141414',
    borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a',
  },
  gridItemPicked: { borderColor: '#ffffff', borderWidth: 2.5 },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  itemOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6,
  },
  itemDate: { color: '#a1a1aa', fontSize: 11, fontWeight: '600' },
  deleteBtn: {
    position: 'absolute', top: 8, right: 8, zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12,
    width: 24, height: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#3f3f46',
  },
  deleteBtnText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },

  categoryTag: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(10,27,46,0.85)', borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#1e4878',
  },
  categoryTagText: { color: '#7eb8d6', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  categoryHint: { color: '#484848', fontSize: 10, textAlign: 'center', marginTop: 10 },

  filterRow: { gap: 8, paddingBottom: 12 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100,
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a',
  },
  filterChipActive: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  filterTextOn: { color: '#000000', fontSize: 13, fontWeight: '700' },
  filterTextOff: { color: '#a1a1aa', fontSize: 13, fontWeight: '600' },

  builderCard: {
    backgroundColor: '#0a1b2e', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#1e4878', marginBottom: 14,
  },
  builderTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  builderSub: { color: '#7eb8d6', fontSize: 12, marginTop: 3, marginBottom: 14 },
  builderSlots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 },
  builderSlot: {
    width: 90, height: 120, borderRadius: 14, overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1.5, borderColor: '#2a5a8a',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
  },
  builderSlotImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  builderSlotLabel: { color: '#4a80a8', fontSize: 13, fontWeight: '600' },
  builderPlus: { color: '#4a90d0', fontSize: 22, fontWeight: '700' },
  builderSaveBtn: {
    backgroundColor: '#ffffff', borderRadius: 100, paddingVertical: 13, alignItems: 'center',
  },
  builderSaveText: { color: '#000000', fontSize: 14, fontWeight: 'bold' },

  outfitCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0d0d0d', borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: '#1a1a1a', marginBottom: 10,
  },
  outfitImg: {
    width: 72, height: 96, borderRadius: 12,
    backgroundColor: '#141414', resizeMode: 'cover',
  },
  outfitPlus: { color: '#3f3f46', fontSize: 18, fontWeight: '700' },
  outfitMeta: { flex: 1, alignItems: 'flex-end', gap: 8 },
  outfitDate: { color: '#52525b', fontSize: 11, fontWeight: '600' },
  outfitDelete: { color: '#ef4444', fontSize: 12, fontWeight: '600' },

  reminderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0d0d0d', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#1a1a1a', marginTop: 24,
  },
  reminderTitle: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  reminderSub: { color: '#52525b', fontSize: 12, marginTop: 3, lineHeight: 17 },

  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { paddingVertical: 4 },
  backText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  detailTitle: { color: '#ffffff', fontSize: 17, fontWeight: 'bold' },
  detailImage: { width: '100%', flex: 1, resizeMode: 'contain', backgroundColor: '#0a0a0a' },
  detailInfo: { padding: 20, borderTopWidth: 1, borderTopColor: '#111111' },
  detailDate: { color: '#52525b', fontSize: 14, textAlign: 'center' },
});
