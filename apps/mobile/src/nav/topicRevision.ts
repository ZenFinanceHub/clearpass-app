/**
 * Topic revision picker (ClearPass 2.0, ui_v2 only; spec §6.2). PURE, so
 * plain Node tests it (scripts/lib/topicRevision.test.mjs).
 *
 * Lists every practice topic with the learner's existing local topic score.
 * Picking one opens the EXISTING topic launcher (practice?topic=<key>, the
 * same route Home's "Practise <topic>" uses). No new question logic.
 */
import { TOPIC_NAMES } from '../home/homeCopy.ts';
import { topicPracticeRoute, weakestTopic } from '../home/homeViewModel.ts';

/** Query param on /(tabs)/learn that opens the picker (see TOPIC_PICKER_ROUTE in routeMap). */
export const TOPIC_PICKER_PARAM = 'revise';

export interface TopicRevisionItem {
  key: string;
  name: string;
  /** Rounded topic score, or null if not attempted yet. */
  score: number | null;
  /** The learner's weakest attempted topic (same rule as Home's recommendation). */
  weakest: boolean;
  route: string;
}

export function topicRevisionList(scores: Record<string, number> | null | undefined): TopicRevisionItem[] {
  const s = scores ?? {};
  const weak = weakestTopic(s);
  return Object.keys(TOPIC_NAMES).map((key) => {
    const raw = s[key];
    const score = typeof raw === 'number' && Math.round(raw) > 0 ? Math.round(raw) : null;
    return { key, name: TOPIC_NAMES[key]!, score, weakest: weak?.key === key, route: topicPracticeRoute(key) };
  });
}
