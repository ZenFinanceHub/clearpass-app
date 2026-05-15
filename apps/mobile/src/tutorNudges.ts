import AsyncStorage from '@react-native-async-storage/async-storage';
import { TopicCategory, UserProgress, Question } from '@clearpass/core';
import { SpacedRepetitionState } from './spacedRepetition';

const NUDGE_KEY = '@clearpass/tutor_nudges';

export const TOPIC_LABELS: Record<TopicCategory, string> = {
  [TopicCategory.Alertness]:               'Alertness',
  [TopicCategory.Attitude]:                'Attitude',
  [TopicCategory.SafetyAndYourVehicle]:    'Safety & Your Vehicle',
  [TopicCategory.SafetyMargins]:           'Safety Margins',
  [TopicCategory.HazardAwareness]:         'Hazard Awareness',
  [TopicCategory.VulnerableRoadUsers]:     'Vulnerable Road Users',
  [TopicCategory.OtherTypes]:              'Other Types of Vehicle',
  [TopicCategory.VehicleHandling]:         'Vehicle Handling',
  [TopicCategory.MotorwayRules]:           'Motorway Rules',
  [TopicCategory.RulesOfTheRoad]:          'Rules of the Road',
  [TopicCategory.RoadAndTrafficSigns]:     'Road & Traffic Signs',
  [TopicCategory.DocumentsAndRegulations]: 'Documents & Regulations',
  [TopicCategory.AccidentsAndEmergencies]: 'Accidents & Emergencies',
  [TopicCategory.VehicleLoading]:          'Vehicle Loading',
};

export type NudgeType =
  | 'struggling_topic'
  | 'mock_score_dropped'
  | 'streak_at_risk'
  | 'milestone_close'
  | 'ready_for_mock'
  | 'weak_area_detected'
  | 'inactivity';

export type TutorNudge = {
  id: string;
  type: NudgeType;
  title: string;
  body: string;
  actionLabel: string;
  actionRoute: string;
  actionParams?: Record<string, string>;
  dismissed: boolean;
  generatedAt: string;
};

type StoredNudges = {
  nudges: TutorNudge[];
  generatedAt: string;
};

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA.split('T')[0]);
  const b = new Date(isoB.split('T')[0]);
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000);
}

function computeMilestone(p: UserProgress): number {
  if (p.totalQuestionsAnswered < 1) return 0;
  const totalTopics = Object.keys(p.topicScores).length || 14;
  const attempted = Object.values(p.topicScores).filter(s => s > 0).length;
  if (attempted < Math.ceil(totalTopics * 0.5)) return 1;
  if (!p.hazardPerceptionHistory.some(h => h.passed)) return 2;
  if (p.totalQuestionsAnswered < 200) return 3;
  if (!p.mockTestHistory.some(h => h.passed)) return 4;
  const mh = p.mockTestHistory;
  const twoConsec = mh.some((_, i) => i > 0 && mh[i].passed && mh[i - 1].passed);
  if (!twoConsec) return 5;
  const threeConsec = mh.some(
    (_, i) =>
      i >= 2 &&
      mh[i].passed     && mh[i].score     >= 43 &&
      mh[i - 1].passed && mh[i - 1].score >= 43 &&
      mh[i - 2].passed && mh[i - 2].score >= 43,
  );
  return threeConsec ? 7 : 6;
}

export function generateNudges(
  progress: UserProgress,
  srState: SpacedRepetitionState,
  allQuestions: Question[],
): TutorNudge[] {
  const nudges: TutorNudge[] = [];
  const now   = new Date().toISOString();
  const today = todayStr();
  const reviews = Object.values(srState.reviews);

  // Build questionId → TopicCategory map
  const topicMap = new Map<string, TopicCategory>();
  for (const q of allQuestions) topicMap.set(q.id, q.topicCategory);

  // Aggregate SR stats per topic
  const topicSR = new Map<TopicCategory, { correct: number; total: number }>();
  for (const r of reviews) {
    const topic = topicMap.get(r.questionId);
    if (!topic) continue;
    const cur = topicSR.get(topic) ?? { correct: 0, total: 0 };
    topicSR.set(topic, { correct: cur.correct + r.correctReviews, total: cur.total + r.totalReviews });
  }

  // 1. streak_at_risk
  const lastStudied = progress.lastStudied?.split('T')[0] ?? '';
  if (progress.studyStreakDays > 0 && lastStudied !== today) {
    nudges.push({
      id: `streak_at_risk_${today}`,
      type: 'streak_at_risk',
      title: 'Streak at risk!',
      body: `You have a ${progress.studyStreakDays}-day streak. Study today to keep it alive.`,
      actionLabel: 'Practice Now',
      actionRoute: '/(tabs)/practice',
      dismissed: false,
      generatedAt: now,
    });
  }

  // 2. mock_score_dropped
  const mocks = [...(progress.mockTestHistory ?? [])].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
  );
  if (mocks.length >= 2 && mocks[0].score < mocks[1].score - 4) {
    nudges.push({
      id: `mock_score_dropped_${today}`,
      type: 'mock_score_dropped',
      title: 'Mock score dropped',
      body: `Your last mock was ${mocks[0].score}/50, down from ${mocks[1].score}/50. Let's get back on track.`,
      actionLabel: 'Ask AI Tutor',
      actionRoute: '/(tabs)/tutor',
      dismissed: false,
      generatedAt: now,
    });
  }

  // 3. struggling_topic
  let hasStrugglingTopic = false;
  {
    let worstTopic: TopicCategory | null = null;
    let worstAccuracy = Infinity;
    for (const [topic, stats] of topicSR.entries()) {
      if (stats.total < 5) continue;
      const acc = stats.correct / stats.total;
      if (acc < 0.4 && acc < worstAccuracy) {
        worstAccuracy = acc;
        worstTopic = topic;
      }
    }
    if (worstTopic !== null) {
      hasStrugglingTopic = true;
      const label = TOPIC_LABELS[worstTopic];
      nudges.push({
        id: `struggling_topic_${today}`,
        type: 'struggling_topic',
        title: `Struggling with ${label}`,
        body: `You're getting ${Math.round(worstAccuracy * 100)}% on ${label} questions. Let's work through it together.`,
        actionLabel: 'Ask AI Tutor',
        actionRoute: '/(tabs)/tutor',
        actionParams: { topic: worstTopic },
        dismissed: false,
        generatedAt: now,
      });
    }
  }

  // 4. weak_area_detected (only if no struggling_topic)
  if (!hasStrugglingTopic) {
    const attempted: { topic: TopicCategory; accuracy: number }[] = [];
    for (const [topic, stats] of topicSR.entries()) {
      if (stats.total >= 5) attempted.push({ topic, accuracy: stats.correct / stats.total });
    }
    if (attempted.length >= 5) {
      const avg = attempted.reduce((s, a) => s + a.accuracy, 0) / attempted.length;
      const weak = attempted
        .filter(a => a.accuracy < avg - 0.2)
        .sort((a, b) => a.accuracy - b.accuracy)[0];
      if (weak) {
        const label = TOPIC_LABELS[weak.topic];
        nudges.push({
          id: `weak_area_detected_${today}`,
          type: 'weak_area_detected',
          title: `Weak area: ${label}`,
          body: `${label} is ${Math.round((avg - weak.accuracy) * 100)}% below your average. Focus here to improve.`,
          actionLabel: 'Practice This Topic',
          actionRoute: '/(tabs)/practice',
          dismissed: false,
          generatedAt: now,
        });
      }
    }
  }

  // 5. inactivity
  const daysSinceLast = lastStudied ? daysBetween(lastStudied, today) : 99;
  if (daysSinceLast >= 2) {
    const daysToTest = progress.testDate
      ? Math.max(0, Math.round((new Date(progress.testDate).getTime() - Date.now()) / 86400000))
      : null;
    const testMsg = daysToTest !== null ? ` Your test is in ${daysToTest} days.` : '';
    nudges.push({
      id: `inactivity_${today}`,
      type: 'inactivity',
      title: `${daysSinceLast} days without studying`,
      body: `You haven't studied in ${daysSinceLast} days.${testMsg} Get back on track!`,
      actionLabel: 'Resume Practice',
      actionRoute: '/(tabs)/practice',
      dismissed: false,
      generatedAt: now,
    });
  }

  // 6. ready_for_mock
  {
    const totalReviews = reviews.reduce((s, r) => s + r.totalReviews, 0);
    const totalCorrect = reviews.reduce((s, r) => s + r.correctReviews, 0);
    const acc = totalReviews > 0 ? totalCorrect / totalReviews : 0;
    const sortedMocks = [...(progress.mockTestHistory ?? [])].sort(
      (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
    );
    const daysSinceLastMock = sortedMocks.length > 0
      ? daysBetween(sortedMocks[0].takenAt, today)
      : 99;
    if (reviews.length >= 20 && acc > 0.7 && daysSinceLastMock >= 7) {
      nudges.push({
        id: `ready_for_mock_${today}`,
        type: 'ready_for_mock',
        title: 'Ready for a mock test?',
        body: `Your accuracy is at ${Math.round(acc * 100)}%. Time to test yourself with a full mock!`,
        actionLabel: 'Take Mock Test',
        actionRoute: '/(tabs)/mock',
        dismissed: false,
        generatedAt: now,
      });
    }
  }

  // 7. milestone_close
  {
    const milestone = computeMilestone(progress);
    const totalTopics = 14;
    const attempted = Object.values(progress.topicScores).filter(s => s > 0).length;

    if (milestone === 1 && totalTopics - attempted <= 2) {
      const needed = totalTopics - attempted;
      nudges.push({
        id: `milestone_close_${today}`,
        type: 'milestone_close',
        title: 'Almost at next milestone!',
        body: `Try ${needed} more topic${needed === 1 ? '' : 's'} to reach the next milestone.`,
        actionLabel: 'Practice Now',
        actionRoute: '/(tabs)/practice',
        dismissed: false,
        generatedAt: now,
      });
    } else if (milestone === 3 && 200 - progress.totalQuestionsAnswered <= 30) {
      const needed = 200 - progress.totalQuestionsAnswered;
      nudges.push({
        id: `milestone_close_${today}`,
        type: 'milestone_close',
        title: 'Almost at Mock Ready!',
        body: `Answer ${needed} more question${needed === 1 ? '' : 's'} to unlock the Mock Ready milestone.`,
        actionLabel: 'Practice Now',
        actionRoute: '/(tabs)/practice',
        dismissed: false,
        generatedAt: now,
      });
    }
  }

  return nudges;
}

export async function saveNudges(nudges: TutorNudge[]): Promise<void> {
  const stored: StoredNudges = { nudges, generatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(NUDGE_KEY, JSON.stringify(stored));
}

export async function loadNudges(): Promise<StoredNudges | null> {
  try {
    const raw = await AsyncStorage.getItem(NUDGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredNudges;
  } catch {
    return null;
  }
}

export async function dismissNudge(id: string): Promise<void> {
  const stored = await loadNudges();
  if (!stored) return;
  const updated = stored.nudges.map(n => n.id === id ? { ...n, dismissed: true } : n);
  await saveNudges(updated);
}

export async function getActiveNudges(): Promise<TutorNudge[]> {
  const stored = await loadNudges();
  if (!stored) return [];
  const ageMs = Date.now() - new Date(stored.generatedAt).getTime();
  if (ageMs > 24 * 60 * 60 * 1000) return [];
  return stored.nudges.filter(n => !n.dismissed);
}
