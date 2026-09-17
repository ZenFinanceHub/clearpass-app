import * as Sentry from '@sentry/react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Stack, useSegments } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccessibilityProvider } from '@/src/AccessibilityContext';
import { NetworkProvider } from '@/src/NetworkContext';
import { PipVisibilityProvider, usePipVisibility } from '@/src/PipVisibilityContext';
import { handleIncomingUrl, getDeepLinkPath } from '@/src/deepLinks';
import { supabase } from '@/src/supabase';
import { configureNotificationHandler } from '@/src/notifications';
import { configurePurchases } from '@/src/purchases';
import { resolvePostAuthRoute } from '@/src/postAuthRouting';
import { CrossPlatformAlertHost } from '@/src/CrossPlatformAlert';
import { Colors } from '@/src/constants/theme';
import {
  getCacheStatus,
  cacheQuestions,
  cacheHighwayCode,
  cacheRoadSigns,
  syncWhenOnline,
} from '@/src/offlineCache';
// Plain CommonJS, shared with server/scripts/test-instructor-fixes.js's
// unit-testable path — see that file's own header for why this isn't
// inlined here. Same pattern as server/lib/earnings.js (imported by
// app/instructor.tsx the same way).
import { resolveBootstrapDestination } from '../server/lib/bootstrapRouting';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: __DEV__ ? 'development' : 'production',
  enabled: !__DEV__,
});

configureNotificationHandler();

const ONBOARDING_KEY = '@clearpass/hasSeenOnboarding';

// PUBLIC_ROUTES and the entry-points set bootstrap() checks below now live
// in server/lib/bootstrapRouting.js, alongside the pure decision function
// itself — see that file for what's in each set and why.

// ── Instructor route guard ────────────────────────────────────────────────────
// Instructor accounts get unconditional free Pro-level access (see
// apps/mobile/server/lib/entitlement.js), so letting one reach the learner
// app is a free-Pro bypass, not just a UI mismatch. This is the ONE place
// that check happens — it covers the (tabs) group AND the legacy top-level
// sibling routes kept for deep-linking (hazard.tsx, roadsigns.tsx, etc. exist
// alongside their (tabs) counterparts; not deleting those is separate work).
// Screens are not individually guarded — this overlay renders above whatever
// mounted underneath and blocks/covers it, so the check lives in one place
// without needing an early-return in every guarded screen.
//
// Fails CLOSED: a Supabase/network error holds the blocking overlay and
// retries with backoff (1s, 2s, 4s, 8s — ~15s of retrying) rather than
// admitting the user as a learner — a network blip must not become a free-Pro
// bypass. If every retry is exhausted, the overlay shows a manual Retry
// button and a Sign Out escape hatch — never an infinite spinner with no way
// out, and never silent admission either.

const GUARDED_TAB_SEGMENT = '(tabs)';
const GUARDED_TOP_LEVEL_SEGMENTS = new Set([
  'hazard', 'roadsigns', 'highwaycode', 'progress', 'leaderboard',
  'studyplan', 'study-plan', 'testday', 'aitutor', 'challenge', 'ipassed',
]);
const INSTRUCTOR_CHECK_MAX_RETRIES = 4;
const INSTRUCTOR_CHECK_BASE_DELAY_MS = 1000;

function isGuardedSegment(segment: string | undefined): boolean {
  return segment === GUARDED_TAB_SEGMENT || GUARDED_TOP_LEVEL_SEGMENTS.has(segment ?? '');
}

type GuardStatus = 'ok' | 'blocked' | 'failed';
type GuardResult = { segment: string | undefined; status: GuardStatus };

function useInstructorRouteGuard() {
  const segments = useSegments();
  const currentSegment = segments[0] as string | undefined;
  const guarded = isGuardedSegment(currentSegment);

  const [result, setResult] = useState<GuardResult | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!guarded) return;
    let cancelled = false;
    let attempt = 0;

    async function check() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          // No session: not this guard's concern — other routing handles
          // unauthenticated access. Matches the prior per-screen guard,
          // which also only acted when a user was present.
          setResult({ segment: currentSegment, status: 'ok' });
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;

        if ((profile as { account_type?: string } | null)?.account_type === 'instructor') {
          setResult({ segment: currentSegment, status: 'blocked' });
          router.replace('/instructor');
        } else {
          setResult({ segment: currentSegment, status: 'ok' });
        }
      } catch {
        if (cancelled) return;
        attempt += 1;
        if (attempt > INSTRUCTOR_CHECK_MAX_RETRIES) {
          setResult({ segment: currentSegment, status: 'failed' });
          return;
        }
        const delay = INSTRUCTOR_CHECK_BASE_DELAY_MS * 2 ** (attempt - 1);
        setTimeout(() => { if (!cancelled) void check(); }, delay);
      }
    }

    void check();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSegment, guarded, retryNonce]);

  const effectiveStatus: 'checking' | GuardStatus = !guarded
    ? 'ok'
    : (result && result.segment === currentSegment) ? result.status : 'checking';

  return {
    blocking: effectiveStatus !== 'ok',
    effectiveStatus,
    retry: () => setRetryNonce(n => n + 1),
  };
}

async function handleGuardSignOut() {
  await supabase.auth.signOut();
  router.replace('/onboarding');
}

function InstructorRouteGuardOverlay() {
  const { blocking, effectiveStatus, retry } = useInstructorRouteGuard();
  if (!blocking) return null;

  return (
    <View style={guardStyles.overlay} pointerEvents="auto">
      {effectiveStatus === 'failed' ? (
        <View style={guardStyles.content}>
          <Text style={guardStyles.title}>{"Couldn't verify your account"}</Text>
          <Text style={guardStyles.body}>{'Check your connection and try again.'}</Text>
          <TouchableOpacity style={guardStyles.retryBtn} onPress={retry} activeOpacity={0.85}>
            <Text style={guardStyles.retryBtnText}>{'Retry'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void handleGuardSignOut()} activeOpacity={0.7}>
            <Text style={guardStyles.signOutText}>{'Sign Out'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ActivityIndicator size="large" color={Colors.indigo} />
      )}
    </View>
  );
}

const guardStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 10,
  },
  content: { alignItems: 'center', paddingHorizontal: 32 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  retryBtn: {
    backgroundColor: Colors.indigo,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginBottom: 14,
  },
  retryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  signOutText: { color: '#6B7280', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});

function SentryFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF' }}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
        {'Something went wrong'}
      </Text>
      <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
        {'Please close and reopen the app.'}
      </Text>
    </View>
  );
}

function RootLayout() {
  useFonts({
    'OpenDyslexic-Regular': require('../assets/fonts/OpenDyslexic-Regular.otf'),
    'OpenDyslexic-Bold': require('../assets/fonts/OpenDyslexic-Bold.otf'),
  });

  const navigated = useRef(false);
  const [showCachingToast, setShowCachingToast] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (navigated.current) return;

    async function bootstrap() {
      if (navigated.current) return;

      // Fired in parallel, not sequentially — none of the three depend on
      // each other, and this is the app's cold-boot critical path.
      //
      // initialUrl comes from Linking.getInitialURL(), not
      // useSegments()[0]. This used to read the current segment instead —
      // but on a cold start via a deep link (a magic-link tap, a referral
      // link, a confirm-parent email link), expo-router's own route
      // resolution and this effect's async work are racing each other:
      // segments could still reflect the app's default route, not yet the
      // deep-linked one, by the time this check ran. That let this effect
      // call router.replace() and silently stomp a route that was, or was
      // about to be, exactly where the user needed to land — confirmed on
      // device: a cold-start magic-link tap landed on plain sign-in with no
      // error at all, while the identical tap on an already-running (warm)
      // app worked, because on warm start this whole effect had already run
      // once and short-circuited above via navigated.current.
      //
      // Linking.getInitialURL() has no such race — it's the actual launch
      // URL, available immediately, independent of whatever expo-router has
      // or hasn't resolved yet. getDeepLinkPath (src/deepLinks.ts) is the
      // same normalisation handleIncomingUrl below already uses, so there's
      // one source of truth for "what path does this URL resolve to".
      const [{ data: { session } }, initialUrl, seenOnboarding] = await Promise.all([
        supabase.auth.getSession(),
        Linking.getInitialURL(),
        AsyncStorage.getItem(ONBOARDING_KEY),
      ]);
      const launchedPath = initialUrl ? getDeepLinkPath(initialUrl) : null;
      const launchedSegment = launchedPath ? launchedPath.split('/')[0] : null;

      const decision = resolveBootstrapDestination({
        hasSession: !!session,
        launchedSegment,
        hasSeenOnboarding: !!seenOnboarding,
      });

      if (session && Platform.OS !== 'web') {
        // Save Expo push token for cross-user notifications (challenge feature)
        void (async () => {
          try {
            const { status } = await Notifications.getPermissionsAsync();
            if (status === 'granted') {
              const { data: token } = await Notifications.getExpoPushTokenAsync({
                projectId: 'dac8f561-57cc-4b8b-b13d-7302561d71ee',
              });
              await supabase
                .from('profiles')
                .update({ expo_push_token: token })
                .eq('id', session.user.id);
            }
          } catch {}
        })();
      }

      navigated.current = true;

      if (decision.action === 'post-auth' && session) {
        // Same reasoning as app/auth/callback.tsx's goToDestination(): on
        // repeated failure, default to the screen that creates a profile
        // rather than the one that assumes it exists. One retry first,
        // since the likely cause is a transient network blip — most
        // traffic here is a returning, already-onboarded user, so this
        // only misroutes someone in the rare case of two consecutive
        // failures, and it's self-correcting (an existing account_type
        // is never overwritten by choose-account-type.tsx's insert).
        let route: string;
        try {
          route = await resolvePostAuthRoute(session.user.id);
        } catch {
          try {
            route = await resolvePostAuthRoute(session.user.id);
          } catch {
            route = '/auth/choose-account-type';
          }
        }
        router.replace(route);
      } else if (decision.action === 'signin') {
        router.replace('/auth/signin');
      } else if (decision.action === 'onboarding') {
        router.replace('/onboarding');
      }
      // 'none' — leave the current/in-flight route alone. Covers both an
      // already-authenticated direct route (e.g. web navigation straight to
      // /roadsigns) and every /auth/* destination (signin, signup, choose-
      // account-type, testdate, forgot-password, reset-password, callback)
      // plus the PUBLIC_ROUTES screens — overriding any of those here would
      // strip an in-flight route (and its query string, e.g. a referral
      // link's ?ref=, or a magic link's ?code=) by bouncing straight to
      // /auth/signin.
    }

    void bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Configure RevenueCat with the Supabase user id as appUserID, so its
  // webhook payloads match straight back to user_progress.id. A dedicated
  // subscription rather than a call in the bootstrap effect above (which
  // only ever runs once) or in individual sign-in/sign-up screens: this
  // fires for every transition into an authenticated state — cold boot
  // with a persisted session (INITIAL_SESSION), a fresh sign-in or
  // sign-up completing in the same app session (SIGNED_IN, previously
  // missed entirely), and token refreshes — so no current or future auth
  // entry point (email, Apple, Google, ...) can skip it. Fire-and-forget:
  // getPurchaseRoute() defaults to 'coming_soon' until this resolves,
  // which is the correct state anyway while it hasn't — see
  // src/purchaseGate.ts. configurePurchases() itself is a no-op on web.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        void configurePurchases(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Deep link handler
  useEffect(() => {
    function dispatch(url: string) {
      const link = handleIncomingUrl(url);
      if (link.type === 'confirmParent') {
        router.push({ pathname: '/confirm-parent', params: { token: link.token } } as any);
      } else if (link.type === 'referral') {
        router.push({ pathname: '/auth/signup', params: { ref: link.code } } as any);
      } else if (link.type === 'referralCapture') {
        void AsyncStorage.setItem('referral_code', link.code);
      }
    }

    Linking.getInitialURL().then(url => { if (url) dispatch(url); }).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => dispatch(url));
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background: cache static content on first launch or after a week
  useEffect(() => {
    void (async () => {
      const status = await getCacheStatus();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const stale = !status.lastCached || Date.now() - new Date(status.lastCached).getTime() > weekMs;
      const incomplete = !status.questions || !status.highwayCode || !status.roadSigns;
      if (incomplete || stale) {
        const firstTime = !status.questions;
        if (firstTime) setShowCachingToast(true);
        await Promise.all([cacheQuestions(), cacheHighwayCode(), cacheRoadSigns()]);
        if (firstTime) setTimeout(() => setShowCachingToast(false), 3000);
      }
    })();

    // Sync pending progress whenever connection is restored
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncWhenOnline();
    });
    return () => unsub();
  }, []);

  return (
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <AccessibilityProvider>
      <NetworkProvider>
      <PipVisibilityProvider>
        {Platform.OS === 'web' && <Head><title>ClearPass</title></Head>}
        <View suppressHydrationWarning style={{ flex: 1 }}>
          <Stack screenOptions={{ title: 'ClearPass' }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="landing" options={{ headerShown: false }} />
            <Stack.Screen name="paywall" options={{ headerShown: false }} />
            <Stack.Screen name="payment-success" options={{ headerShown: false }} />
            <Stack.Screen name="taster" options={{ headerShown: false }} />
            <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
            <Stack.Screen name="auth/choose-account-type" options={{ headerShown: false }} />
            <Stack.Screen name="auth/signin" options={{ headerShown: false }} />
            <Stack.Screen name="auth/testdate" options={{ headerShown: false }} />
            <Stack.Screen name="auth/forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="auth/reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="roadsigns" options={{ headerShown: false }} />
            <Stack.Screen name="highwaycode" options={{ headerShown: false }} />
            <Stack.Screen name="hazard" options={{ headerShown: false }} />
            <Stack.Screen name="progress" options={{ headerShown: false }} />
            <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
            <Stack.Screen name="aitutor" options={{ headerShown: false }} />
            <Stack.Screen name="studyplan" options={{ headerShown: false }} />
            <Stack.Screen name="testday" options={{ headerShown: false }} />
            <Stack.Screen name="instructor" options={{ headerShown: false }} />
            <Stack.Screen name="challenge" options={{ headerShown: false }} />
            <Stack.Screen name="ipassed" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
            <Stack.Screen name="terms" options={{ headerShown: false }} />
            <Stack.Screen name="legal" options={{ headerShown: false }} />
            <Stack.Screen name="contact" options={{ headerShown: false }} />
            <Stack.Screen name="confirm-parent" options={{ headerShown: false }} />
            <Stack.Screen name="screenshot-mode" options={{ headerShown: false }} />
            <Stack.Screen name="study-plan" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="light" />
          {/* Pip FAB — opens Ask Pip; hidden when already on tutor tab, or while
              PipVisibilityContext reports the current screen wants it hidden
              (e.g. the hazard perception player, so it doesn't sit over the
              video or steal taps meant for hazard scoring).
              Anchored below the header (not bottom-right) so it never overlaps
              in-content bottom controls — e.g. Mock Test's Prev/Next row, or any
              other screen's bottom CTA — which a fixed bottom-right FAB would
              otherwise sit on top of and intercept taps for. */}
          <PipFab top={insets.top + 56} />
          <InstructorRouteGuardOverlay />
          <CrossPlatformAlertHost />
          {showCachingToast && (
            <View style={[toastStyles.toast, { bottom: 96 + insets.bottom }]} pointerEvents="none">
              <Text style={toastStyles.text}>{'Downloading content for offline use...'}</Text>
            </View>
          )}
        </View>
      </PipVisibilityProvider>
      </NetworkProvider>
      </AccessibilityProvider>
    </Sentry.ErrorBoundary>
  );
}

function PipFab({ top }: { top: number }) {
  const segments = useSegments();
  const { hidden } = usePipVisibility();

  if (hidden || (segments as string[]).includes('tutor')) return null;

  // Derived from the current route rather than hardcoded — this FAB is
  // reachable from nearly every screen in the app.
  const currentPath = '/' + (segments as string[]).join('/');

  return (
    <TouchableOpacity
      style={[toastStyles.pipFab, { top }]}
      onPress={() => router.push({ pathname: '/tutor', params: { from: currentPath } } as any)}
      accessibilityLabel="Ask Pip"
      accessibilityRole="button"
    >
      <Text style={toastStyles.pipFabIcon}>{'🦔'}</Text>
    </TouchableOpacity>
  );
}

const toastStyles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  pipFab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  pipFabIcon: { fontSize: 24 },
});

function RootLayoutWithSafeArea() {
  return (
    <SafeAreaProvider>
      <RootLayout />
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayoutWithSafeArea);
