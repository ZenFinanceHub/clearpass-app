import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const FREE_QUESTIONS_KEY = '@clearpass/free_questions_answered';
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

export async function getFreeQuestionsAnswered(): Promise<number> {
  const raw = await AsyncStorage.getItem(FREE_QUESTIONS_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

export async function incrementFreeQuestionsAnswered(): Promise<number> {
  const current = await getFreeQuestionsAnswered();
  const next = current + 1;
  await AsyncStorage.setItem(FREE_QUESTIONS_KEY, String(next));
  return next;
}
