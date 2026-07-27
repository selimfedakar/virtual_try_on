import {
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity,
  Image, ScrollView, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useState } from 'react';
import React from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import AppHeader from '../../src/components/AppHeader';
import PaywallModal from '../../src/components/PaywallModal';
import { getSavedGarments, SavedGarment } from '../../src/lib/savedGarments';
import { track } from '../../src/lib/analytics';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://virtual-try-on-three-sage.vercel.app';
const STYLIST_TIMEOUT_MS = 60_000;

interface GarmentAnalysis {
  type: string;
  colors: string[];
  style: string;
}

interface StylistSuggestion {
  title: string;
  description: string;
  occasion: string;
  pairing: string;
}

interface StylistResult {
  garmentAnalysis: GarmentAnalysis;
  suggestions: StylistSuggestion[];
}

type StylistError = 'limit' | 'unavailable' | 'network' | 'generic';

async function compressToBase64(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 768 } }],
    { compress: 0.75, format: SaveFormat.JPEG, base64: true },
  );
  return result.base64!;
}

export default function Stylist() {
  const router = useRouter();
  const [garmentUri, setGarmentUri] = useState<string | null>(null);
  const [lastSavedGarment, setLastSavedGarment] = useState<SavedGarment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<StylistResult | null>(null);
  const [error, setError] = useState<StylistError | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Keep the "reuse last garment" shortcut fresh whenever the tab is focused
  useFocusEffect(
    React.useCallback(() => {
      getSavedGarments().then(garments => {
        setLastSavedGarment(garments[0] ?? null);
      });
    }, [])
  );

  const pickGarment = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Photo library access is required to pick a garment.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!picked.canceled) {
      setGarmentUri(picked.assets[0].uri);
      setResult(null);
      setError(null);
    }
  };

  const useLastGarment = () => {
    if (!lastSavedGarment) return;
    setGarmentUri(lastSavedGarment.uri);
    setResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!garmentUri || isLoading) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const base64 = await compressToBase64(garmentUri);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), STYLIST_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(`${BACKEND_URL}/api/stylist`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            garmentImage: `data:image/jpeg;base64,${base64}`,
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      const data = await response.json();

      if (data?.error === 'daily_limit_reached' || response.status === 429) {
        setError('limit');
        return;
      }
      if (data?.error === 'stylist_unavailable' || response.status === 503) {
        setError('unavailable');
        return;
      }
      if (!data?.success || !data?.data?.garmentAnalysis || !Array.isArray(data?.data?.suggestions)) {
        setError('generic');
        return;
      }

      setResult(data.data as StylistResult);
      track('stylist_used');
    } catch (err: any) {
      const isNetworkError =
        err?.name === 'AbortError' ||
        err?.message?.toLowerCase?.().includes('network') ||
        err?.message?.toLowerCase?.().includes('fetch');
      setError(isNetworkError ? 'network' : 'generic');
    } finally {
      setIsLoading(false);
    }
  };

  const renderError = () => {
    if (!error) return null;
    if (error === 'limit') {
      return (
        <View style={styles.errorCard}>
          <Text style={styles.errorEmoji}>⏳</Text>
          <Text style={styles.errorTitle}>Daily limit reached</Text>
          <Text style={styles.errorText}>
            You've used all your free stylist requests for today. Come back tomorrow —
            or go Premium for unlimited styling advice.
          </Text>
          <TouchableOpacity style={styles.errorPrimaryBtn} onPress={() => setShowPaywall(true)}>
            <Text style={styles.errorPrimaryBtnText}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (error === 'unavailable') {
      return (
        <View style={styles.errorCard}>
          <Text style={styles.errorEmoji}>🔧</Text>
          <Text style={styles.errorTitle}>Stylist is warming up</Text>
          <Text style={styles.errorText}>
            The AI Stylist is temporarily unavailable. Please try again in a few minutes.
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorEmoji}>📡</Text>
        <Text style={styles.errorTitle}>
          {error === 'network' ? 'Connection failed' : 'Something went wrong'}
        </Text>
        <Text style={styles.errorText}>
          {error === 'network'
            ? 'Could not reach the server. Check your internet connection and try again.'
            : 'We could not analyze this garment. Please try again.'}
        </Text>
        <TouchableOpacity style={styles.errorRetryBtn} onPress={handleAnalyze}>
          <Text style={styles.errorRetryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <AppHeader />

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onUpgraded={() => {
          setShowPaywall(false);
          setError(null);
          Alert.alert('Welcome to Premium!', 'Unlimited stylist advice activated. Enjoy!');
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>AI Stylist</Text>
          <Text style={styles.subtitle}>Real AI analysis of your garment + 3 personal outfit ideas</Text>
        </View>

        {/* Garment picker */}
        <View style={styles.imageContainer}>
          {garmentUri ? (
            <TouchableOpacity style={{ flex: 1 }} onPress={pickGarment} disabled={isLoading}>
              <Image source={{ uri: garmentUri }} style={styles.image} />
              <View style={styles.changeOverlay}>
                <Text style={styles.changeText}>Tap to change garment</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.placeholder} onPress={pickGarment}>
              <Text style={styles.placeholderEmoji}>👕</Text>
              <Text style={styles.placeholderText}>Tap to pick a garment</Text>
              <Text style={styles.placeholderSub}>Choose from your gallery</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Reuse last saved garment */}
        {lastSavedGarment && lastSavedGarment.uri !== garmentUri && (
          <TouchableOpacity style={styles.lastGarmentRow} onPress={useLastGarment} disabled={isLoading}>
            <Image source={{ uri: lastSavedGarment.uri }} style={styles.lastGarmentThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lastGarmentTitle}>Use your last garment</Text>
              <Text style={styles.lastGarmentSub}>From your Closet</Text>
            </View>
            <Text style={styles.lastGarmentArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Analyze CTA */}
        {garmentUri && !result && !isLoading && (
          <TouchableOpacity style={styles.primaryButton} onPress={handleAnalyze}>
            <Text style={styles.primaryButtonText}>✨ Get AI Style Advice</Text>
          </TouchableOpacity>
        )}

        {isLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingTitle}>Analyzing your garment...</Text>
            <Text style={styles.loadingSub}>The AI is studying colors, cut and style. ~10 seconds.</Text>
          </View>
        )}

        {renderError()}

        {result && (
          <View style={styles.resultsSection}>
            {/* Garment analysis card */}
            <View style={styles.analysisCard}>
              <Text style={styles.analysisLabel}>GARMENT ANALYSIS</Text>
              <View style={styles.analysisRow}>
                <View style={styles.analysisCell}>
                  <Text style={styles.analysisCellLabel}>TYPE</Text>
                  <Text style={styles.analysisCellValue}>{result.garmentAnalysis.type}</Text>
                </View>
                <View style={styles.analysisCell}>
                  <Text style={styles.analysisCellLabel}>STYLE</Text>
                  <Text style={styles.analysisCellValue}>{result.garmentAnalysis.style}</Text>
                </View>
              </View>
              <Text style={styles.analysisCellLabel}>COLORS</Text>
              <View style={styles.chipRow}>
                {result.garmentAnalysis.colors.map((color, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{color}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Suggestions */}
            <Text style={styles.resultsHeader}>3 Ways to Wear It</Text>
            {result.suggestions.map((s, i) => (
              <View key={i} style={styles.suggestionCard}>
                <View style={styles.suggestionTopRow}>
                  <Text style={styles.suggestionTitle}>{s.title}</Text>
                  <View style={styles.occasionBadge}>
                    <Text style={styles.occasionText}>{s.occasion}</Text>
                  </View>
                </View>
                <Text style={styles.suggestionDesc}>{s.description}</Text>
                {!!s.pairing && (
                  <View style={styles.pairingRow}>
                    <Text style={styles.pairingLabel}>PAIRS WITH</Text>
                    <Text style={styles.pairingText}>{s.pairing}</Text>
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => { setGarmentUri(null); setResult(null); setError(null); }}
            >
              <Text style={styles.resetButtonText}>Try Another Garment</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { padding: 24, paddingBottom: 110 },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#ffffff' },
  subtitle: { fontSize: 14, color: '#a1a1aa', fontWeight: '500', marginTop: 4, lineHeight: 20 },

  imageContainer: {
    height: 320, borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#0a1520', borderWidth: 1.5, borderColor: '#1e4878', marginBottom: 14,
  },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderEmoji: { fontSize: 48 },
  placeholderText: { color: '#c0d8f0', fontSize: 16, fontWeight: '600' },
  placeholderSub: { color: '#4a80a8', fontSize: 13 },
  changeOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, alignItems: 'center',
  },
  changeText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },

  lastGarmentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0a1b2e', borderRadius: 16, padding: 10,
    borderWidth: 1, borderColor: '#1e4878', marginBottom: 14,
  },
  lastGarmentThumb: { width: 44, height: 58, borderRadius: 10, resizeMode: 'cover' },
  lastGarmentTitle: { color: '#d0e8f8', fontSize: 14, fontWeight: '600' },
  lastGarmentSub: { color: '#4a80a8', fontSize: 12, marginTop: 2 },
  lastGarmentArrow: { color: '#4a80a8', fontSize: 22, paddingRight: 6 },

  primaryButton: {
    backgroundColor: '#ffffff', padding: 20, borderRadius: 100,
    alignItems: 'center', marginBottom: 8,
  },
  primaryButtonText: { color: '#000000', fontSize: 17, fontWeight: 'bold' },

  loadingBox: { marginTop: 28, alignItems: 'center', paddingHorizontal: 20 },
  loadingTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 6 },
  loadingSub: { color: '#888888', fontSize: 13, textAlign: 'center', lineHeight: 19 },

  errorCard: {
    backgroundColor: '#111111', borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center', marginTop: 12,
  },
  errorEmoji: { fontSize: 34, marginBottom: 10 },
  errorTitle: { color: '#ffffff', fontSize: 17, fontWeight: 'bold', marginBottom: 8 },
  errorText: { color: '#a1a1aa', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  errorPrimaryBtn: {
    backgroundColor: '#ffffff', borderRadius: 100, paddingVertical: 14,
    paddingHorizontal: 28, alignItems: 'center',
  },
  errorPrimaryBtnText: { color: '#000000', fontSize: 15, fontWeight: 'bold' },
  errorRetryBtn: {
    borderRadius: 100, paddingVertical: 12, paddingHorizontal: 28,
    borderWidth: 1, borderColor: '#3f3f46',
  },
  errorRetryText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },

  resultsSection: { marginTop: 12 },
  analysisCard: {
    backgroundColor: '#0a1b2e', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#1e4878', marginBottom: 22,
  },
  analysisLabel: {
    color: '#4a90d0', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 14,
  },
  analysisRow: { flexDirection: 'row', gap: 20, marginBottom: 14 },
  analysisCell: { flex: 1 },
  analysisCellLabel: {
    color: '#4a80a8', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4,
  },
  analysisCellValue: { color: '#ffffff', fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    backgroundColor: 'rgba(74,144,208,0.12)', borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(74,144,208,0.3)',
  },
  chipText: { color: '#7eb8d6', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

  resultsHeader: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 14 },
  suggestionCard: {
    backgroundColor: '#111111', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#1f1f1f', marginBottom: 14,
  },
  suggestionTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, marginBottom: 10,
  },
  suggestionTitle: { fontSize: 17, fontWeight: 'bold', color: '#ffffff', flexShrink: 1 },
  occasionBadge: {
    backgroundColor: '#0a1b2e', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#1e4878',
  },
  occasionText: { color: '#7eb8d6', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  suggestionDesc: { color: '#d4d4d8', fontSize: 14, lineHeight: 21, marginBottom: 12 },
  pairingRow: {
    backgroundColor: '#0a0a0a', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#1f1f1f',
  },
  pairingLabel: { color: '#52525b', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  pairingText: { color: '#a1a1aa', fontSize: 13, lineHeight: 19 },

  resetButton: {
    backgroundColor: '#18181b', padding: 18, borderRadius: 100,
    alignItems: 'center', borderWidth: 1, borderColor: '#27272a', marginTop: 6,
  },
  resetButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
