import { supabase } from './supabase';

export async function submitSessionStats(topic: string, correct: number, total: number): Promise<void> {
  if (topic === 'Mixed' || topic === 'Speed Round' || total === 0) return;
  try {
    await supabase.rpc('update_aggregate_stats', {
      p_topic: topic,
      p_correct: correct,
      p_total: total,
    });
  } catch {}
}

export type ComparativeStats = {
  userPct: number;
  platformAvgPct: number;
  betterThan: number;
  totalAnswers: number;
};

export async function getComparativeStats(
  topic: string,
  userPct: number,
): Promise<ComparativeStats | null> {
  try {
    const { data } = await supabase
      .from('aggregate_stats')
      .select('total_correct, total_answered')
      .eq('topic', topic)
      .single();

    if (!data) return null;
    const row = data as { total_correct: number; total_answered: number };
    if (row.total_answered < 50) return null;

    const platformAvgPct = Math.round((row.total_correct / row.total_answered) * 100);
    const diff = userPct - platformAvgPct;
    const betterThan = Math.max(1, Math.min(99, 50 + Math.round(diff * 0.8)));

    return { userPct, platformAvgPct, betterThan, totalAnswers: row.total_answered };
  } catch { return null; }
}
