import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Pip } from './Pip';
import { Colors } from '@/src/constants/theme';
import { usePurchaseRoute, useTrialDays, IAP_UNAVAILABLE_COPY_COMPACT } from '@/src/purchaseGate';
import type { PaywallReason } from '@/src/conversion';
import { logFunnelEvent } from '@/src/funnel';

interface PaywallPromptProps {
  onUpgrade: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
  /** Why the learner is seeing this. Drives the copy: a learner who taps
   *  the Mock tab having answered nothing must not be told they've "hit
   *  today's free limit". */
  reason?: Exclude<PaywallReason, 'general' | 'mock_result' | 'tutor'>;
  /** Optional line tying the upgrade to the learner's test date. */
  urgencyLine?: string | null;
}

const COPY: Record<NonNullable<PaywallPromptProps['reason']>, { title: string; body: string }> = {
  daily_limit: {
    title: "That's today's 10 free questions",
    body: 'Pro unlocks unlimited questions, full mock tests and hazard perception clips. Or come back tomorrow for 10 more.',
  },
  mock: {
    title: 'You\u2019ve used your free mock test',
    body: 'Pro gives you unlimited mock tests, timed and scored like the real thing, so you know you\u2019re ready before you book.',
  },
  hazard: {
    title: 'Hazard perception is a Pro feature',
    body: 'It\u2019s a separate part of the theory test that you have to pass too. Pro gives you real clips, scored the same way as the test.',
  },
};

export function PaywallPrompt({ onUpgrade, onDismiss, dismissLabel = 'Maybe later', reason = 'daily_limit', urgencyLine }: PaywallPromptProps) {
  const route = usePurchaseRoute();
  const trialDays = useTrialDays();
  const copy = COPY[reason];

  React.useEffect(() => {
    logFunnelEvent('paywall_prompt_viewed', { reason, route });
    // Once per mount; route changes are not a new view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
      {urgencyLine ? <Text style={styles.urgency}>{urgencyLine}</Text> : null}
      <TouchableOpacity
        style={styles.upgradeBtn}
        onPress={() => { logFunnelEvent('paywall_prompt_tapped', { reason }); onUpgrade(); }}
        activeOpacity={0.85}
      >
        <Text style={styles.upgradeBtnText}>{trialDays ? `Try Pro free for ${trialDays} days` : 'See Pro plans'}</Text>
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
  title: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center' },
  urgency: { fontSize: 14, color: Colors.indigo, textAlign: 'center', fontWeight: '700', lineHeight: 20 },
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
