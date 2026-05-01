import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const ONBOARDING_KEY = '@clearpass/onboarding_complete';

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
        <Text style={styles.mascotEmoji}>{'🚗'}</Text>
        <Text style={styles.title}>ClearPass</Text>
        <Text style={styles.subtitle}>Pass your theory test. First time.</Text>
        <Text style={styles.tagline}>Join thousands of learners who passed first time</Text>

        <View style={styles.featureRow}>
          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>{'🧠'}</Text>
            <Text style={styles.featureLabel}>Smart Practice</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>{'⚡'}</Text>
            <Text style={styles.featureLabel}>Instant Feedback</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>{'🏆'}</Text>
            <Text style={styles.featureLabel}>Track Progress</Text>
          </View>
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
    backgroundColor: '#6C63FF',
    paddingHorizontal: 28,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotEmoji: {
    fontSize: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  featureItem: {
    alignItems: 'center',
    gap: 6,
  },
  featureEmoji: {
    fontSize: 32,
  },
  featureLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    gap: 16,
    alignItems: 'stretch',
    paddingBottom: 48,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#6C63FF',
    fontSize: 17,
    fontWeight: '700',
  },
  signInLink: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
