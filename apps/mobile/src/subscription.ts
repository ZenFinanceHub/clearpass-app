import { supabase } from './supabase';

export const FREE_QUESTION_LIMIT = 10;

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
