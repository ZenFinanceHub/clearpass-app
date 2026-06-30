import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type SocialAuthResult = {
  session: Session;
  isNewUser: boolean;
};

async function ensureProfile(userId: string, displayName?: string, email?: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (existing) return false;

  let username = '';
  if (displayName) {
    username = displayName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').slice(0, 20);
  }
  if (!username && email) {
    username = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
  }
  if (!username) username = `user${Math.floor(Math.random() * 99999)}`;

  await supabase.from('profiles').insert({ id: userId, username });
  return true;
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
  const isNewUser = await ensureProfile(session.user.id, displayName, email);

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
  const isNewUser = await ensureProfile(session.user.id, displayName, session.user.email);

  return { session, isNewUser };
}
