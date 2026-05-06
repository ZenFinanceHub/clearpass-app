import React, { useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const ONBOARDING_KEY = '@clearpass/hasSeenOnboarding';

const SLIDES = [
  {
    emoji: '🚗',
    title: 'Pass First Time',
    subtitle: "The UK's smartest theory test app. Learn faster, score higher.",
  },
  {
    emoji: '📚',
    title: 'Practice That Works',
    subtitle: '1,000+ real theory questions, organised by topic. Learn at your own pace.',
  },
  {
    emoji: '⚠️',
    title: 'Hazard Perception',
    subtitle: 'Video clips with real scoring — just like the actual DVSA test.',
  },
  {
    emoji: '🏆',
    title: 'Track Your Journey',
    subtitle: 'Watch your car move closer to Test Ready as you improve.',
  },
];

async function completeOnboarding() {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  router.replace('/auth/signup');
}

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const isLast = activeIndex === SLIDES.length - 1;

  function handleNext() {
    if (isLast) {
      void completeOnboarding();
      return;
    }
    const next = activeIndex + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setActiveIndex(next);
  }

  return (
    <View style={styles.container}>
      {/* Skip link */}
      <TouchableOpacity style={styles.skipBtn} onPress={() => void completeOnboarding()} activeOpacity={0.7}>
        <Text style={styles.skipText}>{'Skip'}</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Pagination dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>

      {/* Next / Get Started */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },

  skipBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },

  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 20,
  },
  emoji: { fontSize: 80 },
  title: { fontSize: 30, fontWeight: '900', color: '#F1F0FF', textAlign: 'center', letterSpacing: 0.5 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24 },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1F2937',
  },
  dotActive: {
    backgroundColor: '#7B5EA7',
    width: 24,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  nextBtn: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
