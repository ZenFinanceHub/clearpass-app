import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type SocialAuthResult = {
  session: Session;
  isNewUser: boolean;
};

const PENDING_USERNAME_KEY = '@clearpass/pending_username';

// The Supabase client (src/supabase.ts) deliberately stays on the default
// 'implicit' flow rather than 'pkce'. That's not driven by Google/Apple
// here — it's a DIFFERENT flow sharing this same client: password-reset
// (app/auth/forgot-password.tsx) always requests from the native app
// (AsyncStorage) but completes in a separate browser origin (the
// web-exported app at clearpass-app.vercel.app, a different localStorage
// entirely) — PKCE's code_verifier is tied to whichever storage initiated
// the request, so that exchange could never succeed under PKCE. Magic-link
// sign-in doesn't have that constraint (it resolves back into this same
// native app process, not a separate browser) and now uses its own
// dedicated PKCE client instead — see src/supabaseMagicLink.ts and
// app/auth/callback.tsx's ?code= branch. Google stays on THIS client's
// implicit flow because it already works and has no cross-origin problem
// forcing a change: the OAuth redirect carries self-contained bearer
// tokens in the URL fragment (#access_token=...&refresh_token=...), not a
// code — setSession() establishes the session directly from those, no
// exchange round trip or stored verifier needed.
//
// Mirrors Supabase's own parseParametersFromURL (auth-js/lib/helpers.js):
// hash params first, then search params override — some failures (e.g. a
// provider-level error before Supabase issues tokens) can land in the
// query instead of the fragment. Deliberately only reads .hash/.search —
// this URL's .pathname/.host are unreliable for a non-http(s) scheme on
// React Native (see app/auth/callback.tsx), so this never touches them.
function parseAuthRedirectParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : '');
  new URLSearchParams(parsed.search).forEach((value, key) => params.set(key, value));
  return params;
}

async function checkIsNewUser(userId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  return !existing;
}

async function stashPendingIdentity(displayName?: string, email?: string): Promise<void> {
  let username = '';
  if (displayName) {
    username = displayName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').slice(0, 20);
  }
  if (!username && email) {
    username = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
  }
  if (!username) username = `user${Math.floor(Math.random() * 99999)}`;
  await AsyncStorage.setItem(PENDING_USERNAME_KEY, username);
}

export async function signInWithApple(): Promise<SocialAuthResult> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) throw new Error('Apple Sign In: no identity token received');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;

  const session = data.session;
  if (!session) throw new Error('Apple Sign In: no session returned');

  const parts = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean);
  const displayName = parts.join(' ') || undefined;
  const email = credential.email ?? session.user.email;
  const isNewUser = await checkIsNewUser(session.user.id);
  if (isNewUser) await stashPendingIdentity(displayName, email);

  return { session, isNewUser };
}

export async function signInWithGoogle(): Promise<SocialAuthResult | null> {
  const redirectTo = makeRedirectUri({ scheme: 'clearpass', path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) return null;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return null;

  const params = parseAuthRedirectParams(result.url);
  const oauthError = params.get('error');
  if (oauthError) {
    throw new Error(params.get('error_description') || oauthError);
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw sessionError;

  const session = sessionData.session;
  if (!session) return null;

  const meta = session.user.user_metadata as Record<string, unknown>;
  const displayName = (meta?.full_name ?? meta?.name) as string | undefined;
  const isNewUser = await checkIsNewUser(session.user.id);
  if (isNewUser) await stashPendingIdentity(displayName, session.user.email);

  return { session, isNewUser };
}
