import * as Sentry from '@sentry/react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { handleIncomingUrl } from '@/src/deepLinks';
import { supabase } from '@/src/supabase';
import { configureNotificationHandler } from '@/src/notifications';
import { resolvePostAuthRoute } from '@/src/postAuthRouting';
import {
  getCacheStatus,
  cacheQuestions,
  cacheHighwayCode,
  cacheRoadSigns,
  syncWhenOnline,
} from '@/src/offlineCache';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: __DEV__ ? 'development' : 'production',
});

configureNotificationHandler();

const ONBOARDING_KEY = '@clearpass/hasSeenOnboarding';

// Legal/contact pages must stay reachable without an account — the App Store
// listing links directly to these, and they're legally required to be public.
const PUBLIC_ROUTES = new Set(['privacy-policy', 'terms', 'legal', 'contact']);

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
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (navigated.current) return;

    async function bootstrap() {
      if (navigated.current) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Save Expo push token for cross-user notifications (challenge feature)
        if (Platform.OS !== 'web') {
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
        // Only redirect to home from unauthenticated entry points.
        // If the user is already on an authenticated route (e.g. direct web
        // navigation to /roadsigns), let it through without overriding.
        const entryPoints = new Set(['', 'index', 'onboarding', 'landing']);
        if (entryPoints.has(segments[0] ?? '')) {
          let route = '/(tabs)/home';
          try {
            route = await resolvePostAuthRoute(session.user.id);
          } catch {}
          router.replace(route);
        }
        return;
      }
      navigated.current = true;
      if (PUBLIC_ROUTES.has(segments[0] ?? '')) {
        return;
      }
      const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (seen) {
        router.replace('/auth/signin');
      } else {
        router.replace('/onboarding');
      }
    }

    void bootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          {/* Pip FAB — opens Ask Pip; hidden when already on tutor tab */}
          {!(segments as string[]).includes('tutor') && (
            <TouchableOpacity
              style={[toastStyles.pipFab, { bottom: 96 + insets.bottom }]}
              onPress={() => router.push('/tutor' as any)}
              accessibilityLabel="Ask Pip"
              accessibilityRole="button"
            >
              <Text style={toastStyles.pipFabIcon}>{'🦔'}</Text>
            </TouchableOpacity>
          )}
          {showCachingToast && (
            <View style={[toastStyles.toast, { bottom: 96 + insets.bottom }]} pointerEvents="none">
              <Text style={toastStyles.text}>{'Downloading content for offline use...'}</Text>
            </View>
          )}
        </View>
      </NetworkProvider>
      </AccessibilityProvider>
    </Sentry.ErrorBoundary>
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
