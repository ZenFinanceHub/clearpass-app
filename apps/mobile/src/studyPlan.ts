import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProgress, TopicCategory } from '@clearpass/core';
import { getProxyUrl } from './proxyUrl';

export type StudyTaskType =
  | 'questions'
  | 'mock'
  | 'hazard'
  | 'highway_code'
  | 'road_signs'
  | 'rest'
  | 'weakspots'
  | 'revision';

export interface StudyTask {
  type: StudyTaskType;
  description: string;
  topicCategory?: string;
  count?: number;
}

export interface StudyDay {
  date: string;
  dayNumber: number;
  daysUntilTest: number;
  tasks: StudyTask[];
  estimatedMinutes: number;
}

export interface StudyPlan {
  generatedAt: string;
  testDate: string;
  dailyMinutes: number;
  days: StudyDay[];
}

const STORAGE_KEY = '@clearpass/study_plan';


export async function generateStudyPlan(
  testDate: string,
  progress: UserProgress,
  dailyMinutes: number,
): Promise<StudyPlan> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const test = new Date(testDate);
  const testDay = new Date(test.getFullYear(), test.getMonth(), test.getDate());
  const daysUntil = Math.max(1, Math.round((testDay.getTime() - todayDay.getTime()) / 86400000));
  const daysToShow = Math.min(daysUntil, 30);

  const scored = Object.entries(progress.topicScores) as [string, number][];
  const attempted = scored.filter(([, s]) => s > 0);
  const weakTopics = attempted
    .sort(([, a], [, b]) => a - b)
    .slice(0, 5)
    .map(([t]) => t);
  const planTopics =
    weakTopics.length >= 2
      ? weakTopics
      : (Object.values(TopicCategory) as string[]).slice(0, 5);

  const avgAccuracy =
    attempted.length > 0
      ? Math.round((attempted.reduce((a, [, s]) => a + s, 0) / attempted.length) * 100)
      : 0;

  const prompt =
    `Generate a UK driving theory test study plan.\n` +
    `Test date: ${testDate.split('T')[0]}\n` +
    `Days until test: ${daysUntil}\n` +
    `Daily study time: ${dailyMinutes} minutes\n` +
    `Weak topics needing focus: ${planTopics.join(', ')}\n` +
    `Current average accuracy: ${avgAccuracy}%\n\n` +
    `Return ONLY a valid JSON array with exactly ${daysToShow} items starting from today ${todayStr}.\n` +
    `Each item must follow this exact shape (no extra keys):\n` +
    `{"date":"YYYY-MM-DD","dayNumber":N,"daysUntilTest":N,"tasks":[{"type":"questions|mock|hazard|highway_code|road_signs|rest","description":"string","topicCategory":"string or omit","count":N_or_omit}],"estimatedMinutes":N}\n\n` +
    `Rules:\n` +
    `- estimatedMinutes per day must not exceed ${dailyMinutes}\n` +
    `- First 60% of days: focus weak topics with question practice tasks\n` +
    `- Include 1 mock test (type "mock") every 7 days at minimum\n` +
    `- Include hazard perception (type "hazard") every 5 days\n` +
    `- Last 3 days: light review only, estimatedMinutes <= ${Math.max(10, Math.floor(dailyMinutes / 2))}\n` +
    `- Day before test and test day: single rest task with a short encouragement message\n` +
    `- Vary task types to keep it engaging — avoid the same task two days in a row\n` +
    `- question count approx 1 per 2 minutes (so ${dailyMinutes} mins ~ ${Math.floor(dailyMinutes / 2)} questions max)`;

  const url = `${getProxyUrl()}/api/explain`;
  console.log('[generateStudyPlan] POST', url);
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system:
        'You are a study plan generator for a UK driving theory test app. ' +
        'Output ONLY a raw valid JSON array — no prose, no markdown fences, no commentary.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    throw new Error(`Plan generation failed (${resp.status})`);
  }

  const data = (await resp.json()) as { content: Array<{ type: string; text: string }> };
  let raw = data.content[0].text.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  const days = JSON.parse(raw) as StudyDay[];

  const plan: StudyPlan = {
    generatedAt: new Date().toISOString(),
    testDate,
    dailyMinutes,
    days,
  };

  await saveStudyPlan(plan);
  return plan;
}

export async function saveStudyPlan(plan: StudyPlan): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

export async function loadStudyPlan(): Promise<StudyPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudyPlan;
  } catch {
    return null;
  }
}

export async function clearStudyPlan(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ─── Algorithmic study plan (offline, no AI) ───────────────────────────────

export type StudyPace = 'relaxed' | 'steady' | 'intensive' | 'final_push';

export type SimpleTask = {
  type: StudyTaskType;
  topic?: string;
  durationMins: number;
};

export type DayPlan = {
  date: string;
  dayName: string;
  task: SimpleTask;
};

export type SimpleStudyPlan = {
  pace: StudyPace;
  daysLeft: number;
  todayTask: SimpleTask;
  weekPlan: DayPlan[];
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getStudyPlan(
  testDate: string,
  weakTopics: string[],
): SimpleStudyPlan {
  const nowDay = new Date();
  nowDay.setHours(0, 0, 0, 0);
  const testDay = new Date(testDate);
  testDay.setHours(0, 0, 0, 0);
  const daysLeft = Math.max(0, Math.round((testDay.getTime() - nowDay.getTime()) / 86400000));

  let pace: StudyPace;
  let durationMins: number;

  if (daysLeft >= 21) {
    pace = 'relaxed';       durationMins = 15;
  } else if (daysLeft >= 14) {
    pace = 'steady';        durationMins = 20;
  } else if (daysLeft >= 7) {
    pace = 'intensive';     durationMins = 30;
  } else {
    pace = 'final_push';    durationMins = 30;
  }

  function taskForOffset(offset: number): SimpleTask {
    const d = daysLeft - offset;
    if (d <= 0) return { type: 'rest', durationMins: 0 };
    if (pace === 'final_push') {
      return { type: offset % 2 === 0 ? 'mock' : 'questions', durationMins };
    }
    if (pace === 'intensive') {
      return {
        type: offset % 3 === 0 ? 'mock' : 'questions',
        topic: offset % 3 !== 0 ? (weakTopics[offset % weakTopics.length] ?? undefined) : undefined,
        durationMins,
      };
    }
    // steady / relaxed
    const pattern = [0, 1, 2, 3, 4, 5, 6].map(i => {
      if (pace === 'steady')  return i < 3 ? 'questions' : i === 3 ? 'mock' : 'rest';
      return i < 2 ? 'questions' : i === 5 ? 'mock' : 'rest'; // relaxed
    });
    const type = (pattern[offset % 7] ?? 'rest') as StudyTaskType;
    return { type, topic: type === 'questions' ? (weakTopics[0] ?? undefined) : undefined, durationMins: type === 'rest' ? 0 : durationMins };
  }

  const todayTask = taskForOffset(0);

  const weekPlan: DayPlan[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(nowDay);
    d.setDate(d.getDate() + i);
    weekPlan.push({
      date: d.toISOString().split('T')[0],
      dayName: DAY_NAMES[d.getDay()],
      task: taskForOffset(i),
    });
  }

  return { pace, daysLeft, todayTask, weekPlan };
}
