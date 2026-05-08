import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { AccessibilityProvider } from '@/src/AccessibilityContext';
import { supabase } from '@/src/supabase';

const ONBOARDING_KEY = '@clearpass/hasSeenOnboarding';

export default function RootLayout() {
  useFonts({
    'OpenDyslexic-Regular': require('../assets/fonts/OpenDyslexic-Regular.otf'),
    'OpenDyslexic-Bold': require('../assets/fonts/OpenDyslexic-Bold.otf'),
  });

  const navigated = useRef(false);

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
        </Stack>
        <StatusBar style="light" />
      </>
    </AccessibilityProvider>
  );
}
