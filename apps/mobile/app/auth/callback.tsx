import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/supabase';
import { resolvePostAuthRoute } from '@/src/postAuthRouting';
import { Colors } from '@/src/constants/theme';

// Receives the Google sign-in OAuth redirect, clearpass://auth/callback (see
// src/socialAuth.ts). signInWithGoogle() already tries to catch this in-line
// via WebBrowser.openAuthSessionAsync and exchange the code itself — on
// Android that interception isn't always reliable, and the OS can instead
// deliver this URL as an ordinary deep link, which previously had no route
// to land on and showed expo-router's "Unmatched Route" screen. This screen
// finishes the sign-in directly from the URL instead.
export default function AuthCallbackScreen() {
  const { code, error, error_description: errorDescription } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const ran = useRef(false);
  // Shown inline rather than via Alert.alert — this screen is part of the
  // static web export (app.json web.output) and Alert is a no-op on
  // react-native-web, which would leave a web user with no feedback at all
  // (same reasoning as paywall.tsx's own notice/error text).
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void completeSignIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function goToDestination(userId: string) {
    let route = '/(tabs)/home';
    try {
      route = await resolvePostAuthRoute(userId);
    } catch {}
    router.replace(route);
  }

  function fail(message: string) {
    setErrorMessage(message);
  }

  async function completeSignIn() {
    try {
      if (error) {
        // The provider itself reported a failure (e.g. the user cancelled
        // or denied access) — nothing to exchange.
        fail(errorDescription || 'Google sign in was not completed. Please try again.');
        return;
      }

      if (!code) {
        // No code and no error. Most likely signInWithGoogle()'s own
        // openAuthSessionAsync call already caught this redirect and
        // completed the exchange before the OS also delivered it here as a
        // deep link — check for the session it may have already created.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await goToDestination(session.user.id);
        } else {
          fail('Sign in link was missing information. Please try again.');
        }
        return;
      }

      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (data.session) {
        await goToDestination(data.session.user.id);
        return;
      }

      if (exchangeError) {
        // A PKCE code is single-use. If signInWithGoogle()'s own in-line
        // exchange already consumed it, this call is *expected* to fail —
        // check for an existing session before treating it as real failure.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await goToDestination(session.user.id);
          return;
        }

        Sentry.captureException(exchangeError, {
          tags: { context: 'auth_callback_exchange' },
        });
        fail('Sign in failed. Please try again.');
      }
    } catch (e) {
      // Defensive: must never leave the user on a blank screen, no matter
      // what fails above.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await goToDestination(session.user.id);
          return;
        }
      } catch {}
      Sentry.captureException(e, { tags: { context: 'auth_callback_exchange' } });
      fail('Sign in failed. Please try again.');
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {errorMessage ? (
        <>
          <Text style={styles.errorTitle}>{'Sign in failed'}</Text>
          <Text style={styles.text}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/auth/signin')}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{'Go to Sign In'}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={Colors.indigo} />
          <Text style={styles.text}>{'Signing you in…'}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
    backgroundColor: '#F7F8FA',
  },
  text: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  button: {
    marginTop: 8,
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
