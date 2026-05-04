import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AccessibilityProvider } from '@/src/AccessibilityContext';

export default function RootLayout() {
  return (
    <AccessibilityProvider>
      <>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="landing" options={{ headerShown: false }} />
          <Stack.Screen name="payment-success" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="light" />
      </>
    </AccessibilityProvider>
  );
}
