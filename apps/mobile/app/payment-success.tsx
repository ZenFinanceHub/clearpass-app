import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { loadUserProgress, saveUserProgress } from '@/src/storage';

export default function PaymentSuccessScreen() {
  useEffect(() => {
    loadUserProgress().then((p) => {
      if (p) void saveUserProgress(p);
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{'✓'}</Text>
      </View>
      <Text style={styles.title}>You are now a Pro member!</Text>
      <Text style={styles.body}>
        {'Unlimited questions, AI tutor, battle mode and more are now unlocked.'}
      </Text>
      <TouchableOpacity
        style={styles.cta}
        onPress={() => router.replace('/(tabs)/home')}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaText}>Start learning</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#064E3B',
    borderWidth: 2,
    borderColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  icon: { fontSize: 40, color: '#34D399', fontWeight: '900' },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  cta: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    marginTop: 8,
  },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
