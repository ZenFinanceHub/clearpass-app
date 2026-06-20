import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { setOnboardingComplete, savePendingTestDate } from '@/src/storage';
import { Colors } from '@/src/constants/theme';

type Slide = {
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
  isDateSlide?: boolean;
};

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    emoji: '👋',
    title: 'Welcome to ClearPass',
    subtitle: 'Pass your theory test. First time.',
  },
  {
    key: 'practice',
    emoji: '🎯',
    title: 'Practice smarter',
    subtitle: '700+ questions, adaptive to your weak spots. The more you use it, the more it personalises to you.',
  },
  {
    key: 'progress',
    emoji: '📈',
    title: 'Track your progress',
    subtitle: 'Mock tests, pass probability, topic badges and streaks. Know exactly when you are ready.',
  },
  {
    key: 'date',
    emoji: '📅',
    title: 'Set your test date',
    subtitle: 'When is your theory test? We will build a personalised study plan.',
    isDateSlide: true,
  },
];

function parseDdMmYyyy(input: string): string | null {
  const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day   = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year  = parseInt(match[3], 10);
  const d = new Date(year, month, day);
  if (isNaN(d.getTime()) || d.getMonth() !== month) return null;
  return d.toISOString();
}

async function finish(testDateIso: string | null) {
  await setOnboardingComplete();
  if (testDateIso) await savePendingTestDate(testDateIso);
  router.replace('/auth/signup');
}

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dateInput, setDateInput]     = useState('');
  const [dateError, setDateError]     = useState('');
  const isLast = activeIndex === SLIDES.length - 1;
  const slide  = SLIDES[activeIndex];

  function handleNext() {
    if (isLast) {
      const parsed = dateInput.trim() ? parseDdMmYyyy(dateInput.trim()) : null;
      if (dateInput.trim() && !parsed) {
        setDateError('Enter a valid date (DD/MM/YYYY)');
        return;
      }
      void finish(parsed);
      return;
    }
    setActiveIndex((i) => i + 1);
  }

  return (
    <View style={styles.container}>
      {/* Current slide */}
      <View style={styles.slide}>
        <Text style={styles.emoji}>{slide.emoji}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>

        {slide.isDateSlide && (
          <View style={styles.dateBlock}>
            <TextInput
              style={[styles.dateInput, dateError.length > 0 && styles.dateInputError]}
              value={dateInput}
              onChangeText={(t) => { setDateInput(t); setDateError(''); }}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#9CA3AF"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            {dateError.length > 0 && (
              <Text style={styles.dateError}>{dateError}</Text>
            )}
          </View>
        )}
      </View>

      {/* Pagination dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>
            {isLast ? (dateInput.trim() ? "Let's Go" : "Let's Go") : 'Next'}
          </Text>
        </TouchableOpacity>

        {isLast && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => void finish(null)}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>{'Skip for now'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },

  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  emoji:    { fontSize: 80 },
  title:    { fontSize: 30, fontWeight: '900', color: '#111827', textAlign: 'center', letterSpacing: 0.5 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24 },

  dateBlock: { width: '100%', gap: 6 },
  dateInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.indigo,
    padding: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 2,
    textAlign: 'center',
  },
  dateInputError: { borderColor: '#EF4444' },
  dateError: { fontSize: 13, color: '#EF4444', textAlign: 'center' },

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
    backgroundColor: '#E5E7EB',
  },
  dotActive: {
    backgroundColor: Colors.indigo,
    width: 24,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 12,
  },
  nextBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
});
