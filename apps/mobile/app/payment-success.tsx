import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { loadProgressFromCloud, loadUserProgress, saveUserProgress } from '@/src/storage';

// How long to keep checking Supabase for the real webhook-driven grant
// before giving up. 3s between checks, 60s total — generous relative to
// typical Stripe/RevenueCat webhook delivery, which is normally seconds,
// not tens of seconds.
const RESYNC_POLL_INTERVAL_MS = 3000;
const RESYNC_TIMEOUT_MS = 60000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function PaymentSuccessScreen() {
  useEffect(() => {
    void (async () => {
      // Optimistically flag isPro locally so the UI unlocks immediately.
      const local = await loadUserProgress();
      if (local && !local.isPro) {
        await saveUserProgress({ ...local, isPro: true });
      }

      // Poll for the real grant rather than checking once after a fixed
      // delay. A single check used to be safe because the optimistic write
      // above also landed server-side (via the same client session), so
      // Supabase already showed isPro:true by the time this ran regardless
      // of webhook speed. Once writes like that are no longer accepted from
      // a client session, that accidental safety net is gone — a webhook
      // slower than the old fixed delay would read back isPro:false here
      // and flash the paywall right after a genuine purchase. So: keep
      // checking until the server actually shows isPro:true, and never let
      // a still-catching-up "false" overwrite the optimistic local unlock.
      const deadline = Date.now() + RESYNC_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await wait(RESYNC_POLL_INTERVAL_MS);
        try {
          const cloud = await loadProgressFromCloud();
          if (cloud?.isPro) {
            await saveUserProgress(cloud);
            return;
          }
        } catch {}
      }

      // Webhook still hasn't landed after 60s. Leave the optimistic
      // isPro:true in place rather than reverting to a paywall the user
      // just paid past — the next normal isPremium() check (any Pro-gated
      // screen, or the next app open) re-reads from Supabase and picks up
      // the real grant whenever the webhook does land. If it never does,
      // that's a payment-support case, not something to surface as a UI
      // flicker here.
    })();
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
