import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Pip } from './Pip';
import { Colors } from '@/src/constants/theme';
import { usePurchaseRoute, IAP_UNAVAILABLE_COPY_COMPACT } from '@/src/purchaseGate';

interface PaywallPromptProps {
  onUpgrade: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function PaywallPrompt({ onUpgrade, onDismiss, dismissLabel = 'Maybe later' }: PaywallPromptProps) {
  const route = usePurchaseRoute();

  // No purchase route available on this platform — no purchase CTA at
  // all, just the unavailable message with a single acknowledge button.
  // Reactive, so a prompt already on screen when readiness resolves flips
  // to the real upgrade CTA instead of staying stuck.
  // Deliberately checks === 'coming_soon', not !== 'stripe_checkout': the
  // latter used to also catch 'iap' and show this same message even once a
  // real purchase was available, which would have silently hidden the
  // upgrade CTA on the one platform it should work. Every caller of
  // PaywallPrompt gets this for free.
  if (route === 'coming_soon') {
    return (
      <View style={styles.card}>
        <Pip size={72} mood="sympathetic" />
        <Text style={styles.title}>{IAP_UNAVAILABLE_COPY_COMPACT.title}</Text>
        <Text style={styles.body}>{IAP_UNAVAILABLE_COPY_COMPACT.body}</Text>
        <TouchableOpacity style={styles.upgradeBtn} onPress={onDismiss ?? onUpgrade} activeOpacity={0.85}>
          <Text style={styles.upgradeBtnText}>{IAP_UNAVAILABLE_COPY_COMPACT.buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Pip size={72} mood="sympathetic" />
      <Text style={styles.title}>Go Pro</Text>
      <Text style={styles.body}>
        {"You've hit today's free limit — Pro unlocks unlimited questions, hazard clips, and Ask Pip."}
      </Text>
      <TouchableOpacity style={styles.upgradeBtn} onPress={onUpgrade} activeOpacity={0.85}>
        <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
      </TouchableOpacity>
      {onDismiss && (
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
          <Text style={styles.dismissText}>{dismissLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  body: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  upgradeBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  upgradeBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  dismissBtn: { paddingVertical: 8 },
  dismissText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
});
