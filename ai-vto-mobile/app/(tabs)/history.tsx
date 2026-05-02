import {
  StyleSheet, Text, View, SafeAreaView, FlatList,
  Image, ActivityIndicator, TouchableOpacity, ScrollView, Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../src/lib/supabase';
import { useState } from 'react';
import { useFocusEffect } from 'expo-router';
import React from 'react';
import AppHeader from '../../src/components/AppHeader';
import { getSavedGarments, deleteGarment, SavedGarment } from '../../src/lib/savedGarments';

const { width } = Dimensions.get('window');
const COL_GAP = 12;
const PADDING = 12;
const ITEM_SIZE = (width - PADDING * 2 - COL_GAP) / 2;

interface Generation {
  id: string;
  generated_image_url: string;
  garment_title: string;
  created_at: string;
}

export default function History() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [garments, setGarments] = useState<SavedGarment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Generation | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchAll();
    }, [])
  );

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchTryOns(), fetchGarments()]);
    setLoading(false);
  };

  const fetchTryOns = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('generations')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (!error && data) {
          setGenerations(data.filter((g: Generation) => g.generated_image_url));
        }
      }
    } catch {}
  };

  const fetchGarments = async () => {
    const saved = await getSavedGarments();
    setGarments(saved);
  };

  const handleDeleteGarment = async (id: string) => {
    const updated = await deleteGarment(id);
    setGarments(updated);
  };

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

          {generations.length === 0 ? (
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

          {/* ── My Garments ── */}
          <View style={[styles.sectionHeader, { marginTop: 28 }]}>
            <Text style={styles.sectionTitle}>My Garments</Text>
            <Text style={styles.sectionCount}>{garments.length}</Text>
          </View>

          {garments.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyEmoji}>👕</Text>
              <Text style={styles.emptyTitle}>No garments saved</Text>
              <Text style={styles.emptySub}>
                Every garment you pick on the Try On tab is saved here automatically.
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {garments.map((item) => (
                <View key={item.id} style={styles.gridItem}>
                  <Image source={{ uri: item.uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteGarment(item.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                  <View style={styles.itemOverlay}>
                    <Text style={styles.itemDate}>
                      {new Date(item.addedAt).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short',
                      })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

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
