import {
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity,
  Image, ScrollView, ActivityIndicator, Share, FlatList, TextInput, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { captureRef } from 'react-native-view-shot';
import { supabase } from '../../src/lib/supabase';
import AppHeader from '../../src/components/AppHeader';
import { track } from '../../src/lib/analytics';

interface Generation {
  id: string;
  generated_image_url: string;
  created_at: string;
}

interface SharedLook {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  likes_count: number;
  views_count: number;
  created_at: string;
}

interface StyleChallenge {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
}

const BRANDING_LINE = 'Created with AI Try-On · Try it yourself!';

const CAPTIONS = [
  "New fit just landed 🔥 Virtual try-on is actually changing everything.",
  "POV: You found your new favourite outfit without leaving the house 🏠✨",
  "Tried it virtually. Buying it in real life. No debate.",
];

const HASHTAGS = '#OOTD #VirtualTryOn #FashionTech #StyleInspo #OutfitCheck #AIFashion #FitCheck';

export default function ShareScreen() {
  const router = useRouter();
  const [tryOns, setTryOns] = useState<Generation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [selected, setSelected] = useState<Generation | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [caption] = useState(() => CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)]);

  // Watermark capture
  const watermarkRef = useRef<View>(null);
  const [watermarkReady, setWatermarkReady] = useState(false);

  // Community
  const [communityLooks, setCommunityLooks] = useState<SharedLook[]>([]);
  const [communityError, setCommunityError] = useState(false);
  const [challenge, setChallenge] = useState<StyleChallenge | null>(null);
  const [postCaption, setPostCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const viewedIds = useRef<Set<string>>(new Set());

  useFocusEffect(
    React.useCallback(() => {
      loadTryOns();
      loadCommunity();
    }, [])
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setTryOns([]);
        setSelected(null);
        setCommunityLooks([]);
        setChallenge(null);
        setLikedIds(new Set());
        setIsGuest(true);
      } else if (event === 'SIGNED_IN') {
        setIsGuest(false);
        loadTryOns();
        loadCommunity();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Re-arm the watermark whenever the selected look changes
  useEffect(() => { setWatermarkReady(false); }, [selected?.id]);

  const loadTryOns = async () => {
    setLoadingList(true);
    setLoadError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsGuest(true); setLoadingList(false); return; }
      setIsGuest(false);
      const { data, error } = await supabase
        .from('generations')
        .select('id, generated_image_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      if (data) {
        const valid = data.filter((g: Generation) => g.generated_image_url);
        setTryOns(valid);
        if (valid.length > 0 && !selected) setSelected(valid[0]);
      }
    } catch {
      setLoadError(true);
    }
    setLoadingList(false);
  };

  const loadCommunity = async () => {
    setCommunityError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [looksRes, challengesRes] = await Promise.all([
        supabase
          .from('shared_looks')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('style_challenges').select('*'),
      ]);

      if (looksRes.error) throw looksRes.error;
      const looks: SharedLook[] = looksRes.data ?? [];
      setCommunityLooks(looks);

      // Record a view once per look per session (fire and forget)
      looks.forEach(look => {
        if (!viewedIds.current.has(look.id)) {
          viewedIds.current.add(look.id);
          supabase.rpc('record_look_view', { p_look_id: look.id }).then(() => {}, () => {});
        }
      });

      if (!challengesRes.error && challengesRes.data) {
        const now = Date.now();
        const active = (challengesRes.data as StyleChallenge[]).find(c =>
          new Date(c.starts_at).getTime() <= now && new Date(c.ends_at).getTime() >= now,
        );
        setChallenge(active ?? null);
      }
    } catch {
      setCommunityError(true);
    }
  };

  // ── B6: share a branded, watermarked image file ─────────────────────
  const handleShare = async () => {
    if (!selected) return;
    setIsSharing(true);
    const message = `${caption}\n\n${BRANDING_LINE}\n\n${HASHTAGS}`;
    try {
      let shareUrl = selected.generated_image_url;
      if (watermarkReady && watermarkRef.current) {
        try {
          // Capture the offscreen branded card to a local file — on iOS,
          // sharing a local file url shares the actual image.
          shareUrl = await captureRef(watermarkRef, {
            format: 'jpg',
            quality: 0.92,
            result: 'tmpfile',
            width: 1080,
            height: 1440,
          });
        } catch {
          // Capture failed — fall back to sharing the plain remote URL.
          shareUrl = selected.generated_image_url;
        }
      }
      await Share.share({ message, url: shareUrl });
      track('look_shared');
    } catch {}
    setIsSharing(false);
  };

  // ── C5: community actions ────────────────────────────────────────────
  const handlePostToCommunity = async () => {
    if (!selected) {
      Alert.alert('No look selected', 'Generate a try-on first, then share it with the community.');
      return;
    }
    setIsPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }

      const { data, error } = await supabase
        .from('shared_looks')
        .insert({
          user_id: user.id,
          image_url: selected.generated_image_url,
          caption: postCaption.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;

      if (data) setCommunityLooks(prev => [data as SharedLook, ...prev]);
      setPostCaption('');
      Alert.alert('Posted!', 'Your look is now live in the community.');
    } catch {
      Alert.alert('Post failed', 'Could not post your look. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleToggleLike = async (look: SharedLook) => {
    const wasLiked = likedIds.has(look.id);
    // Optimistic update
    setLikedIds(prev => {
      const next = new Set(prev);
      if (wasLiked) next.delete(look.id); else next.add(look.id);
      return next;
    });
    setCommunityLooks(prev => prev.map(l =>
      l.id === look.id ? { ...l, likes_count: Math.max(0, l.likes_count + (wasLiked ? -1 : 1)) } : l,
    ));

    const { data, error } = await supabase.rpc('toggle_look_like', { p_look_id: look.id });
    if (error) {
      // Revert on failure
      setLikedIds(prev => {
        const next = new Set(prev);
        if (wasLiked) next.add(look.id); else next.delete(look.id);
        return next;
      });
      setCommunityLooks(prev => prev.map(l =>
        l.id === look.id ? { ...l, likes_count: Math.max(0, l.likes_count + (wasLiked ? 1 : -1)) } : l,
      ));
    } else if (typeof data === 'boolean') {
      // Reconcile with the server's answer
      setLikedIds(prev => {
        const next = new Set(prev);
        if (data) next.add(look.id); else next.delete(look.id);
        return next;
      });
    }
  };

  const handleJoinChallenge = () => {
    if (!challenge) return;
    if (!selected) {
      Alert.alert('No look yet', 'Generate a try-on first, then join the challenge by posting it.');
      return;
    }
    setPostCaption(prev => prev || `#${challenge.title.replace(/\s+/g, '')}`);
    handlePostToCommunity();
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

      {/* Offscreen branded card for watermark capture (must stay mounted) */}
      {selected && (
        <View
          ref={watermarkRef}
          collapsable={false}
          style={styles.watermarkCard}
        >
          <Image
            source={{ uri: selected.generated_image_url }}
            style={styles.watermarkImage}
            onLoad={() => setWatermarkReady(true)}
          />
          <View style={styles.watermarkBadge}>
            <Text style={styles.watermarkBadgeText}>VTO · Virtual Try-On</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>Share</Text>
          <Text style={styles.subtitle}>Share your AI try-on to social media</Text>
        </View>

        {/* ── Select Try-On ── */}
        <Text style={styles.label}>Select your AI Try-On to share</Text>

        {isGuest ? (
          <View style={styles.emptyThumbRow}>
            <Text style={[styles.emptyThumbText, { marginBottom: 12 }]}>
              Sign in to share your AI try-ons with the world.
            </Text>
            <TouchableOpacity onPress={() => router.push('/auth')}>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700', backgroundColor: '#27272a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, overflow: 'hidden' }}>Sign In / Create Account</Text>
            </TouchableOpacity>
          </View>
        ) : loadingList ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#ffffff" />
          </View>
        ) : loadError ? (
          <View style={styles.emptyThumbRow}>
            <Text style={styles.emptyThumbText}>
              Failed to load try-ons. Check your connection and pull to retry.
            </Text>
            <TouchableOpacity onPress={loadTryOns} style={{ marginTop: 10 }}>
              <Text style={{ color: '#4a90d0', fontSize: 13, fontWeight: '600' }}>Try Again</Text>
            </TouchableOpacity>
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
            <View style={styles.previewWatermark}>
              <Text style={styles.previewWatermarkText}>VTO · Virtual Try-On</Text>
            </View>
            <View style={styles.brandingBadge}>
              <Text style={styles.brandingText}>Shared with a small VTO badge — as previewed</Text>
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
              {caption}
            </Text>
            <Text style={styles.captionPreviewBranding}>{BRANDING_LINE}</Text>
            <Text style={styles.captionPreviewHashtags}>{HASHTAGS}</Text>
          </View>
        )}

        {/* ── Community ── */}
        <View style={styles.communityHeader}>
          <Text style={styles.communityTitle}>Community</Text>
          <Text style={styles.communitySubtitle}>Post your look, get likes from other stylists</Text>
        </View>

        {isGuest ? (
          <View style={styles.emptyThumbRow}>
            <Text style={[styles.emptyThumbText, { marginBottom: 12 }]}>
              Sign in to post looks and browse the community.
            </Text>
            <TouchableOpacity onPress={() => router.push('/auth')}>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700', backgroundColor: '#27272a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, overflow: 'hidden' }}>Sign In / Create Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Style challenge banner */}
            {challenge && (
              <View style={styles.challengeBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.challengeLabel}>STYLE CHALLENGE</Text>
                  <Text style={styles.challengeTitle}>{challenge.title}</Text>
                  <Text style={styles.challengeDesc} numberOfLines={2}>{challenge.description}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.challengeJoinBtn, isPosting && { opacity: 0.6 }]}
                  onPress={handleJoinChallenge}
                  disabled={isPosting}
                >
                  <Text style={styles.challengeJoinText}>Join</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Post current look */}
            {selected && (
              <View style={styles.postCard}>
                <TextInput
                  style={styles.postCaptionInput}
                  placeholder="Add a caption (optional)"
                  placeholderTextColor="#52525b"
                  value={postCaption}
                  onChangeText={setPostCaption}
                  maxLength={140}
                />
                <TouchableOpacity
                  style={[styles.postBtn, isPosting && { opacity: 0.6 }]}
                  onPress={handlePostToCommunity}
                  disabled={isPosting}
                >
                  {isPosting
                    ? <ActivityIndicator color="#000" />
                    : <Text style={styles.postBtnText}>Post selected look to Community</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* Recent looks */}
            {communityError ? (
              <View style={styles.emptyThumbRow}>
                <Text style={styles.emptyThumbText}>Could not load community looks.</Text>
                <TouchableOpacity onPress={loadCommunity} style={{ marginTop: 10 }}>
                  <Text style={{ color: '#4a90d0', fontSize: 13, fontWeight: '600' }}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : communityLooks.length === 0 ? (
              <View style={styles.emptyThumbRow}>
                <Text style={styles.emptyThumbText}>
                  No community looks yet — be the first to post!
                </Text>
              </View>
            ) : (
              communityLooks.map(look => (
                <View key={look.id} style={styles.lookCard}>
                  <Image source={{ uri: look.image_url }} style={styles.lookImage} resizeMode="cover" />
                  {!!look.caption && <Text style={styles.lookCaption}>{look.caption}</Text>}
                  <View style={styles.lookFooter}>
                    <TouchableOpacity style={styles.likeBtn} onPress={() => handleToggleLike(look)}>
                      <Text style={styles.likeIcon}>{likedIds.has(look.id) ? '❤️' : '🤍'}</Text>
                      <Text style={styles.likeCount}>{look.likes_count}</Text>
                    </TouchableOpacity>
                    <Text style={styles.viewCount}>👁 {look.views_count}</Text>
                    <Text style={styles.lookDate}>
                      {new Date(look.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
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
    minHeight: 110, backgroundColor: '#0d0d0d', borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#1a1a1a', paddingHorizontal: 20, paddingVertical: 16, marginBottom: 20,
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

  // Offscreen watermark capture card (3:4, rendered out of view)
  watermarkCard: {
    position: 'absolute', left: -1200, top: 0,
    width: 360, height: 480, backgroundColor: '#000000',
  },
  watermarkImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  watermarkBadge: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  watermarkBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

  previewCard: {
    borderRadius: 24, overflow: 'hidden', backgroundColor: '#141414',
    borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 16,
    aspectRatio: 3 / 4,
  },
  previewImage: { width: '100%', height: '100%' },
  previewWatermark: {
    position: 'absolute', bottom: 52, right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  previewWatermarkText: { color: '#ffffff', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
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
    borderWidth: 1, borderColor: '#1a1a1a', gap: 6, marginBottom: 28,
  },
  captionPreviewLabel: {
    color: '#3f3f46', fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    marginBottom: 4,
  },
  captionPreviewText: { color: '#a1a1aa', fontSize: 13, lineHeight: 20 },
  captionPreviewBranding: { color: '#71717a', fontSize: 12, fontStyle: 'italic' },
  captionPreviewHashtags: { color: '#3b82f6', fontSize: 12, lineHeight: 18 },

  // Community
  communityHeader: { marginBottom: 14, marginTop: 4 },
  communityTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  communitySubtitle: { fontSize: 13, color: '#71717a', marginTop: 3 },

  challengeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0a1b2e', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#1e4878', marginBottom: 14,
  },
  challengeLabel: { color: '#4a90d0', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  challengeTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  challengeDesc: { color: '#7eb8d6', fontSize: 12, marginTop: 3, lineHeight: 17 },
  challengeJoinBtn: {
    backgroundColor: '#ffffff', borderRadius: 100,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  challengeJoinText: { color: '#000000', fontSize: 14, fontWeight: 'bold' },

  postCard: {
    backgroundColor: '#0d0d0d', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#1a1a1a', marginBottom: 18, gap: 10,
  },
  postCaptionInput: {
    backgroundColor: '#000000', borderWidth: 1, borderColor: '#27272a',
    borderRadius: 12, padding: 12, color: '#ffffff', fontSize: 14,
  },
  postBtn: {
    backgroundColor: '#ffffff', borderRadius: 100, paddingVertical: 14,
    alignItems: 'center',
  },
  postBtnText: { color: '#000000', fontSize: 14, fontWeight: 'bold' },

  lookCard: {
    backgroundColor: '#0d0d0d', borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: '#1a1a1a', marginBottom: 14,
  },
  lookImage: { width: '100%', aspectRatio: 3 / 4 },
  lookCaption: { color: '#d4d4d8', fontSize: 13, lineHeight: 19, paddingHorizontal: 14, paddingTop: 10 },
  lookFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeIcon: { fontSize: 16 },
  likeCount: { color: '#a1a1aa', fontSize: 13, fontWeight: '600' },
  viewCount: { color: '#52525b', fontSize: 12 },
  lookDate: { color: '#3f3f46', fontSize: 11, marginLeft: 'auto' },
});
