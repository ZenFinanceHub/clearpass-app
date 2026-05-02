import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  Achievement,
  MockTestResult,
  Question,
  TopicCategory,
  XP_REWARDS,
  awardXp,
  calculateReadiness,
  checkAchievements,
} from '@clearpass/core';
import { allQuestions } from '@clearpass/content';
import {
  createFreshUserProgress,
  loadUserProgress,
  saveUserProgress,
} from '@/src/storage';

const TOTAL_QUESTIONS = 50;
const TIME_LIMIT_SECONDS = 57 * 60;
const PASS_MARK = 43;
const LABELS = ['A', 'B', 'C', 'D'];

const TOPIC_LABELS: Record<TopicCategory, string> = {
  [TopicCategory.Alertness]: 'Alertness',
  [TopicCategory.Attitude]: 'Attitude',
  [TopicCategory.SafetyAndYourVehicle]: 'Safety & Vehicle',
  [TopicCategory.SafetyMargins]: 'Safety Margins',
  [TopicCategory.HazardAwareness]: 'Hazard Awareness',
  [TopicCategory.VulnerableRoadUsers]: 'Vulnerable Users',
  [TopicCategory.OtherTypes]: 'Other Vehicles',
  [TopicCategory.VehicleHandling]: 'Vehicle Handling',
  [TopicCategory.MotorwayRules]: 'Motorway Rules',
  [TopicCategory.RulesOfTheRoad]: 'Rules of Road',
  [TopicCategory.RoadAndTrafficSigns]: 'Road Signs',
  [TopicCategory.DocumentsAndRegulations]: 'Documents',
  [TopicCategory.AccidentsAndEmergencies]: 'Accidents',
  [TopicCategory.VehicleLoading]: 'Vehicle Loading',
};

function buildTestQuestions(pool: Question[]): Question[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const result: Question[] = [...shuffled];
  let i = 0;
  while (result.length < TOTAL_QUESTIONS) {
    result.push(shuffled[i % shuffled.length]);
    i++;
  }
  return result.sort(() => Math.random() - 0.5);
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type TopicTally = { correct: number; total: number };
type ByTopic = Partial<Record<TopicCategory, TopicTally>>;

function scoreTest(
  questions: Question[],
  answers: Record<number, number>,
): { correct: number; byTopic: ByTopic } {
  let correct = 0;
  const byTopic: ByTopic = {};
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const cat = q.topicCategory;
    if (!byTopic[cat]) byTopic[cat] = { correct: 0, total: 0 };
    byTopic[cat]!.total += 1;
    if (answers[i] === q.correctIndex) {
      correct += 1;
      byTopic[cat]!.correct += 1;
    }
  }
  return { correct, byTopic };
}

type Phase = 'start' | 'test' | 'results';
type ResultData = {
  correct: number;
  timeTaken: number;
  byTopic: ByTopic;
  xpEarned: number;
  newAchievements: Achievement[];
};

export default function MockScreen() {
  const [phase, setPhase] = useState<Phase>('start');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(TIME_LIMIT_SECONDS);
  const [resultData, setResultData] = useState<ResultData | null>(null);

  const questionsRef = useRef<Question[]>([]);
  const answersRef = useRef<Record<number, number>>({});
  const timeRemainingRef = useRef(TIME_LIMIT_SECONDS);
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    if (phase !== 'test') return;
    const id = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 1;
        timeRemainingRef.current = Math.max(0, next);
        return next <= 0 ? 0 : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'test' && timeRemaining === 0) {
      void doSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, phase]);

  function handleStart() {
    hasSubmittedRef.current = false;
    const qs = buildTestQuestions(allQuestions);
    questionsRef.current = qs;
    answersRef.current = {};
    timeRemainingRef.current = TIME_LIMIT_SECONDS;
    setQuestions(qs);
    setAnswers({});
    setCurrentIndex(0);
    setTimeRemaining(TIME_LIMIT_SECONDS);
    setResultData(null);
    setPhase('test');
  }

  function handleSelect(optionIndex: number) {
    const next = { ...answersRef.current, [currentIndex]: optionIndex };
    answersRef.current = next;
    setAnswers(next);
  }

  function handleNav(idx: number) {
    setCurrentIndex(idx);
  }

  async function doSubmit() {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const qs = questionsRef.current;
    const ans = answersRef.current;
    const timeTaken = TIME_LIMIT_SECONDS - Math.max(0, timeRemainingRef.current);
    const { correct, byTopic } = scoreTest(qs, ans);
    const passed = correct >= PASS_MARK;

    const topicBreakdown = Object.values(TopicCategory).reduce(
      (acc, cat) => {
        const t = byTopic[cat];
        acc[cat] = t && t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
        return acc;
      },
      {} as Record<TopicCategory, number>,
    );

    const mockResult: MockTestResult = {
      id: String(Date.now()),
      score: correct,
      passed,
      takenAt: new Date().toISOString(),
      timeTakenSeconds: timeTaken,
      topicBreakdown,
    };

    const existing = await loadUserProgress();
    let progress = existing ?? createFreshUserProgress();

    progress = {
      ...progress,
      mockTestHistory: [...progress.mockTestHistory, mockResult],
      lastStudied: new Date().toISOString(),
    };
    progress.readinessScore = calculateReadiness(progress).score;

    // Award XP
    let xpEarned = XP_REWARDS.MOCK_COMPLETED;
    if (passed) xpEarned += XP_REWARDS.MOCK_PASSED;
    progress = awardXp(progress, xpEarned);

    // Update daily challenge (mock type)
    const today = new Date().toISOString().split('T')[0];
    const dc = progress.dailyChallenge;
    if (dc && dc.date === today && !dc.completed && dc.challengeType === 'mock') {
      const newCount = dc.targetCount;
      progress = awardXp(progress, XP_REWARDS.DAILY_CHALLENGE);
      xpEarned += XP_REWARDS.DAILY_CHALLENGE;
      progress = {
        ...progress,
        dailyChallenge: { ...dc, currentCount: newCount, completed: true },
      };
    }

    const { newAchievements, updatedProgress } = checkAchievements(progress);
    await saveUserProgress(updatedProgress);

    setResultData({ correct, timeTaken, byTopic, xpEarned, newAchievements });
    setPhase('results');
  }

  if (phase === 'start') {
    return <StartView onStart={handleStart} />;
  }

  if (phase === 'results' && resultData) {
    return (
      <ResultsView
        data={resultData}
        onRetry={() => setPhase('start')}
      />
    );
  }

  const q = questions[currentIndex];
  if (!q) return null;

  const selectedOption = answers[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;
  const isWarning = timeRemaining < 5 * 60;
  const fillPct = ((currentIndex + 1) / questions.length) * 100;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      <View style={styles.headerRow}>
        <Text style={[styles.timer, isWarning && styles.timerWarning]}>
          {formatTime(timeRemaining)}
        </Text>
        <Text style={styles.questionCounter}>
          {'Q '}{currentIndex + 1}{' of '}{questions.length}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${fillPct}%` as any }]} />
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{q.questionText}</Text>
      </View>

      <View style={styles.optionList}>
        {q.options.map((option, idx) => {
          const isSelected = idx === selectedOption;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => handleSelect(idx)}
              activeOpacity={0.75}
            >
              <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                  {LABELS[idx]}
                </Text>
              </View>
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          onPress={() => handleNav(currentIndex - 1)}
          disabled={currentIndex === 0}
          activeOpacity={0.75}
        >
          <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>
            {'< Prev'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.answeredBadge}>
          {answeredCount}{' / '}{questions.length}
        </Text>

        <TouchableOpacity
          style={[
            styles.navBtn,
            currentIndex === questions.length - 1 && styles.navBtnDisabled,
          ]}
          onPress={() => handleNav(currentIndex + 1)}
          disabled={currentIndex === questions.length - 1}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.navBtnText,
              currentIndex === questions.length - 1 && styles.navBtnTextDisabled,
            ]}
          >
            {'Next >'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gridSection}>
        <Text style={styles.gridLabel}>Question Navigator</Text>
        <View style={styles.grid}>
          {questions.map((_, idx) => {
            const isAnswered = answers[idx] !== undefined;
            const isCurrent = idx === currentIndex;
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.gridCell,
                  isAnswered && styles.gridCellAnswered,
                  isCurrent && styles.gridCellCurrent,
                ]}
                onPress={() => handleNav(idx)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.gridCellText,
                    (isAnswered || isCurrent) && styles.gridCellTextLight,
                  ]}
                >
                  {idx + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {allAnswered && (
        <TouchableOpacity
          style={styles.submitButton}
          onPress={() => void doSubmit()}
          activeOpacity={0.85}
        >
          <Text style={styles.submitButtonText}>Submit Test</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const DETAILS = [
  { label: 'Questions', value: '50' },
  { label: 'Time Limit', value: '57 min' },
  { label: 'Pass Mark', value: '43 / 50' },
  { label: 'Format', value: 'Multiple choice' },
];

function StartView({ onStart }: { onStart: () => void }) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Mock Test</Text>
      <Text style={styles.screenSub}>Simulates the real DVSA theory test</Text>

      <View style={styles.illustrationCard}>
        <View style={styles.illustrationRow}>
          <Text style={styles.illustrationEmoji}>{'📝'}</Text>
          <Text style={styles.illustrationEmoji}>{'⏱'}</Text>
          <Text style={styles.illustrationEmoji}>{'🎯'}</Text>
        </View>
        <Text style={styles.illustrationText}>Are you ready for the real thing?</Text>
      </View>

      <View style={styles.detailGrid}>
        {DETAILS.map(({ label, value }) => (
          <View key={label} style={styles.detailCard}>
            <Text style={styles.detailValue}>{value}</Text>
            <Text style={styles.detailLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>What to expect</Text>
        <Text style={styles.infoText}>
          {'50 multiple-choice questions drawn from all DVSA topic areas. ' +
            'The test is timed at 57 minutes. A score of 43 or more is required to pass.'}
        </Text>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={onStart} activeOpacity={0.85}>
        <Text style={styles.startButtonText}>Start Mock Test</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ResultsView({
  data,
  onRetry,
}: {
  data: ResultData;
  onRetry: () => void;
}) {
  const { correct, timeTaken, byTopic, xpEarned, newAchievements } = data;
  const passed = correct >= PASS_MARK;
  const pct = Math.round((correct / TOTAL_QUESTIONS) * 100);

  const topicRows = (Object.entries(byTopic) as [TopicCategory, TopicTally][])
    .filter(([, t]) => t.total > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {newAchievements.length > 0 && (
        <View style={styles.achievementBanner}>
          <Text style={styles.achievementBannerTitle}>ACHIEVEMENT UNLOCKED</Text>
          {newAchievements.map((a) => (
            <Text key={a.id} style={styles.achievementBannerItem}>
              {a.title}{'  +' + a.xpReward + ' XP'}
            </Text>
          ))}
        </View>
      )}

      <View style={[styles.resultBanner, passed ? styles.bannerPass : styles.bannerFail]}>
        <Text style={[styles.resultVerdict, { color: passed ? '#34D399' : '#F87171' }]}>
          {passed ? 'PASS' : 'FAIL'}
        </Text>
        <Text style={styles.resultScore}>{correct}{' / '}{TOTAL_QUESTIONS}</Text>
        <Text style={styles.resultPct}>{pct}{'%'}</Text>
        <Text style={styles.resultMeta}>
          {'Time: '}{formatTime(timeTaken)}{'   Pass mark: '}{PASS_MARK}
        </Text>
        {xpEarned > 0 && (
          <Text style={styles.xpNotif}>{'+'}{xpEarned}{' XP earned!'}</Text>
        )}
      </View>

      <Text style={styles.sectionLabel}>Topic Breakdown</Text>
      <View style={styles.topicTable}>
        {topicRows.map(([cat, tally]) => {
          const topicPct = Math.round((tally.correct / tally.total) * 100);
          const isStrong = topicPct >= 86;
          return (
            <View key={cat} style={styles.topicRow}>
              <Text style={styles.topicName} numberOfLines={1}>
                {TOPIC_LABELS[cat]}
              </Text>
              <View style={styles.topicBarTrack}>
                <View
                  style={[
                    styles.topicBarFill,
                    { width: `${topicPct}%` as any },
                    isStrong ? styles.topicBarStrong : styles.topicBarWeak,
                  ]}
                />
              </View>
              <Text style={styles.topicScore}>
                {tally.correct}{'/'}{tally.total}
              </Text>
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={styles.startButton} onPress={onRetry} activeOpacity={0.85}>
        <Text style={styles.startButtonText}>Try Again</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.outlineButton}
        onPress={() => router.replace('/(tabs)/home')}
        activeOpacity={0.85}
      >
        <Text style={styles.outlineButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 16, paddingBottom: 48 },

  screenTitle: { fontSize: 26, fontWeight: '800', color: '#F1F0FF', marginBottom: 4 },
  screenSub: { fontSize: 14, color: '#6B7280', marginBottom: 20 },

  illustrationCard: {
    backgroundColor: '#13131A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
  },
  illustrationRow: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  illustrationEmoji: { fontSize: 36 },
  illustrationText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#A78BFA',
    textAlign: 'center',
  },

  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  detailCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: '#13131A',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
  },
  detailValue: { fontSize: 22, fontWeight: '800', color: '#F1F0FF', marginBottom: 2 },
  detailLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  infoBox: {
    backgroundColor: '#13131A',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#A78BFA',
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#A78BFA', marginBottom: 6 },
  infoText: { fontSize: 14, color: '#6B7280', lineHeight: 21 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timer: { fontSize: 22, fontWeight: '800', color: '#A78BFA', fontVariant: ['tabular-nums'] },
  timerWarning: { color: '#F87171' },
  questionCounter: { fontSize: 14, fontWeight: '600', color: '#6B7280' },

  progressTrack: {
    height: 6,
    backgroundColor: '#1C1C27',
    borderRadius: 3,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: '#A78BFA', borderRadius: 3 },

  questionCard: {
    backgroundColor: '#13131A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    borderLeftWidth: 3,
    borderLeftColor: '#A78BFA',
  },
  questionText: { fontSize: 17, fontWeight: '600', color: '#F1F0FF', lineHeight: 26 },

  optionList: { gap: 8, marginBottom: 14 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F1F2E',
    backgroundColor: '#13131A',
    padding: 13,
    gap: 12,
  },
  optionSelected: { borderColor: '#A78BFA', backgroundColor: '#1C1C27' },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#1C1C27',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeSelected: { backgroundColor: '#A78BFA' },
  badgeText: { fontSize: 13, fontWeight: '800', color: '#6B7280' },
  badgeTextSelected: { color: '#FFFFFF' },
  optionText: { flex: 1, fontSize: 15, color: '#F1F0FF', lineHeight: 21 },
  optionTextSelected: { color: '#F1F0FF', fontWeight: '600' },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    backgroundColor: '#13131A',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1F1F2E',
  },
  navBtnDisabled: { borderColor: '#1F1F2E', backgroundColor: '#0D0D14' },
  navBtnText: { fontSize: 14, fontWeight: '700', color: '#A78BFA' },
  navBtnTextDisabled: { color: '#374151' },
  answeredBadge: { fontSize: 13, fontWeight: '600', color: '#6B7280' },

  gridSection: {
    backgroundColor: '#13131A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  gridCell: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F1F2E',
    backgroundColor: '#13131A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellAnswered: { backgroundColor: '#7B5EA7', borderColor: '#7B5EA7' },
  gridCellCurrent: { backgroundColor: '#A78BFA', borderColor: '#A78BFA' },
  gridCellText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  gridCellTextLight: { color: '#FFFFFF' },

  submitButton: {
    backgroundColor: '#34D399',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButtonText: { color: '#0A0A0F', fontSize: 17, fontWeight: '700' },

  startButton: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  startButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  outlineButton: {
    backgroundColor: '#13131A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F1F2E',
  },
  outlineButtonText: { color: '#6B7280', fontSize: 16, fontWeight: '600' },

  achievementBanner: {
    backgroundColor: '#1C1C27',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#A78BFA',
    borderLeftWidth: 4,
    borderLeftColor: '#A78BFA',
  },
  achievementBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 1,
    marginBottom: 6,
  },
  achievementBannerItem: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F0FF',
    marginBottom: 2,
  },

  resultBanner: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 28,
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#13131A',
  },
  bannerPass: { borderColor: '#34D399' },
  bannerFail: { borderColor: '#F87171' },
  resultVerdict: { fontSize: 36, fontWeight: '900', letterSpacing: 4 },
  resultScore: { fontSize: 48, fontWeight: '800', color: '#F1F0FF', lineHeight: 56 },
  resultPct: { fontSize: 20, color: '#6B7280', fontWeight: '600', marginBottom: 6 },
  resultMeta: { fontSize: 13, color: '#6B7280' },
  xpNotif: { fontSize: 16, fontWeight: '700', color: '#A78BFA', marginTop: 10 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  topicTable: { gap: 8, marginBottom: 24 },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13131A',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
  },
  topicName: { width: 110, fontSize: 12, fontWeight: '600', color: '#F1F0FF' },
  topicBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#1C1C27',
    borderRadius: 4,
    overflow: 'hidden',
  },
  topicBarFill: { height: 8, borderRadius: 4 },
  topicBarStrong: { backgroundColor: '#34D399' },
  topicBarWeak: { backgroundColor: '#FBBF24' },
  topicScore: {
    width: 32,
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'right',
  },
});
