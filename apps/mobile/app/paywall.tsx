import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from '@/src/supabase';
import { getProxyUrl } from '@/src/proxyUrl';
import { Colors } from '@/src/constants/theme';
import { ScaleButton } from '@/src/components/ScaleButton';
import { loadUserProgress, isTrialActive } from '@/src/storage';
import { Pip } from '@/src/components/Pip';
import { getPurchaseRoute, COMING_SOON_COPY } from '@/src/purchaseGate';
import { getProPackage, purchaseProPackage } from '@/src/purchases';

const FEATURES = [
  'Unlimited practice questions',
  'Full mock tests (50 questions, timed)',
  'Hazard perception videos',
  'AI tutor explains every answer',
  'Progress tracking & streaks',
];



export default function PaywallScreen() {
  const route = getPurchaseRoute();
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [referredBy,   setReferredBy]   = useState<string | null>(null);
  const [isTestMode,   setIsTestMode]   = useState(false);
  const [trialExpired, setTrialExpired] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('referral_code').then(code => {
      if (code) setReferredBy(code);
    }).catch(() => {});

    fetch(`${getProxyUrl()}/api/config`)
      .then(r => r.json() as Promise<{ stripeTestMode?: boolean }>)
      .then(d => { if (d.stripeTestMode) setIsTestMode(true); })
      .catch(() => {});

    loadUserProgress().then(p => {
      if (p && p.trialStartDate && !p.isPro && !isTrialActive(p)) {
        setTrialExpired(true);
      }
    }).catch(() => {});
  }, []);

  async function handleSubscribe() {
    setError('');
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth/signin');
        return;
      }
      const res = await fetch(`${getProxyUrl()}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        await Linking.openURL(data.url);
      } else {
        setError(data.error ?? 'Could not start checkout. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // On success this does NOT flag isPro locally — the RevenueCat webhook
  // updating user_progress server-side is the source of truth, same as
  // Stripe. payment-success.tsx already handles the "optimistic local flag,
  // then re-sync from Supabase" pattern for any purchase rail, not just
  // Stripe, so IAP success routes there too rather than duplicating it.
  async function handleIapPurchase() {
    setError('');
    setLoading(true);
    const pkg = await getProPackage();
    if (!pkg) {
      setLoading(false);
      setError('No offer available right now. Please try again shortly.');
      return;
    }
    const outcome = await purchaseProPackage(pkg);
    setLoading(false);
    if (outcome.status === 'success') {
      router.replace('/payment-success');
    } else if (outcome.status === 'error') {
      setError(outcome.message);
    }
    // 'cancelled': no-op — the user backed out of the native purchase sheet.
  }

  function handleMaybeLater() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Test mode banner */}
      {isTestMode && (
        <View style={styles.testBanner}>
          <Text style={styles.testBannerText}>{'[!] Test mode -- no real charges'}</Text>
        </View>
      )}

      {/* Referral badge */}
      {referredBy && (
        <View style={styles.referralBadge}>
          <Text style={styles.referralBadgeText}>{'Recommended by your driving instructor'}</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Pip size={84} mood={trialExpired ? 'sympathetic' : 'celebrate'} />
        <Text style={styles.headerTitle}>{trialExpired ? 'Your Trial Has Ended' : 'Go Pro'}</Text>
        <Text style={styles.headerSub}>
          {trialExpired
            ? 'Subscribe to keep all your Pro features and progress'
            : 'Try free for 7 days, then everything you need to pass first time'}
        </Text>
      </View>

      {/* Feature list */}
      <View style={styles.featureList}>
        {FEATURES.map((feat) => (
          <View key={feat} style={styles.featureRow}>
            <Text style={styles.featureCheck}>{'✅'}</Text>
            <Text style={styles.featureText}>{feat}</Text>
          </View>
        ))}
      </View>

      {/* Stripe's own price — hidden for 'iap' too, not just 'coming_soon':
          the real IAP price comes from the store/RevenueCat, not this
          hardcoded Stripe figure, and the native purchase sheet shows it. */}
      {route === 'stripe_checkout' && (
        <View style={styles.pricingBox}>
          {!trialExpired && (
            <View style={styles.trialPill}>
              <Text style={styles.trialPillText}>{'7 days free'}</Text>
            </View>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>{'£7.99'}</Text>
            <Text style={styles.pricePeriod}>{' / 3 months'}</Text>
          </View>
          <Text style={styles.priceSub}>
            {trialExpired ? "That's less than £2.67/month" : "Free for 7 days, then just £2.67/month"}
          </Text>
        </View>
      )}

      {route === 'stripe_checkout' ? (
        <>
          {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}
          <ScaleButton
            style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
            onPress={() => void handleSubscribe()}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.ctaBtnText}>
                  {trialExpired ? 'Subscribe Now — £7.99/3 months' : 'Start Free Trial'}
                </Text>
            }
          </ScaleButton>
        </>
      ) : route === 'iap' ? (
        <>
          {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}
          <ScaleButton
            style={[styles.ctaBtn, loading && styles.ctaBtnDisabled]}
            onPress={() => void handleIapPurchase()}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.ctaBtnText}>{'Subscribe to Pro'}</Text>
            }
          </ScaleButton>
        </>
      ) : (
        // Coming-soon state, iOS and Android alike: no price, no external
        // link, no mention of an alternate purchase route — just the
        // honest state. Apple and Google both forbid routing a purchase
        // anywhere but their own IAP once it's available, and there's no
        // purchase route to offer before then.
        <View style={styles.comingSoonBanner}>
          <Text style={styles.comingSoonTitle}>{COMING_SOON_COPY.title}</Text>
          <Text style={styles.comingSoonBody}>{COMING_SOON_COPY.body}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.skipBtn} onPress={handleMaybeLater} activeOpacity={0.7}>
        <Text style={styles.skipText}>{'Maybe later'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F7F8FA' },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 48,
    alignItems: 'center',
    gap: 24,
  },

  header: { alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: '#111827', textAlign: 'center' },
  headerSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },

  featureList: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    padding: 20,
    gap: 14,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureCheck: { fontSize: 18 },
  featureText: { fontSize: 15, color: '#111827', fontWeight: '500', flex: 1 },

  pricingBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.indigo,
    paddingVertical: 24,
    paddingHorizontal: 40,
    width: '100%',
    gap: 6,
  },
  trialPill: {
    backgroundColor: Colors.indigoBg ?? '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.indigo,
  },
  trialPillText: { fontSize: 12, fontWeight: '700', color: Colors.indigo },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  priceAmount: { fontSize: 48, fontWeight: '900', color: '#111827' },
  pricePeriod: { fontSize: 18, color: '#6B7280', fontWeight: '500' },
  priceSub: { fontSize: 13, color: Colors.indigo, fontWeight: '600' },

  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center' },

  ctaBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  skipBtn: { paddingVertical: 8 },
  skipText: { fontSize: 14, color: '#6B7280' },

  referralBadge: {
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.indigo,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  referralBadgeText: { fontSize: 13, fontWeight: '700', color: Colors.indigo },

  testBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FBBF24',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  testBannerText: { fontSize: 13, fontWeight: '700', color: '#D97706' },

  comingSoonBanner: {
    backgroundColor: Colors.indigoBg ?? '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.indigo,
    padding: 20,
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 6,
  },
  comingSoonTitle: { fontSize: 16, fontWeight: '800', color: Colors.indigo, textAlign: 'center' },
  comingSoonBody:  { fontSize: 13, color: '#374151', lineHeight: 20, textAlign: 'center' },
});
