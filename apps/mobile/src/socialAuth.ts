import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export type SocialAuthResult = {
  session: Session;
  isNewUser: boolean;
};

export function getAuthErrorCode(e: unknown): string | number | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const err = e as { code?: string; status?: number };
  return err.code ?? err.status;
}

const PENDING_USERNAME_KEY = '@clearpass/pending_username';

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
  // Apple requires the SHA-256 hash of the nonce; Supabase then verifies the
  // id_token's embedded hash against the RAW nonce we send it. Swapping these
  // two breaks sign-in outright, so keep rawNonce/hashedNonce distinct below.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) throw new Error('Apple Sign In: no identity token received');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
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

  const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
  if (sessionError) throw sessionError;

  const session = sessionData.session;
  if (!session) return null;

  const meta = session.user.user_metadata as Record<string, unknown>;
  const displayName = (meta?.full_name ?? meta?.name) as string | undefined;
  const isNewUser = await checkIsNewUser(session.user.id);
  if (isNewUser) await stashPendingIdentity(displayName, session.user.email);

  return { session, isNewUser };
}
