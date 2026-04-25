import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

export default function OnboardingScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>ClearPass</Text>
        <Text style={styles.subtitle}>Pass your UK theory test</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/(tabs)/home')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace('/(tabs)/home')}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#012169',
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 56,
  },
  hero: {
    alignItems: 'center',
  },
  title: {
    fontSize: 52,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: '#A5B4CC',
    textAlign: 'center',
    lineHeight: 26,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#334B7A',
  },
  secondaryButtonText: {
    color: '#A5B4CC',
    fontSize: 17,
    fontWeight: '600',
  },
});
