import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
// TEMPORARY DIAGNOSTIC import — PKCE exchange failure investigation. Remove
// alongside the rest of this diagnostic once the cause is found.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/supabase';
import { supabaseMagicLink } from '@/src/supabaseMagicLink';
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
// Deliberately only reads .hash/.search, never .pathname/.host — not
// because those are broken (they aren't: expo-router's own routing reads
// exactly those fields and correctly lands this screen), but because this
// function's whole job is recovering the access_token/refresh_token pair
// from the URL *fragment* for the implicit-flow (Google/Apple) case — and
// expo-router structurally drops URL fragments before it ever builds route
// params (confirmed against fork/extractPathFromURL.js's fromDeepLink(),
// 2026-09-15), so useLocalSearchParams() can never carry them. Query
// params (PKCE's `code`) don't have that problem and ARE read via
// useLocalSearchParams() below, in the effect.
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
  // PKCE's `code` (and any query-delivered `error`) — populated by
  // expo-router's own successful routing to this screen, so unlike
  // urlFromHook/getInitialURL() below there's no "not resolved yet" race:
  // if this component is mounted, routing already finished and these are
  // already known.
  const { code: codeParam, error: errorParam, error_description: errorDescriptionParam } =
    useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const ran = useRef(false);
  // Shown inline rather than via Alert.alert — this screen is part of the
  // static web export (app.json web.output) and Alert is a no-op on
  // react-native-web, which would leave a web user with no feedback at all
  // (same reasoning as paywall.tsx's own notice/error text).
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (ran.current) return;

    // PKCE (magic link): handle directly from the already-resolved route
    // params, without starting the urlFromHook/getInitialURL() race or its
    // timeout below at all — this is what was firing "missing information"
    // even though `code` had already arrived, because the race lost. The
    // URL-based `code` branch inside completeSignIn() stays in place as a
    // fallback for whatever case would make this not fire.
    if (codeParam) {
      ran.current = true;
      void completeMagicLinkSignIn(codeParam);
      return;
    }
    if (errorParam) {
      ran.current = true;
      fail(errorDescriptionParam || 'Sign in was not completed. Please try again.');
      return;
    }

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
  }, [urlFromHook, codeParam, errorParam, errorDescriptionParam]);

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

  async function completeMagicLinkSignIn(code: string) {
    // ── TEMPORARY DIAGNOSTIC — PKCE exchange failure investigation ────
    // Remove this whole block (verifier check, captureMessage, and the
    // verbatim-error fail() below) once the cause is found. Reports
    // presence/length only for the stored code verifier, never its
    // value — same convention as every other diagnostic this session:
    // real data, no secrets on screen or in Sentry.
    let verifierPresent = false;
    let verifierLength = 0;
    try {
      const verifierRaw = await AsyncStorage.getItem('sb-clearpass-magiclink-pkce-code-verifier');
      verifierPresent = verifierRaw !== null;
      verifierLength = verifierRaw?.length ?? 0;
    } catch {}
    // ── end TEMPORARY DIAGNOSTIC (verifier check) ──────────────────────

    try {
      const { data: exchangeData, error: exchangeError } = await supabaseMagicLink.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        // ── TEMPORARY DIAGNOSTIC — cross-check via Sentry, independent of
        // the on-screen text below in case Sentry delivery itself fails.
        Sentry.captureMessage('auth_callback_pkce_exchange_diagnostic', {
          level: 'info',
          tags: { context: 'auth_callback_pkce_exchange_diagnostic' },
          extra: {
            verifierPresent,
            verifierLength,
            errorMessage: exchangeError.message,
            errorCode: exchangeError.code ?? null,
            errorStatus: exchangeError.status ?? null,
          },
        });
        // ── end TEMPORARY DIAGNOSTIC (Sentry cross-check) ──────────────────
        Sentry.captureException(exchangeError, {
          tags: { context: 'auth_callback_pkce_exchange' },
        });
        // TEMPORARY: verbatim error + verifier state surfaced on screen for
        // diagnosis — revert to the generic "Sign in failed. Please try
        // again." once resolved.
        fail(
          `Sign in failed: [${exchangeError.code ?? 'no-code'}] ${exchangeError.message} ` +
          `(verifier: ${verifierPresent ? `present, ${verifierLength} chars` : 'ABSENT'})`
        );
        return;
      }

      if (exchangeData.session) {
        // Fold the exchanged session into the MAIN client — supabase
        // (src/supabase.ts) is the single source of truth for "am I
        // logged in" throughout this app; supabaseMagicLink only ever
        // requests and exchanges (persistSession: false), never holds a
        // session of its own. Same setSession() shape the
        // access_token/refresh_token branch below already uses, so
        // goToDestination and everything downstream doesn't care which
        // flow shape produced the tokens.
        const { data: mainSessionData, error: setSessionError } = await supabase.auth.setSession({
          access_token: exchangeData.session.access_token,
          refresh_token: exchangeData.session.refresh_token,
        });
        if (mainSessionData.session) {
          await goToDestination(mainSessionData.session.user.id);
          return;
        }
        if (setSessionError) {
          Sentry.captureException(setSessionError, {
            tags: { context: 'auth_callback_pkce_setsession' },
          });
        }
      }

      fail('Sign in failed. Please try again.');
    } catch (e) {
      // Defensive: must never leave the user on a blank screen, no matter
      // what fails above — same convention as completeSignIn's own catch.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await goToDestination(session.user.id);
          return;
        }
      } catch {}
      Sentry.captureException(e, { tags: { context: 'auth_callback_pkce_exchange' } });
      fail('Sign in failed. Please try again.');
    }
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

      // PKCE shape — the magic-link request/completion pair (see
      // src/supabaseMagicLink.ts and signup.tsx's handleSendMagicLink).
      // Normally intercepted earlier via useLocalSearchParams() in the
      // effect above, before completeSignIn() is ever called — this stays
      // as a fallback for whatever case makes that not fire. Google/Apple
      // and any other implicit-flow caller never produce a `code` param,
      // so this branch is unreached for them either way; the existing
      // access_token/refresh_token branch below is unchanged and still
      // exactly what they rely on.
      const code = params.get('code');
      if (code) {
        await completeMagicLinkSignIn(code);
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
