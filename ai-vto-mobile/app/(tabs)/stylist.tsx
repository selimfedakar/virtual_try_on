import {
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity,
  Image, ScrollView, ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import AppHeader from '../../src/components/AppHeader';

interface OutfitCard {
  title: string;
  emoji: string;
  occasion: string;
  items: string[];
  accessories: string[];
  shoes: string;
  hair: string;
  tip: string;
}

const OUTFIT_SETS: OutfitCard[] = [
  {
    title: 'Casual Day Out',
    emoji: '☕',
    occasion: 'Weekend · Daytime',
    items: ['Blue jeans (slim or straight fit)', 'White or light grey t-shirt underneath'],
    accessories: ['Simple black or silver watch', 'Small crossbody bag'],
    shoes: 'White sneakers or clean white trainers',
    hair: 'Natural and relaxed. Keep it simple.',
    tip: 'Roll up your sleeves a little. It looks more relaxed and easy-going.',
  },
  {
    title: 'Smart Office Look',
    emoji: '💼',
    occasion: 'Work · Business Casual',
    items: ['Black or navy chinos (not jeans)', 'Tuck the garment in for a clean finish'],
    accessories: ['Brown leather belt', 'Classic watch (leather or metal strap)'],
    shoes: 'Brown leather shoes or loafers',
    hair: 'Neat and brushed. No loose hair.',
    tip: 'Add a dark blazer on top to make the outfit more formal if needed.',
  },
  {
    title: 'Night Out',
    emoji: '🌙',
    occasion: 'Evening · Going Out',
    items: ['Dark grey or black trousers', 'Black leather or bomber jacket on top'],
    accessories: ['Silver or gold chain necklace', 'Small clutch or dark bag'],
    shoes: 'Black boots or dark clean sneakers',
    hair: 'Styled. A little product or light waves look great.',
    tip: 'Keep colours dark and simple. Let the garment be the star of the look.',
  },
];

export default function Stylist() {
  const [garmentImage, setGarmentImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const pickGarment = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled) {
      setGarmentImage(result.assets[0].uri);
      setShowResults(false);
    }
  };

  const handleGetSuggestions = () => {
    if (!garmentImage) return;
    setIsLoading(true);
    setShowResults(false);
    setTimeout(() => {
      setIsLoading(false);
      setShowResults(true);
    }, 1800);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <AppHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>AI Stylist</Text>
          <Text style={styles.subtitle}>3 outfit ideas for your garment</Text>
        </View>

        {/* Garment Picker */}
        <View style={styles.imageContainer}>
          {garmentImage ? (
            <TouchableOpacity style={{ flex: 1 }} onPress={pickGarment}>
              <Image source={{ uri: garmentImage }} style={styles.image} />
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

        {garmentImage && !showResults && (
          <TouchableOpacity
            style={[styles.primaryButton, isLoading && { opacity: 0.7 }]}
            onPress={handleGetSuggestions}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryButtonText}>🪄 Get Outfit Ideas</Text>
            )}
          </TouchableOpacity>
        )}

        {isLoading && (
          <Text style={styles.loadingText}>Looking at your style...</Text>
        )}

        {showResults && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsHeader}>3 Ways to Wear It</Text>
            {OUTFIT_SETS.map((outfit, i) => (
              <View key={i} style={styles.outfitCard}>
                <View style={styles.outfitCardHeader}>
                  <Text style={styles.outfitEmoji}>{outfit.emoji}</Text>
                  <View>
                    <Text style={styles.outfitTitle}>{outfit.title}</Text>
                    <Text style={styles.outfitOccasion}>{outfit.occasion}</Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>WEAR WITH</Text>
                  {outfit.items.map((item, j) => (
                    <Text key={j} style={styles.sectionItem}>• {item}</Text>
                  ))}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>ACCESSORIES</Text>
                  {outfit.accessories.map((acc, j) => (
                    <Text key={j} style={styles.sectionItem}>• {acc}</Text>
                  ))}
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailCell}>
                    <Text style={styles.sectionLabel}>SHOES</Text>
                    <Text style={styles.sectionItem}>{outfit.shoes}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailCell}>
                    <Text style={styles.sectionLabel}>HAIR</Text>
                    <Text style={styles.sectionItem}>{outfit.hair}</Text>
                  </View>
                </View>

                <View style={styles.tipBox}>
                  <Text style={styles.tipText}>💡 {outfit.tip}</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => { setGarmentImage(null); setShowResults(false); }}
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
  scroll: { padding: 24, paddingBottom: 100 },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#ffffff' },
  subtitle: { fontSize: 15, color: '#a1a1aa', fontWeight: '500', marginTop: 4 },
  imageContainer: {
    height: 320, borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#0a1520', borderWidth: 1.5, borderColor: '#1e4878', marginBottom: 20,
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
  primaryButton: {
    backgroundColor: '#ffffff', padding: 20, borderRadius: 100,
    alignItems: 'center', marginBottom: 8,
  },
  primaryButtonText: { color: '#000000', fontSize: 17, fontWeight: 'bold' },
  loadingText: { color: '#52525b', textAlign: 'center', marginTop: 12, fontSize: 15, fontStyle: 'italic' },
  resultsSection: { gap: 0 },
  resultsHeader: { fontSize: 20, fontWeight: 'bold', color: '#ffffff', marginBottom: 16 },
  outfitCard: {
    backgroundColor: '#111111', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#1f1f1f', marginBottom: 16,
  },
  outfitCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  outfitEmoji: { fontSize: 32 },
  outfitTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  outfitOccasion: { fontSize: 12, color: '#52525b', marginTop: 2, fontWeight: '600', letterSpacing: 0.5 },
  section: { marginBottom: 14 },
  sectionLabel: {
    color: '#52525b', fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 6,
  },
  sectionItem: { color: '#d4d4d8', fontSize: 14, lineHeight: 22 },
  detailRow: { marginBottom: 12 },
  detailCell: {},
  tipBox: {
    backgroundColor: '#0a0a0a', borderRadius: 12, padding: 14,
    marginTop: 6, borderWidth: 1, borderColor: '#1f1f1f',
  },
  tipText: { color: '#a1a1aa', fontSize: 13, lineHeight: 20 },
  resetButton: {
    backgroundColor: '#18181b', padding: 18, borderRadius: 100,
    alignItems: 'center', borderWidth: 1, borderColor: '#27272a', marginTop: 8,
  },
  resetButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
