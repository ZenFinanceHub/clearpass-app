import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
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
  // TEMPORARY DIAGNOSTIC — set by completeSignIn's raw-URL diagnostic below,
  // read by fail() so the raw URL shows up on screen no matter which branch
  // calls fail(). console.log produced nothing earlier today, so this is
  // the one channel that's actually worked — remove alongside the rest of
  // this diagnostic once the cause is found.
  const diagUrlRef = useRef('');

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
    // TEMPORARY DIAGNOSTIC: append the raw URL captured by completeSignIn's
    // diagnostic block, whenever one was captured — see diagUrlRef above.
    const suffix = diagUrlRef.current ? `\n\n[diag] ${diagUrlRef.current}` : '';
    setErrorMessage(message + suffix);
  }

  async function completeSignIn(url: string) {
    // ── TEMPORARY DIAGNOSTIC — magic-link investigation, relocated ─────────
    // Was previously only inside the ?code= branch, so it never fired for
    // the "missing information" outcome — exactly the case this is for.
    // Fires unconditionally, before any branching, so it captures the raw
    // URL regardless of which branch (error / code / access_token / none)
    // ends up running. Isolated in its own try/catch so it can never change
    // the real sign-in logic below, including if `new URL(url)` itself
    // throws (this codebase already has a documented quirk with this URL
    // polyfill on non-http(s) schemes — see parseAuthRedirectParams above —
    // so that throwing here is itself diagnostic information, not noise).
    // Unredacted on purpose — Craig's own throwaway test taps, and the
    // point is seeing exactly what did or didn't survive the mail-app ->
    // OS -> app handoff. Remove this whole block once the cause is found.
    try {
      const diagParsed = new URL(url);
      const diagData = {
        url,
        hashEmpty: !diagParsed.hash,
        searchEmpty: !diagParsed.search,
      };
      // Read by fail() below and appended to whatever's shown on screen —
      // console.log produced nothing earlier today, so this is the channel
      // that's actually worked.
      diagUrlRef.current = `url=${url} hashEmpty=${diagData.hashEmpty} searchEmpty=${diagData.searchEmpty}`;
      console.log('[auth-callback-diag] raw url:', url);
      console.log('[auth-callback-diag] hash empty:', diagData.hashEmpty, 'search empty:', diagData.searchEmpty);
      Sentry.addBreadcrumb({
        category: 'auth_callback_diagnostic',
        message: 'raw incoming callback URL',
        level: 'info',
        data: diagData,
      });
      Sentry.captureMessage('auth_callback_diagnostic: raw incoming URL', {
        level: 'info',
        tags: { context: 'auth_callback_diagnostic' },
        extra: diagData,
      });
    } catch (diagErr) {
      diagUrlRef.current = `url=${url} (new URL() threw: ${String(diagErr)})`;
      console.log('[auth-callback-diag] raw url (new URL() threw):', url, diagErr);
      Sentry.captureMessage('auth_callback_diagnostic: new URL() threw on raw incoming URL', {
        level: 'info',
        tags: { context: 'auth_callback_diagnostic' },
        extra: { url, error: String(diagErr) },
      });
    }
    // ── end TEMPORARY DIAGNOSTIC (relocated) ────────────────────────────────

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
      // Google/Apple and any other implicit-flow caller never produce a
      // `code` param, so this branch is unreached for them; the existing
      // access_token/refresh_token branch below is unchanged and still
      // exactly what they rely on.
      const code = params.get('code');
      if (code) {
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
