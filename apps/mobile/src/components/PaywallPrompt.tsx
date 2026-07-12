import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Pip } from './Pip';
import { Colors } from '@/src/constants/theme';

interface PaywallPromptProps {
  onUpgrade: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function PaywallPrompt({ onUpgrade, onDismiss, dismissLabel = 'Maybe later' }: PaywallPromptProps) {
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
