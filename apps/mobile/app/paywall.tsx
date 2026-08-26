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
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { supabase } from '@/src/supabase';
import { getProxyUrl } from '@/src/proxyUrl';
import { Colors } from '@/src/constants/theme';
import { ScaleButton } from '@/src/components/ScaleButton';
import { loadUserProgress, saveUserProgress } from '@/src/storage';
import { Pip } from '@/src/components/Pip';
import { usePurchaseRoute, getSubscriptionDisclosure, IAP_UNAVAILABLE_COPY } from '@/src/purchaseGate';
import { getProPackage, purchaseProPackage, restoreProPurchases, refreshIapReady } from '@/src/purchases';

const FEATURES = [
  'Unlimited practice questions',
  'Full mock tests (50 questions, timed)',
  'Hazard perception videos',
  'AI tutor explains every answer',
  'Progress tracking & streaks',
];



export default function PaywallScreen() {
  // Reactive: readiness resolves asynchronously after boot, so this must
  // re-render when it lands rather than freezing whatever was true at
  // first paint.
  const route = usePurchaseRoute();
  const disclosure = getSubscriptionDisclosure();
  const [loading,      setLoading]      = useState(false);
  const [retrying,     setRetrying]     = useState(false);
  const [restoring,    setRestoring]    = useState(false);
  const [error,        setError]        = useState('');
  // Non-error feedback (successful/empty restore). Separate from `error`
  // so it isn't styled as a failure. Deliberately NOT Alert.alert: this
  // screen is part of the static web export (app.json web.output) and
  // Alert is a no-op on react-native-web, which would leave a web user
  // tapping Restore with no feedback at all.
  const [notice,       setNotice]       = useState('');
  const [referredBy,   setReferredBy]   = useState<string | null>(null);
  const [isTestMode,   setIsTestMode]   = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('referral_code').then(code => {
      if (code) setReferredBy(code);
    }).catch(() => {});

    fetch(`${getProxyUrl()}/api/config`)
      .then(r => r.json() as Promise<{ stripeTestMode?: boolean }>)
      .then(d => { if (d.stripeTestMode) setIsTestMode(true); })
      .catch(() => {});

    // Re-check IAP readiness on arrival. Boot may have probed while the
    // network was still coming up; by the time someone reaches the paywall
    // it usually isn't. Only promotes to ready, never demotes.
    void refreshIapReady();
  }, []);

  async function handleSubscribe() {
    setError('');
    setNotice('');
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
    setNotice('');
    setLoading(true);
    const pkg = await getProPackage();
    if (!pkg) {
      setLoading(false);
      setError('In-app purchases are unavailable right now. Please try again shortly.');
      return;
    }
    const outcome = await purchaseProPackage(pkg);
    setLoading(false);
    if (outcome.status === 'success') {
      if (outcome.proEntitlementActive) {
        // Unlock the UI immediately from RC's own confirmation, without
        // waiting for the RevenueCat webhook to reach Supabase — that
        // still happens in the background and remains the source of
        // truth on next app load; this is purely for instant feedback,
        // same role payment-success.tsx's own optimistic flip already
        // plays for Stripe (which still runs too, harmlessly, right
        // after this).
        const local = await loadUserProgress();
        if (local) await saveUserProgress({ ...local, isPro: true });
      }
      router.replace('/payment-success');
    } else if (outcome.status === 'error') {
      setError(outcome.message);
    }
    // 'cancelled': dismiss silently — no error shown, the user backed out
    // of the native purchase sheet.
  }

  // Required by App Store guideline 3.1.1. Mirrors handleIapPurchase's
  // success path exactly rather than duplicating it: optimistic local
  // isPro flip for instant unlock, then /payment-success, which already
  // owns the "resync from Supabase a few seconds later" safety net for
  // every purchase rail.
  async function handleRestore() {
    setError('');
    setNotice('');
    setRestoring(true);
    const outcome = await restoreProPurchases();
    setRestoring(false);

    if (outcome.status === 'restored') {
      const local = await loadUserProgress();
      if (local) await saveUserProgress({ ...local, isPro: true });
      router.replace('/payment-success');
    } else if (outcome.status === 'none') {
      setNotice('No previous ClearPass Pro purchase was found for this account.');
    } else {
      setError(outcome.message);
    }
  }

  // Opens Terms/Privacy in an in-app browser (SFSafariViewController on
  // iOS, Custom Tabs on Android) so the user isn't thrown out of the
  // purchase flow to Safari. Falls back to Linking.openURL, and surfaces a
  // visible error if both fail — a legal link that fails silently is the
  // same 3.1.2 problem as not having one. The app's three other external
  // links still use bare Linking.openURL with a swallowed catch; those are
  // out of scope here.
  async function openLegalLink(url: string) {
    setError('');
    setNotice('');
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        setError('Could not open that link. Please visit ' + url);
      }
    }
  }

  // Manual retry from the unavailable state. Nothing here forces the
  // route to change — if the probe still fails, the screen honestly stays
  // as it is, and the failure is reported to Sentry either way.
  async function handleRetryIap() {
    setError('');
    setNotice('');
    setRetrying(true);
    await refreshIapReady();
    setRetrying(false);
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
        <Pip size={84} mood={'celebrate'} />
        <Text style={styles.headerTitle}>{'Go Pro'}</Text>
        <Text style={styles.headerSub}>
          {'Everything you need to pass first time'}
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

      {/* Subscription name, duration and price, and full renewal terms —
          shown on every purchasable route, not just Stripe. This block
          previously rendered for 'stripe_checkout' only, on the reasoning
          that the native purchase sheet already shows the IAP price; that
          is precisely what App Store guideline 3.1.2 rejects. The terms
          must be legible on our own screen, before the sheet opens. */}
      {route !== 'coming_soon' && (
        <View style={styles.pricingBox}>
          <Text style={styles.planName}>{disclosure.name}</Text>
          <Text style={styles.priceLine}>{disclosure.priceLine}</Text>
          <Text style={styles.renewalTerms}>{disclosure.renewalTerms}</Text>
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
              : <Text style={styles.ctaBtnText}>{'Subscribe to Pro'}</Text>
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
        // Unavailable state, iOS and Android alike: no price, no external
        // link, no mention of an alternate purchase route. Apple and
        // Google both forbid routing a purchase anywhere but their own IAP
        // once it's available, and we have no working route to offer.
        // Since both store products are now live, reaching this on a
        // shipped build means something failed — so it offers a retry
        // rather than reading as a permanent "not built yet".
        <View style={styles.comingSoonBanner}>
          <Text style={styles.comingSoonTitle}>{IAP_UNAVAILABLE_COPY.title}</Text>
          <Text style={styles.comingSoonBody}>{IAP_UNAVAILABLE_COPY.body}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void handleRetryIap()}
            disabled={retrying}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={IAP_UNAVAILABLE_COPY.retryLabel}
          >
            {retrying
              ? <ActivityIndicator color={Colors.indigo} />
              : <Text style={styles.retryBtnText}>{IAP_UNAVAILABLE_COPY.retryLabel}</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Terms of Use (EULA), Privacy Policy and Restore Purchases — all
          three required alongside a subscription (3.1.2 for the links,
          3.1.1 for restore). Shown on every purchasable route; hidden on
          'coming_soon', where there is nothing to buy or restore. */}
      {route !== 'coming_soon' && (
        <View style={styles.legalBlock}>
          <View style={styles.legalLinkRow}>
            <TouchableOpacity
              onPress={() => void openLegalLink(disclosure.termsUrl)}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Terms of Use"
            >
              <Text style={styles.legalLink}>{'Terms of Use'}</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>{'·'}</Text>
            <TouchableOpacity
              onPress={() => void openLegalLink(disclosure.privacyUrl)}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
            >
              <Text style={styles.legalLink}>{'Privacy Policy'}</Text>
            </TouchableOpacity>
          </View>

          {/* Restore is IAP-only: there is nothing for RevenueCat to
              restore on the Stripe/web rail, where entitlement comes from
              Supabase on sign-in rather than from a store receipt. */}
          {route === 'iap' && (
            <TouchableOpacity
              style={styles.restoreBtn}
              onPress={() => void handleRestore()}
              disabled={restoring || loading}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Restore Purchases"
            >
              {restoring
                ? <ActivityIndicator color={Colors.indigo} />
                : <Text style={styles.restoreText}>{'Restore Purchases'}</Text>
              }
            </TouchableOpacity>
          )}

          {notice.length > 0 && <Text style={styles.noticeText}>{notice}</Text>}
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
    paddingVertical: 20,
    paddingHorizontal: 24,
    width: '100%',
    gap: 6,
  },
  planName:  { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center' },
  priceLine: { fontSize: 24, fontWeight: '900', color: '#111827', textAlign: 'center' },
  // 12/18 is small but is the standard size for this disclosure and stays
  // above the ~11pt floor reviewers flag as unreadable.
  renewalTerms: { fontSize: 12, lineHeight: 18, color: '#6B7280', textAlign: 'center', marginTop: 4 },

  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center' },
  noticeText: { fontSize: 13, color: '#374151', textAlign: 'center', lineHeight: 19 },

  legalBlock: { width: '100%', alignItems: 'center', gap: 12, marginTop: -8 },
  legalLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legalLink: {
    fontSize: 14,
    color: Colors.indigo,
    fontWeight: '600',
    textDecorationLine: 'underline',
    // Keeps the tap target at the 44pt minimum without visually padding
    // the row apart.
    paddingVertical: 12,
  },
  legalSeparator: { fontSize: 14, color: '#9CA3AF' },
  restoreBtn: { paddingVertical: 12, paddingHorizontal: 24, minHeight: 44, justifyContent: 'center' },
  restoreText: { fontSize: 15, color: Colors.indigo, fontWeight: '700' },

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
  retryBtn: {
    marginTop: 6,
    paddingVertical: 12,
    paddingHorizontal: 28,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.indigo,
    backgroundColor: '#FFFFFF',
  },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: Colors.indigo },
});
