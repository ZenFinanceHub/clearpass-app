import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const ONBOARDING_KEY = '@clearpass/onboarding_complete';

const FEATURES = [
  { emoji: '🧠', label: 'Smart Practice' },
  { emoji: '⚡', label: 'Instant Feedback' },
  { emoji: '🏆', label: 'Track Progress' },
];

export default function OnboardingScreen() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      if (val) {
        router.replace('/(tabs)/home');
      } else {
        setChecking(false);
      }
    });
  }, []);

  const handleGetStarted = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(tabs)/home');
  };

  const handleSignIn = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(tabs)/home');
  };

  if (checking) return null;

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.glowCircle}>
          <Text style={styles.carEmoji}>{'🚗'}</Text>
        </View>

        <Text style={styles.title}>ClearPass</Text>
        <View style={styles.titleAccent} />
        <Text style={styles.subtitle}>Pass your theory test. First time.</Text>

        <View style={styles.featureRow}>
          {FEATURES.map(({ emoji, label }) => (
            <View key={label} style={styles.featureItem}>
              <Text style={styles.featureEmoji}>{emoji}</Text>
              <Text style={styles.featureLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleGetStarted}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSignIn} activeOpacity={0.75}>
          <Text style={styles.signInLink}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    paddingHorizontal: 28,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#1C1C27',
    borderWidth: 1,
    borderColor: '#A78BFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  carEmoji: {
    fontSize: 72,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#F1F0FF',
    letterSpacing: 2,
  },
  titleAccent: {
    height: 3,
    width: 60,
    backgroundColor: '#A78BFA',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 24,
    backgroundColor: '#13131A',
    borderRadius: 16,
    padding: 16,
  },
  featureItem: {
    alignItems: 'center',
    gap: 6,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    gap: 16,
    alignItems: 'stretch',
    paddingBottom: 48,
  },
  primaryButton: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  signInLink: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
});
