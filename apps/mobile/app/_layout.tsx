import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Stack, useSegments } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { ClearPassSupport } from '@/src/components/support/ClearPassSupport';
import { AccessibilityProvider } from '@/src/AccessibilityContext';
import { NetworkProvider } from '@/src/NetworkContext';
import { handleIncomingUrl } from '@/src/deepLinks';
import { supabase } from '@/src/supabase';
import { configureNotificationHandler } from '@/src/notifications';
import {
  getCacheStatus,
  cacheQuestions,
  cacheHighwayCode,
  cacheRoadSigns,
  syncWhenOnline,
} from '@/src/offlineCache';

configureNotificationHandler();

const ONBOARDING_KEY = '@clearpass/hasSeenOnboarding';

export default function RootLayout() {
  useFonts({
    'OpenDyslexic-Regular': require('../assets/fonts/OpenDyslexic-Regular.otf'),
    'OpenDyslexic-Bold': require('../assets/fonts/OpenDyslexic-Bold.otf'),
  });

  const navigated = useRef(false);
  const [showCachingToast, setShowCachingToast] = useState(false);
  const segments = useSegments();

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
          router.replace('/(tabs)/home');
        }
        return;
      }
      const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
      navigated.current = true;
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
    <AccessibilityProvider>
      <NetworkProvider>
      <>
        {Platform.OS === 'web' && <Head><title>ClearPass</title></Head>}
        <Stack screenOptions={{ title: 'ClearPass' }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="landing" options={{ headerShown: false }} />
          <Stack.Screen name="paywall" options={{ headerShown: false }} />
          <Stack.Screen name="payment-success" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
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
          <Stack.Screen name="i-passed" options={{ headerShown: false }} />
          <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
          <Stack.Screen name="terms" options={{ headerShown: false }} />
          <Stack.Screen name="confirm-parent"  options={{ headerShown: false }} />
          <Stack.Screen name="screenshot-mode" options={{ headerShown: false }} />
          <Stack.Screen name="study-plan"     options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="light" />
        <ClearPassSupport />
        {showCachingToast && (
          <View style={toastStyles.toast} pointerEvents="none">
            <Text style={toastStyles.text}>{'Downloading content for offline use...'}</Text>
          </View>
        )}
      </>
      </NetworkProvider>
    </AccessibilityProvider>
  );
}

const toastStyles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 96,
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
});
