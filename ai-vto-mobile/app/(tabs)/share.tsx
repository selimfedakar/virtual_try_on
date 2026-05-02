import {
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity,
  Image, ScrollView, ActivityIndicator, Share, FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useFocusEffect } from 'expo-router';
import React from 'react';
import { supabase } from '../../src/lib/supabase';
import AppHeader from '../../src/components/AppHeader';

interface Generation {
  id: string;
  generated_image_url: string;
  created_at: string;
}

const BRANDING_LINE = 'Created with AI Try-On · Try it yourself!';

const CAPTIONS = [
  "New fit just landed 🔥 Virtual try-on is actually changing everything.",
  "POV: You found your new favourite outfit without leaving the house 🏠✨",
  "Tried it virtually. Buying it in real life. No debate.",
];

const HASHTAGS = '#OOTD #VirtualTryOn #FashionTech #StyleInspo #OutfitCheck #AIFashion #FitCheck';

export default function ShareScreen() {
  const [tryOns, setTryOns] = useState<Generation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<Generation | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadTryOns();
    }, [])
  );

  const loadTryOns = async () => {
    setLoadingList(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('generations')
          .select('id, generated_image_url, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (data) {
          const valid = data.filter((g: Generation) => g.generated_image_url);
          setTryOns(valid);
          if (valid.length > 0 && !selected) setSelected(valid[0]);
        }
      }
    } catch {}
    setLoadingList(false);
  };

  const handleShare = async () => {
    if (!selected) return;
    setIsSharing(true);
    try {
      const caption = CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];
      await Share.share({
        message: `${caption}\n\n${BRANDING_LINE}\n\n${HASHTAGS}`,
        url: selected.generated_image_url,
      });
    } catch {}
    setIsSharing(false);
  };

  const renderThumb = ({ item }: { item: Generation }) => {
    const isActive = selected?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.thumb, isActive && styles.thumbActive]}
        onPress={() => setSelected(item)}
      >
        <Image source={{ uri: item.generated_image_url }} style={styles.thumbImg} />
        {isActive && <View style={styles.thumbCheck}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text></View>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>Share</Text>
          <Text style={styles.subtitle}>Share your AI try-on to social media</Text>
        </View>

        {/* ── Select Try-On ── */}
        <Text style={styles.label}>Select your AI Try-On to share</Text>

        {loadingList ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#ffffff" />
          </View>
        ) : tryOns.length === 0 ? (
          <View style={styles.emptyThumbRow}>
            <Text style={styles.emptyThumbText}>
              No try-ons yet — generate one on the Try On tab first.
            </Text>
          </View>
        ) : (
          <FlatList
            data={tryOns}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderThumb}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbList}
            scrollEnabled
          />
        )}

        {/* ── Preview Card ── */}
        {selected && (
          <View style={styles.previewCard}>
            <Image
              source={{ uri: selected.generated_image_url }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <View style={styles.brandingBadge}>
              <Text style={styles.brandingText}>{BRANDING_LINE}</Text>
            </View>
          </View>
        )}

        {/* ── Share Button ── */}
        {selected && (
          <TouchableOpacity
            style={[styles.shareBtn, isSharing && { opacity: 0.7 }]}
            onPress={handleShare}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.shareBtnIcon}>↗</Text>
                <Text style={styles.shareBtnText}>Share to WhatsApp, Instagram &amp; more</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {selected && (
          <Text style={styles.shareHint}>
            A caption and hashtags are included automatically.
          </Text>
        )}

        {/* ── Caption Preview ── */}
        {selected && (
          <View style={styles.captionPreview}>
            <Text style={styles.captionPreviewLabel}>INCLUDED CAPTION</Text>
            <Text style={styles.captionPreviewText}>
              {CAPTIONS[0]}
            </Text>
            <Text style={styles.captionPreviewBranding}>{BRANDING_LINE}</Text>
            <Text style={styles.captionPreviewHashtags}>{HASHTAGS}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#ffffff' },
  subtitle: { fontSize: 14, color: '#71717a', marginTop: 3 },

  label: {
    fontSize: 13, fontWeight: '700', color: '#a1a1aa',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12,
  },

  loadingRow: { height: 110, alignItems: 'center', justifyContent: 'center' },
  emptyThumbRow: {
    height: 110, backgroundColor: '#0d0d0d', borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#1a1a1a', paddingHorizontal: 20, marginBottom: 20,
  },
  emptyThumbText: { color: '#52525b', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  thumbList: { paddingBottom: 4, gap: 10, marginBottom: 20 },
  thumb: {
    width: 90, height: 120, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#141414', borderWidth: 2, borderColor: '#2a2a2a',
  },
  thumbActive: { borderColor: '#ffffff', borderWidth: 2.5 },
  thumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbCheck: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },

  previewCard: {
    borderRadius: 24, overflow: 'hidden', backgroundColor: '#141414',
    borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 16,
    aspectRatio: 3 / 4,
  },
  previewImage: { width: '100%', height: '100%' },
  brandingBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.72)', paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center',
  },
  brandingText: { color: '#d4d4d8', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },

  shareBtn: {
    backgroundColor: '#ffffff', borderRadius: 100, paddingVertical: 18,
    paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 10, marginBottom: 10,
  },
  shareBtnIcon: { fontSize: 20, color: '#000000', fontWeight: '700' },
  shareBtnText: { fontSize: 16, fontWeight: 'bold', color: '#000000' },

  shareHint: {
    color: '#52525b', fontSize: 12, textAlign: 'center', marginBottom: 20,
  },

  captionPreview: {
    backgroundColor: '#0d0d0d', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#1a1a1a', gap: 6,
  },
  captionPreviewLabel: {
    color: '#3f3f46', fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    marginBottom: 4,
  },
  captionPreviewText: { color: '#a1a1aa', fontSize: 13, lineHeight: 20 },
  captionPreviewBranding: { color: '#71717a', fontSize: 12, fontStyle: 'italic' },
  captionPreviewHashtags: { color: '#3b82f6', fontSize: 12, lineHeight: 18 },
});
