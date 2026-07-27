import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, Image,
  SafeAreaView, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'vto_onboarding_done';

const SLIDES = [
  {
    emoji: '✨',
    title: 'Try clothes on.\nVirtually.',
    subtitle: 'See how any outfit looks on you before you buy — powered by AI.',
  },
  {
    emoji: '🤳',
    title: 'Snap a selfie,\npick any garment',
    subtitle: 'Take one selfie, then choose any clothing photo — from your gallery or a product page.',
    image: require('../assets/demo-garment.jpg'),
  },
  {
    emoji: '🪄',
    title: 'Get AI style advice\n+ fit tips',
    subtitle: 'Outfit ideas, size guidance, and a closet that remembers every look you tried.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const finish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      // Non-fatal — worst case onboarding shows again next launch.
    }
    router.replace('/(tabs)/home');
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  const isLast = page === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <TouchableOpacity style={styles.skipBtn} onPress={finish} hitSlop={12}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={styles.emojiBg}>
              <Text style={styles.emoji}>{slide.emoji}</Text>
            </View>
            {slide.image && (
              <Image source={slide.image} style={styles.slideImage} />
            )}
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            if (isLast) {
              finish();
            } else {
              scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
            }
          }}
        >
          <Text style={styles.primaryBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },

  skipBtn: { position: 'absolute', top: 60, right: 24, zIndex: 10 },
  skipText: { color: '#555', fontSize: 14, fontWeight: '600' },

  slide: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emojiBg: {
    width: 88, height: 88, borderRadius: 24, marginBottom: 28,
    backgroundColor: 'rgba(74,144,208,0.12)',
    borderWidth: 1, borderColor: 'rgba(74,144,208,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 44 },
  slideImage: {
    width: 220, height: 150, borderRadius: 16, marginBottom: 24,
    borderWidth: 1, borderColor: '#1e4878', resizeMode: 'cover',
  },
  title: {
    color: '#ffffff', fontSize: 30, fontWeight: 'bold',
    textAlign: 'center', marginBottom: 14, lineHeight: 38,
  },
  subtitle: {
    color: '#8a8a8e', fontSize: 15, textAlign: 'center', lineHeight: 22,
  },

  footer: { paddingHorizontal: 24, paddingBottom: 24 },
  dots: {
    flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2e2e2e' },
  dotActive: { backgroundColor: '#ffffff', width: 20 },

  primaryBtn: {
    backgroundColor: '#ffffff', padding: 18, borderRadius: 100, alignItems: 'center',
  },
  primaryBtnText: { color: '#000', fontSize: 17, fontWeight: 'bold' },
});
