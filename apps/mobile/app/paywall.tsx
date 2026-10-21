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
import { getAccessToken } from '@/src/getAccessToken';
import { getProxyUrl } from '@/src/proxyUrl';
import { Colors } from '@/src/constants/theme';
import { ScaleButton } from '@/src/components/ScaleButton';
import { loadUserProgress, saveUserProgress } from '@/src/storage';
import { Pip } from '@/src/components/Pip';
import {
  usePurchaseRoute,
  getPurchaseRoute,
  useTrialDays,
  setTrialDays,
  getSubscriptionDisclosure,
  FALLBACK_PRICES,
  IAP_UNAVAILABLE_COPY,
  type ProPlan,
} from '@/src/purchaseGate';
import { getProPackage, getProPackages, purchaseProPackage, restoreProPurchases, refreshIapReady } from '@/src/purchases';
import { testDateUrgencyLine } from '@/src/conversion';
import { logFunnelEvent } from '@/src/funnel';

// Only what Pro adds — progress tracking and streaks are free for everyone.
const FEATURES = [
  'Unlimited practice questions',
  'Unlimited mock tests, timed like the real test',
  'Hazard perception clips, scored like the DVSA test',
  'Ask Pip: 20 AI explanations a day',
  'Streak freezes so a missed day doesn\u2019t reset you',
];



export default function PaywallScreen() {
  // Reactive: readiness resolves asynchronously after boot, so this must
  // re-render when it lands rather than freezing whatever was true at
  // first paint.
  const route = usePurchaseRoute();
  const trialDays = useTrialDays();
  const [plan,         setPlan]         = useState<ProPlan>('quarterly');
  // Store price strings per plan, once offerings load (IAP only). null
  // means "not on sale right now" — e.g. a new product still in review —
  // and that plan's card is hidden rather than offered and then failing.
  const [storePrices,  setStorePrices]  = useState<Record<ProPlan, string | null> | null>(null);
  const [webMonthly,   setWebMonthly]   = useState(false);
  const [urgencyLine,  setUrgencyLine]  = useState<string | null>(null);
  const plansOnSale: ProPlan[] = route === 'iap'
    ? (storePrices ? (['quarterly', 'monthly'] as ProPlan[]).filter(p => storePrices[p]) : ['quarterly'])
    : route === 'stripe_checkout'
      ? (webMonthly ? ['quarterly', 'monthly'] : ['quarterly'])
      : [];
  const activePlan: ProPlan = plansOnSale.includes(plan) ? plan : (plansOnSale[0] ?? 'quarterly');
  const priceFor = (p: ProPlan) => (route === 'iap' ? storePrices?.[p] : null) || FALLBACK_PRICES[p];
  // No trial on web: those plans are one-off payments.
  const offerTrial = route === 'iap' ? trialDays : null;
  const disclosure = getSubscriptionDisclosure(activePlan, { priceString: priceFor(activePlan), trialDays: offerTrial });
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
      .then(r => r.json() as Promise<{ stripeTestMode?: boolean; webMonthlyAvailable?: boolean }>)
      .then(d => {
        if (d.stripeTestMode) setIsTestMode(true);
        if (d.webMonthlyAvailable) setWebMonthly(true);
      })
      .catch(() => {});

    loadUserProgress()
      .then(p => setUrgencyLine(testDateUrgencyLine(p)))
      .catch(() => {});

    logFunnelEvent('paywall_viewed', { route: getPurchaseRoute() });

    // Re-check IAP readiness on arrival. Boot may have probed while the
    // network was still coming up; by the time someone reaches the paywall
    // it usually isn't. Only promotes to ready, never demotes.
    void refreshIapReady();
  }, []);

  // Real store prices for both plans, refreshed whenever IAP becomes ready.
  useEffect(() => {
    if (route !== 'iap') return;
    let cancelled = false;
    void getProPackages().then(pkgs => {
      if (cancelled) return;
      setStorePrices({
        monthly: pkgs.monthly?.product.priceString ?? null,
        quarterly: pkgs.quarterly?.product.priceString ?? null,
      });
    });
    return () => { cancelled = true; };
  }, [route]);

  function choosePlan(p: ProPlan) {
    setPlan(p);
    logFunnelEvent('plan_selected', { plan: p });
  }

  async function handleSubscribe() {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        router.replace('/auth/signin');
        return;
      }
      logFunnelEvent('purchase_started', { plan: activePlan, rail: 'stripe' });
      const res = await fetch(`${getProxyUrl()}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: activePlan }),
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
    const pkg = await getProPackage(activePlan);
    if (!pkg) {
      setLoading(false);
      setError('In-app purchases are unavailable right now. Please try again shortly.');
      logFunnelEvent('purchase_failed', { plan: activePlan, rail: 'iap', reason: 'no_package' });
      return;
    }
    logFunnelEvent('purchase_started', { plan: activePlan, rail: 'iap', trialDays: offerTrial });
    const outcome = await purchaseProPackage(pkg);
    setLoading(false);
    logFunnelEvent(
      outcome.status === 'success' ? 'purchase_succeeded' : outcome.status === 'cancelled' ? 'purchase_cancelled' : 'purchase_failed',
      { plan: activePlan, rail: 'iap', trialDays: offerTrial },
    );
    if (outcome.status === 'success') {
      // The trial is used up for this Apple ID / Google account.
      setTrialDays(null);
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
        <Text style={styles.headerTitle}>{offerTrial ? `Try Pro free for ${offerTrial} days` : 'Go Pro'}</Text>
        <Text style={styles.headerSub}>
          {'Everything you need to pass first time'}
        </Text>
        {urgencyLine ? <Text style={styles.urgencyText}>{urgencyLine}</Text> : null}
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
      {plansOnSale.length > 0 && (
        <View style={styles.planList}>
          {plansOnSale.map(p => {
            const selected = p === activePlan;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.planCard, selected && styles.planCardSelected]}
                onPress={() => choosePlan(p)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View style={styles.planRadio}>{selected && <View style={styles.planRadioDot} />}</View>
                <View style={styles.planInfo}>
                  <Text style={styles.planTitle}>{p === 'quarterly' ? '3 months' : '1 month'}</Text>
                  <Text style={styles.planSub}>
                    {p === 'quarterly'
                      ? (route === 'stripe_checkout' ? 'Covers most learners up to test day' : 'Billed every 3 months')
                      : (route === 'stripe_checkout' ? 'For a final push before your test' : 'Billed monthly, cancel any time')}
                  </Text>
                </View>
                <View style={styles.planPriceCol}>
                  <Text style={styles.planPrice}>{priceFor(p)}</Text>
                  {p === 'quarterly' && plansOnSale.includes('monthly') && (
                    <Text style={styles.planBadge}>{'Best value'}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Plan name, duration and price, and full renewal terms, for the
          selected plan — shown on every purchasable route, before the
          purchase sheet opens (App Store guideline 3.1.2). */}
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
              : <Text style={styles.ctaBtnText}>{`Get Pro for ${priceFor(activePlan)}`}</Text>
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
              : <Text style={styles.ctaBtnText}>{offerTrial ? `Start ${offerTrial}-day free trial` : 'Subscribe to Pro'}</Text>
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
  urgencyText: { fontSize: 15, color: Colors.indigo, fontWeight: '700', textAlign: 'center', lineHeight: 21 },

  planList: { width: '100%', gap: 10 },
  planCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB',
    paddingVertical: 16, paddingHorizontal: 18,
  },
  planCardSelected: { borderColor: Colors.indigo, borderWidth: 2.5 },
  planRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.indigo, alignItems: 'center', justifyContent: 'center' },
  planRadioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.indigo },
  planInfo: { flex: 1, gap: 2 },
  planTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  planSub: { fontSize: 13, color: '#6B7280' },
  planPriceCol: { alignItems: 'flex-end', gap: 4 },
  planPrice: { fontSize: 18, fontWeight: '900', color: '#111827' },
  planBadge: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', backgroundColor: Colors.indigo, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
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
