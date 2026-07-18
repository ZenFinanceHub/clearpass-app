import { supabase } from './supabase';

export type PostAuthRoute = '/(tabs)/home' | '/instructor' | '/auth/choose-account-type';

export async function resolvePostAuthRoute(userId: string): Promise<PostAuthRoute> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', userId)
    .maybeSingle();

  const accountType = (profile as { account_type?: string } | null)?.account_type;
  if (!accountType) return '/auth/choose-account-type';
  return accountType === 'instructor' ? '/instructor' : '/(tabs)/home';
}
