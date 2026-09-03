import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import { supabase } from '@/src/supabase';
import { resolvePostAuthRoute } from '@/src/postAuthRouting';
import { Colors } from '@/src/constants/theme';

// How long to wait for Linking.useURL()/getInitialURL() to resolve a URL
// before concluding none is coming. useURL() is null on the very first
// render until the native module resolves the cold-start URL — this isn't
// a real failure, just not-yet-available, so it gets a bounded wait rather
// than an immediate error.
const RAW_URL_WAIT_MS = 3000;

// Mirrors socialAuth.ts's parseAuthRedirectParams(): hash params first,
// then search params override (Supabase's own parseParametersFromURL does
// the same — some failures land in the query instead of the fragment).
// Deliberately only reads .hash/.search, never .pathname/.host — this
// URL's .pathname/.host are unreliable for a non-http(s) scheme on React
// Native (confirmed against the installed polyfill: hardcoded to
// https?://, so they silently return '' for clearpass://), which is
// exactly why this screen no longer uses useLocalSearchParams() — that's
// populated from expo-router's own use of the same broken path parsing.
function parseAuthRedirectParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : '');
  new URLSearchParams(parsed.search).forEach((value, key) => params.set(key, value));
  return params;
}

// Receives the Google sign-in OAuth redirect, clearpass://auth/callback (see
// src/socialAuth.ts). signInWithGoogle() already tries to catch this in-line
// via WebBrowser.openAuthSessionAsync and complete the sign-in itself — on
// Android that interception isn't always reliable, and the OS can instead
// deliver this URL as an ordinary deep link, which previously had no route
// to land on and showed expo-router's "Unmatched Route" screen. This screen
// finishes the sign-in directly from the raw URL instead.
export default function AuthCallbackScreen() {
  const urlFromHook = Linking.useURL();
  const ran = useRef(false);
  // Shown inline rather than via Alert.alert — this screen is part of the
  // static web export (app.json web.output) and Alert is a no-op on
  // react-native-web, which would leave a web user with no feedback at all
  // (same reasoning as paywall.tsx's own notice/error text).
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (ran.current) return;
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled && !ran.current) {
        ran.current = true;
        fail('Sign in link was missing information. Please try again.');
      }
    }, RAW_URL_WAIT_MS);

    async function run() {
      // useURL() can still be null on this exact render — ask directly
      // rather than treating "not yet available" as "nothing was sent".
      const url = urlFromHook ?? (await Linking.getInitialURL());
      if (cancelled || ran.current) return;
      if (!url) return; // wait for urlFromHook to update, or the timeout above

      ran.current = true;
      clearTimeout(timeout);
      await completeSignIn(url);
    }

    void run();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFromHook]);

  async function goToDestination(userId: string) {
    // The safe default on repeated failure is the screen that creates the
    // profile, not the one that assumes it already exists — landing on
    // /(tabs)/home here used to mean a new user could get silently stranded
    // with no profile row and no way back to the screen that makes one.
    // One retry first, since the likely cause is a transient network blip.
    let route: string;
    try {
      route = await resolvePostAuthRoute(userId);
    } catch {
      try {
        route = await resolvePostAuthRoute(userId);
      } catch {
        route = '/auth/choose-account-type';
      }
    }
    router.replace(route);
  }

  function fail(message: string) {
    setErrorMessage(message);
  }

  async function completeSignIn(url: string) {
    try {
      const params = parseAuthRedirectParams(url);

      const oauthError = params.get('error');
      if (oauthError) {
        // The provider itself reported a failure (e.g. the user cancelled
        // or denied access) — nothing to establish a session from.
        fail(params.get('error_description') || 'Google sign in was not completed. Please try again.');
        return;
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) {
        // No tokens and no error. Most likely signInWithGoogle()'s own
        // openAuthSessionAsync call already caught this redirect and
        // completed sign-in before the OS also delivered it here as a
        // deep link — check for the session it may have already created.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await goToDestination(session.user.id);
        } else {
          fail('Sign in link was missing information. Please try again.');
        }
        return;
      }

      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (data.session) {
        await goToDestination(data.session.user.id);
        return;
      }

      if (sessionError) {
        // Unlike a PKCE code, a bearer token pair isn't single-use —
        // calling setSession() here with the same tokens signInWithGoogle()
        // already used in-line is harmless and idempotent, not a race to
        // guard against. A real failure here is worth reporting.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await goToDestination(session.user.id);
          return;
        }

        Sentry.captureException(sessionError, {
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
