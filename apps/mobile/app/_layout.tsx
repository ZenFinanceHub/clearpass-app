import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { AccessibilityProvider } from '@/src/AccessibilityContext';
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

  useEffect(() => {
    if (navigated.current) return;

    async function bootstrap() {
      if (navigated.current) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigated.current = true;
        router.replace('/(tabs)/home');
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
      <>
        <Stack>
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
          <Stack.Screen name="studyplan" options={{ headerShown: false }} />
          <Stack.Screen name="testday" options={{ headerShown: false }} />
          <Stack.Screen name="instructor" options={{ headerShown: false }} />
          <Stack.Screen name="challenge" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="light" />
        {showCachingToast && (
          <View style={toastStyles.toast} pointerEvents="none">
            <Text style={toastStyles.text}>{'Downloading content for offline use...'}</Text>
          </View>
        )}
      </>
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
