import { supabase } from './supabase';

export const FREE_QUESTION_LIMIT = 10;

/**
 * Read-only: the signed-in learner's entitlement fields as the webhooks
 * stored them (same row and query as isPremium). Used by Profile ›
 * Subscription under ui_v2 to say where Pro came from. Never writes.
 */
export async function getEntitlementState(): Promise<{ isPro: boolean; proExpiresAt: string | null; proSource: string | null }> {
  const none = { isPro: false, proExpiresAt: null, proSource: null };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return none;
    const { data } = await supabase
      .from('user_progress')
      .select('progress')
      .eq('id', user.id)
      .single();
    const p = (data?.progress ?? null) as { isPro?: boolean; proExpiresAt?: string | null; proSource?: string | null } | null;
    if (!p) return none;
    return { isPro: p.isPro === true, proExpiresAt: p.proExpiresAt ?? null, proSource: p.proSource ?? null };
  } catch {
    return none;
  }
}

export async function isPremium(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from('user_progress')
      .select('progress')
      .eq('id', user.id)
      .single();
    if (!data) return false;
    const progress = data.progress as { isPro?: boolean } | null;
    return progress?.isPro === true;
  } catch {
    return false;
  }
}
