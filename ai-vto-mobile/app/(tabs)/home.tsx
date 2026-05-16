import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, TouchableOpacity, Image,
  SafeAreaView, ScrollView, ActivityIndicator, Alert, Animated,
  Modal, Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useState, useRef, useEffect } from 'react';
import React from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import AppHeader from '../../src/components/AppHeader';
import PaywallModal from '../../src/components/PaywallModal';
import {
  getSavedPhotos, savePhoto, deletePhoto, SavedPhoto,
} from '../../src/lib/savedPhotos';
import { uploadTryOnImage } from '../../src/lib/storage';
import { saveGarment } from '../../src/lib/savedGarments';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://virtual-try-on-three-sage.vercel.app';
const GENERATE_TIMEOUT_MS = 30_000;
const REALTIME_TIMEOUT_MS = 180_000;

const STEPS = [
  { num: '1', icon: '📷', label: 'Your Photo' },
  { num: '2', icon: '👕', label: 'Garment' },
  { num: '3', icon: '🤖', label: 'AI Generate' },
  { num: '4', icon: '✨', label: 'Result' },
];

async function compressToBase64(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 768 } }],
    { compress: 0.75, format: SaveFormat.JPEG, base64: true },
  );
  return result.base64!;
}

export default function Home() {
  const [savedPhotos, setSavedPhotos] = useState<SavedPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<SavedPhoto | null>(null);
  const [garmentUri, setGarmentUri] = useState<string | null>(null);
  const [garmentBase64, setGarmentBase64] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<SavedPhoto | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const scanAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  // Reload photos whenever the tab is focused (covers login/switch-user scenarios)
  useFocusEffect(
    React.useCallback(() => { loadPhotos(); }, [])
  );

  // Clear all in-memory state immediately on logout so the next user never
  // sees the previous user's photos/garments/results in React state.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setSavedPhotos([]);
        setSelectedPhoto(null);
        setGarmentUri(null);
        setGarmentBase64(null);
        setResultImage(null);
      } else if (event === 'SIGNED_IN') {
        loadPhotos();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!resultImage) return;
    const scan = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1600, useNativeDriver: true }),
      ])
    );
    scan.start(); glow.start();
    return () => { scan.stop(); glow.stop(); };
  }, [resultImage]);

  const loadPhotos = async () => {
    const photos = await getSavedPhotos();
    setSavedPhotos(photos);
    if (photos.length > 0) setSelectedPhoto(photos[0]);
  };

  const addFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3, 4], quality: 0.8 });
    if (!result.canceled) {
      const saved = await savePhoto(result.assets[0].uri);
      setSavedPhotos(prev => [saved, ...prev]);
      setSelectedPhoto(saved);
      setResultImage(null);
    }
  };

  const addFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 4], quality: 0.8,
    });
    if (!result.canceled) {
      const saved = await savePhoto(result.assets[0].uri);
      setSavedPhotos(prev => [saved, ...prev]);
      setSelectedPhoto(saved);
      setResultImage(null);
    }
  };

  const handleDeletePhoto = async (photo: SavedPhoto) => {
    const updated = await deletePhoto(photo.id);
    setSavedPhotos(updated);
    if (selectedPhoto?.id === photo.id) setSelectedPhoto(updated[0] ?? null);
    setShowDeleteModal(null);
  };

  const pickGarment = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 4], quality: 0.5,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setGarmentUri(uri);
      setResultImage(null);
      saveGarment(uri).catch(() => {});
      compressToBase64(uri).then(b64 => setGarmentBase64(b64)).catch(() => {});
    }
  };

  const handleGenerate = async () => {
    if (!selectedPhoto || !garmentBase64) return;
    setIsGenerating(true);
    setResultImage(null);
    setLoadingStep('Sending to AI...');

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let realtimeTimeout: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      channel?.unsubscribe();
      if (realtimeTimeout) clearTimeout(realtimeTimeout);
      if (pollInterval) clearInterval(pollInterval);
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Session expired', 'Please sign in again.');
        setIsGenerating(false);
        setLoadingStep('');
        return;
      }

      const [personBase64, garmentCompressed] = await Promise.all([
        compressToBase64(selectedPhoto.uri),
        Promise.resolve(garmentBase64),
      ]);

      const controller = new AbortController();
      const requestTimeout = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(`${BACKEND_URL}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            baseImage: `data:image/jpeg;base64,${personBase64}`,
            garments: [{ image: `data:image/jpeg;base64,${garmentCompressed}`, title: 'Mobile Upload' }],
          }),
        });
      } finally {
        clearTimeout(requestTimeout);
      }

      const data = await response.json();

      // Quota exceeded → show paywall
      if (!data.success && data.error === 'daily_limit_reached') {
        setShowPaywall(true);
        setIsGenerating(false);
        setLoadingStep('');
        return;
      }

      if (!data.success) throw new Error(data.error ?? 'Backend returned an error');

      const predictionId: string = data.data.predictionId;
      setLoadingStep('AI is generating your look...');

      // Subscribe to Supabase Realtime — webhook broadcasts result instantly
      channel = supabase
        .channel(`generation:${session.user.id}`)
        .on('broadcast', { event: 'completed' }, ({ payload }) => {
          if (payload.predictionId !== predictionId) return;

          cleanup();
          setResultImage(payload.imageUrl);
          setGarmentUri(null);
          setGarmentBase64(null);
          setIsGenerating(false);
          setLoadingStep('');
        })
        .subscribe();

      // Polling fallback — fires every 10s if Realtime broadcast doesn't arrive
      let pollAttempts = 0;
      pollInterval = setInterval(async () => {
        pollAttempts++;
        if (pollAttempts > 18) return; // max 3 min
        try {
          const res = await fetch(`${BACKEND_URL}/api/predictions/${predictionId}`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          });
          const d = await res.json();
          if (d.success && d.status === 'succeeded' && d.data?.generatedImage) {
            cleanup();
            setResultImage(d.data.generatedImage);
            setGarmentUri(null);
            setGarmentBase64(null);
            setIsGenerating(false);
            setLoadingStep('');
          } else if (d.success && d.status === 'failed') {
            cleanup();
            Alert.alert('Error', 'AI generation failed. Please try again.');
            setIsGenerating(false);
            setLoadingStep('');
          }
        } catch {}
      }, 10_000);

      // 3-minute safety timeout if neither Realtime nor polling delivers
      realtimeTimeout = setTimeout(() => {
        cleanup();
        setIsGenerating(false);
        setLoadingStep('');
        Alert.alert('Timed out', 'Generation took too long. Please try again.');
      }, REALTIME_TIMEOUT_MS);

      // Function returns here — result arrives via Realtime callback or polling above
      return;

    } catch (err: any) {
      cleanup();
      setIsGenerating(false);
      setLoadingStep('');

      const isNetworkError =
        err.name === 'AbortError' ||
        err.message?.toLowerCase().includes('network') ||
        err.message?.toLowerCase().includes('fetch');

      if (isNetworkError) {
        Alert.alert('Connection Failed', 'Could not reach the server. Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', err.message ?? 'Something went wrong.');
      }
    }
  };

  const handleSaveToLibrary = async () => {
    if (!resultImage) return;
    setIsSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is required to save images.');
        return;
      }
      const localUri = FileSystem.cacheDirectory + 'tryon_save.jpg';
      const { uri } = await FileSystem.downloadAsync(resultImage, localUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved!', 'Your try-on image has been saved to your photo library.');
    } catch {
      Alert.alert('Error', 'Could not save the image. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const canGenerate = selectedPhoto !== null && garmentBase64 !== null && !isGenerating;

  // ── Result / AR screen ──────────────────────────────────────────────
  if (resultImage) {
    const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 450] });
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <AppHeader />
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={styles.resultTopRow}>
            <Text style={styles.resultTitle}>Your New Look</Text>
            <View style={styles.arBadge}>
              <Animated.View style={[styles.arDot, { opacity: glowAnim }]} />
              <Text style={styles.arBadgeText}>LIVE PREVIEW</Text>
            </View>
          </View>
          <View style={styles.arFrame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <Image source={{ uri: resultImage }} style={styles.resultImage} />
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />
            <View style={styles.arFitBadge}>
              <Text style={styles.arFitText}>✓ FIT DETECTED</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setResultImage(null)}>
            <Text style={styles.primaryBtnText}>Try Another Outfit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveLibraryBtn, isSaving && { opacity: 0.6 }]}
            onPress={handleSaveToLibrary}
            disabled={isSaving}
          >
            {isSaving
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={styles.saveLibraryText}>⬇  Save to Camera Roll</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main screen ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <AppHeader />

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onUpgraded={() => { setShowPaywall(false); Alert.alert('Welcome to Premium!', 'Unlimited generations activated. Enjoy!'); }}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>

        {/* How it works guide */}
        <View style={styles.guideCard}>
          <Text style={styles.guideTitle}>HOW IT WORKS</Text>
          <View style={styles.guideRow}>
            {STEPS.map((step, i) => (
              <View key={i} style={styles.guideStepWrap}>
                <View style={styles.guideStep}>
                  <Text style={styles.guideStepNum}>{step.num}</Text>
                  <View style={styles.guideIconBg}>
                    <Text style={styles.guideIcon}>{step.icon}</Text>
                  </View>
                  <Text style={styles.guideLabel}>{step.label}</Text>
                </View>
                {i < STEPS.length - 1 && <Text style={styles.guideSep}>›</Text>}
              </View>
            ))}
          </View>
        </View>

        {/* My Photos */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Photos</Text>
          <View style={styles.addRow}>
            <TouchableOpacity style={styles.addBtn} onPress={addFromCamera}>
              <Text style={styles.addBtnText}>📸 Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={addFromGallery}>
              <Text style={styles.addBtnText}>🖼️ Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>

        {savedPhotos.length === 0 ? (
          <View style={styles.emptyPhotoCard}>
            <Text style={styles.emptyPhotoEmoji}>🤳</Text>
            <Text style={styles.emptyPhotoTitle}>Add your first photo</Text>
            <Text style={styles.emptyPhotoSub}>Your saved photos appear here for quick reuse</Text>
            <View style={styles.emptyPhotoActions}>
              <TouchableOpacity style={styles.addBtn} onPress={addFromCamera}>
                <Text style={styles.addBtnText}>📸 Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={addFromGallery}>
                <Text style={styles.addBtnText}>🖼️ Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosRow}>
            {savedPhotos.map(photo => {
              const isSelected = selectedPhoto?.id === photo.id;
              return (
                <TouchableOpacity
                  key={photo.id}
                  style={[styles.photoThumb, isSelected && styles.photoThumbSelected]}
                  onPress={() => { setSelectedPhoto(photo); setResultImage(null); }}
                  onLongPress={() => setShowDeleteModal(photo)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.thumbImg} />
                  {isSelected && (
                    <View style={styles.thumbCheck}><Text style={styles.thumbCheckText}>✓</Text></View>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.addThumb} onPress={addFromGallery}>
              <Text style={styles.addThumbIcon}>＋</Text>
              <Text style={styles.addThumbLabel}>Add</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {savedPhotos.length > 0 && (
          <Text style={styles.longPressHint}>Long-press a photo to remove it</Text>
        )}

        {/* Garment */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Garment</Text>
          {garmentUri && (
            <TouchableOpacity onPress={() => { setGarmentUri(null); setGarmentBase64(null); }}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.garmentCard}>
          {garmentUri ? (
            <TouchableOpacity style={{ flex: 1 }} onPress={pickGarment}>
              <Image source={{ uri: garmentUri }} style={styles.garmentImg} />
              <View style={styles.changeOverlay}>
                <Text style={styles.changeText}>Tap to change</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.garmentPlaceholder} onPress={pickGarment}>
              <Text style={styles.garmentPlaceholderEmoji}>👕</Text>
              <Text style={styles.garmentPlaceholderText}>Choose a garment from gallery</Text>
              <Text style={styles.garmentPlaceholderSub}>Saved automatically to your closet</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Generate */}
        <TouchableOpacity
          style={[styles.primaryBtn, !canGenerate && { opacity: 0.35 }]}
          onPress={handleGenerate}
          disabled={!canGenerate}
        >
          <Text style={styles.primaryBtnText}>🤖  Generate Try-On</Text>
        </TouchableOpacity>

        {!selectedPhoto && <Text style={styles.hintText}>Add or select a photo above to continue</Text>}
        {selectedPhoto && !garmentUri && <Text style={styles.hintText}>Choose a garment to continue</Text>}

        {isGenerating && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingTitle}>{loadingStep}</Text>
            <Text style={styles.loadingSubtitle}>This takes about 10–20 seconds.</Text>
          </View>
        )}
      </ScrollView>

      {/* Delete photo dialog */}
      <Modal visible={showDeleteModal !== null} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(null)}>
        <Pressable style={styles.deleteOverlay} onPress={() => setShowDeleteModal(null)}>
          <View style={styles.deleteDialog}>
            <Text style={styles.deleteTitle}>Remove Photo?</Text>
            <Text style={styles.deleteSub}>This photo will be removed from your saved list.</Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setShowDeleteModal(null)}>
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() => showDeleteModal && handleDeletePhoto(showDeleteModal)}
              >
                <Text style={styles.deleteConfirmText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const C = 22; const T = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },

  guideCard: {
    marginHorizontal: 16, marginTop: 14, marginBottom: 6,
    backgroundColor: '#0a1b2e', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#1e4878',
  },
  guideTitle: { color: '#4a90d0', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 14 },
  guideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  guideStepWrap: { flexDirection: 'row', alignItems: 'center' },
  guideStep: { alignItems: 'center', width: 66, position: 'relative' },
  guideStepNum: {
    position: 'absolute', top: -2, left: 4,
    color: '#3a7abf', fontSize: 9, fontWeight: '800', zIndex: 1,
  },
  guideIconBg: {
    width: 44, height: 44, borderRadius: 12, marginBottom: 7,
    backgroundColor: 'rgba(74,144,208,0.12)',
    borderWidth: 1, borderColor: 'rgba(74,144,208,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  guideIcon: { fontSize: 22 },
  guideLabel: { color: '#7eb8d6', fontSize: 9, fontWeight: '600', textAlign: 'center' },
  guideSep: { color: '#2a5a8a', fontSize: 18, paddingHorizontal: 2, marginBottom: 16 },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginTop: 20, marginBottom: 10,
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  clearText: { color: '#555', fontSize: 13, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8 },
  addBtn: {
    backgroundColor: '#1e2a38', borderRadius: 100, borderWidth: 1, borderColor: '#2e4a66',
    paddingHorizontal: 12, paddingVertical: 7,
  },
  addBtnText: { color: '#d0e8f8', fontSize: 12, fontWeight: '600' },

  emptyPhotoCard: {
    marginHorizontal: 16, backgroundColor: '#141414', borderRadius: 20, padding: 28,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a',
  },
  emptyPhotoEmoji: { fontSize: 40, marginBottom: 10 },
  emptyPhotoTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyPhotoSub: { color: '#666', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  emptyPhotoActions: { flexDirection: 'row', gap: 12 },

  photosRow: { paddingHorizontal: 16, gap: 10, paddingRight: 8 },
  photoThumb: {
    width: 82, height: 110, borderRadius: 14, overflow: 'hidden',
    borderWidth: 2, borderColor: '#2e2e2e',
  },
  photoThumbSelected: { borderColor: '#ffffff', borderWidth: 2.5 },
  thumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbCheck: {
    position: 'absolute', bottom: 5, right: 5,
    backgroundColor: '#fff', borderRadius: 10, width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbCheckText: { color: '#000', fontSize: 11, fontWeight: '900' },
  addThumb: {
    width: 82, height: 110, borderRadius: 14, borderWidth: 1.5,
    borderColor: '#3a3a3a', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addThumbIcon: { color: '#555', fontSize: 22 },
  addThumbLabel: { color: '#555', fontSize: 10, fontWeight: '600' },
  longPressHint: { color: '#484848', fontSize: 10, textAlign: 'center', marginTop: 8, marginBottom: 4 },

  garmentCard: {
    height: 300, marginHorizontal: 16, borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#0a1520', borderWidth: 1.5, borderColor: '#1e4878',
  },
  garmentImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  garmentPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  garmentPlaceholderEmoji: { fontSize: 44 },
  garmentPlaceholderText: { color: '#c0d8f0', fontSize: 15, fontWeight: '600' },
  garmentPlaceholderSub: { color: '#4a80a8', fontSize: 12 },
  changeOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)', padding: 12, alignItems: 'center',
  },
  changeText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  primaryBtn: {
    backgroundColor: '#ffffff', marginHorizontal: 16, marginTop: 20,
    padding: 20, borderRadius: 100, alignItems: 'center',
  },
  primaryBtnText: { color: '#000', fontSize: 17, fontWeight: 'bold' },
  hintText: { color: '#585858', fontSize: 12, textAlign: 'center', marginTop: 10 },

  loadingBox: { marginTop: 36, alignItems: 'center', paddingHorizontal: 30 },
  loadingTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginTop: 18, marginBottom: 8 },
  loadingSubtitle: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  loadingSignature: { color: '#c0392b', fontSize: 11, textAlign: 'center', marginTop: 14, fontStyle: 'italic', letterSpacing: 0.3 },

  resultTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
  },
  resultTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  arBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0d1a0d', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100, borderWidth: 1, borderColor: '#22c55e44',
  },
  arDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  arBadgeText: { color: '#22c55e', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  arFrame: {
    marginHorizontal: 16, borderRadius: 24, overflow: 'hidden',
    height: 500, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#2a2a2a',
    position: 'relative', marginBottom: 16,
  },
  resultImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  corner: { position: 'absolute', width: C, height: C, borderColor: '#fff', zIndex: 10 },
  tl: { top: 14, left: 14, borderTopWidth: T, borderLeftWidth: T, borderTopLeftRadius: 5 },
  tr: { top: 14, right: 14, borderTopWidth: T, borderRightWidth: T, borderTopRightRadius: 5 },
  bl: { bottom: 14, left: 14, borderBottomWidth: T, borderLeftWidth: T, borderBottomLeftRadius: 5 },
  br: { bottom: 14, right: 14, borderBottomWidth: T, borderRightWidth: T, borderBottomRightRadius: 5 },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.18)', zIndex: 5 },
  arFitBadge: {
    position: 'absolute', bottom: 14, left: 14,
    backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)', borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 5, zIndex: 10,
  },
  arFitText: { color: '#22c55e', fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  saveLibraryBtn: {
    marginHorizontal: 16, marginTop: 12, padding: 18, borderRadius: 100,
    alignItems: 'center', borderWidth: 1, borderColor: '#3f3f46',
    backgroundColor: 'transparent',
  },
  saveLibraryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },

  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  deleteDialog: { backgroundColor: '#181818', borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: '#2a2a2a' },
  deleteTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  deleteSub: { color: '#888', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  deleteActions: { flexDirection: 'row', gap: 12 },
  deleteCancelBtn: { flex: 1, padding: 14, borderRadius: 100, alignItems: 'center', backgroundColor: '#2a2a2a' },
  deleteCancelText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  deleteConfirmBtn: { flex: 1, padding: 14, borderRadius: 100, alignItems: 'center', backgroundColor: '#ef4444' },
  deleteConfirmText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
