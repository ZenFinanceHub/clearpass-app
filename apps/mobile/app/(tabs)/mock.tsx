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
  MockTestResult,
  Question,
  TopicCategory,
  calculateReadiness,
} from '@clearpass/core';
import { allQuestions } from '@clearpass/content';
import {
  createFreshUserProgress,
  loadUserProgress,
  saveUserProgress,
} from '@/src/storage';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_QUESTIONS = 50;
const TIME_LIMIT_SECONDS = 57 * 60; // 3420
const PASS_MARK = 43;
const LABELS = ['A', 'B', 'C', 'D'];

// Human-readable labels for the results topic breakdown.
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

// PLACEHOLDER: only 30 questions exist in the content package right now.
// To fill the 50-question slot we repeat questions; each appears at most twice.
// Remove this padding once a full licensed DVSA bank is loaded.
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'start' | 'test' | 'results';
type ResultData = { correct: number; timeTaken: number; byTopic: ByTopic };

// ─── Main component ───────────────────────────────────────────────────────────

export default function MockScreen() {
  const [phase, setPhase] = useState<Phase>('start');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(TIME_LIMIT_SECONDS);
  const [resultData, setResultData] = useState<ResultData | null>(null);

  // Refs hold values that must be current inside timer/async callbacks.
  const questionsRef = useRef<Question[]>([]);
  const answersRef = useRef<Record<number, number>>({});
  const timeRemainingRef = useRef(TIME_LIMIT_SECONDS);
  const hasSubmittedRef = useRef(false);

  // ── Timer ──────────────────────────────────────────────────────────────────
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

  // Auto-submit when time reaches zero.
  useEffect(() => {
    if (phase === 'test' && timeRemaining === 0) {
      void doSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, phase]);

  // ── Handlers ───────────────────────────────────────────────────────────────

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

    // Build full Record<TopicCategory, number> required by MockTestResult.
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
      passed: correct >= PASS_MARK,
      takenAt: new Date().toISOString(),
      timeTakenSeconds: timeTaken,
      topicBreakdown,
    };

    const existing = await loadUserProgress();
    const progress = existing ?? createFreshUserProgress();
    const updated = {
      ...progress,
      mockTestHistory: [...progress.mockTestHistory, mockResult],
      lastStudied: new Date().toISOString(),
    };
    updated.readinessScore = calculateReadiness(updated).score;
    await saveUserProgress(updated);

    setResultData({ correct, timeTaken, byTopic });
    setPhase('results');
  }

  // ── Phase routing ──────────────────────────────────────────────────────────

  if (phase === 'start') {
    return <StartView onStart={handleStart} />;
  }

  if (phase === 'results' && resultData) {
    return <ResultsView data={resultData} onRetry={() => setPhase('start')} />;
  }

  // ── Test view ──────────────────────────────────────────────────────────────
  const q = questions[currentIndex];
  if (!q) return null;

  const selectedOption = answers[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;
  const isWarning = timeRemaining < 5 * 60;
  const fillPct = ((currentIndex + 1) / questions.length) * 100;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <Text style={[styles.timer, isWarning && styles.timerWarning]}>
          {formatTime(timeRemaining)}
        </Text>
        <Text style={styles.questionCounter}>
          {'Q '}{currentIndex + 1}{' of '}{questions.length}
        </Text>
      </View>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${fillPct}%` as any }]} />
      </View>

      {/* ── Question card ──────────────────────────────────────────────────── */}
      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{q.questionText}</Text>
      </View>

      {/* ── Options ────────────────────────────────────────────────────────── */}
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
                <Text style={styles.badgeText}>{LABELS[idx]}</Text>
              </View>
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Prev / Next ────────────────────────────────────────────────────── */}
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
          {answeredCount} / {questions.length}
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

      {/* ── Navigator grid ─────────────────────────────────────────────────── */}
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

      {/* ── Submit button (visible when all answered) ──────────────────────── */}
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

// ─── Start view ───────────────────────────────────────────────────────────────

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

// ─── Results view ─────────────────────────────────────────────────────────────

function ResultsView({
  data,
  onRetry,
}: {
  data: ResultData;
  onRetry: () => void;
}) {
  const { correct, timeTaken, byTopic } = data;
  const passed = correct >= PASS_MARK;
  const pct = Math.round((correct / TOTAL_QUESTIONS) * 100);

  // Only show topics that actually appeared in this test.
  const topicRows = (Object.entries(byTopic) as [TopicCategory, TopicTally][])
    .filter(([, t]) => t.total > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* ── Pass / Fail banner ─────────────────────────────────────────────── */}
      <View style={[styles.resultBanner, passed ? styles.bannerPass : styles.bannerFail]}>
        <Text style={styles.resultVerdict}>{passed ? 'PASS' : 'FAIL'}</Text>
        <Text style={styles.resultScore}>{correct} / {TOTAL_QUESTIONS}</Text>
        <Text style={styles.resultPct}>{pct}%</Text>
        <Text style={styles.resultMeta}>
          {'Time: '}{formatTime(timeTaken)}{'   Pass mark: '}{PASS_MARK}
        </Text>
      </View>

      {/* ── Topic breakdown ────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Topic Breakdown</Text>
      <View style={styles.topicTable}>
        {topicRows.map(([cat, tally]) => {
          const topicPct = Math.round((tally.correct / tally.total) * 100);
          const isWeak = topicPct < 86;
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
                    isWeak ? styles.topicBarWeak : styles.topicBarStrong,
                  ]}
                />
              </View>
              <Text style={styles.topicScore}>
                {tally.correct}/{tally.total}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── Action buttons ─────────────────────────────────────────────────── */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16, paddingBottom: 48 },

  // ── Start screen ────────────────────────────────────────────────────────────
  screenTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  screenSub: { fontSize: 14, color: '#64748B', marginBottom: 20 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  detailCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: '#012169',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  detailValue: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  detailLabel: { fontSize: 12, color: '#A5B4CC', fontWeight: '500' },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#012169',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#012169', marginBottom: 6 },
  infoText: { fontSize: 14, color: '#334155', lineHeight: 21 },

  // ── Test screen header ───────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timer: { fontSize: 22, fontWeight: '800', color: '#012169', fontVariant: ['tabular-nums'] },
  timerWarning: { color: '#DC2626' },
  questionCounter: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  progressTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: '#012169', borderRadius: 3 },

  // ── Question card ────────────────────────────────────────────────────────────
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  questionText: { fontSize: 17, fontWeight: '600', color: '#0F172A', lineHeight: 26 },

  // ── Options ──────────────────────────────────────────────────────────────────
  optionList: { gap: 8, marginBottom: 14 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 13,
    gap: 12,
  },
  optionSelected: { borderColor: '#012169', backgroundColor: '#EFF6FF' },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeSelected: { backgroundColor: '#012169' },
  badgeText: { fontSize: 13, fontWeight: '800', color: '#475569' },
  optionText: { flex: 1, fontSize: 15, color: '#1E293B', lineHeight: 21 },
  optionTextSelected: { color: '#012169', fontWeight: '600' },

  // ── Prev / Next ───────────────────────────────────────────────────────────────
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  navBtnDisabled: { borderColor: '#F1F5F9', backgroundColor: '#F8FAFC' },
  navBtnText: { fontSize: 14, fontWeight: '700', color: '#012169' },
  navBtnTextDisabled: { color: '#CBD5E1' },
  answeredBadge: { fontSize: 13, fontWeight: '600', color: '#64748B' },

  // ── Grid ─────────────────────────────────────────────────────────────────────
  gridSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  gridCell: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellAnswered: { backgroundColor: '#012169', borderColor: '#012169' },
  gridCellCurrent: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  gridCellText: { fontSize: 10, fontWeight: '700', color: '#64748B' },
  gridCellTextLight: { color: '#FFFFFF' },

  // ── Submit ────────────────────────────────────────────────────────────────────
  submitButton: {
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  startButton: {
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  startButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  outlineButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  outlineButtonText: { color: '#475569', fontSize: 16, fontWeight: '600' },

  // ── Results ───────────────────────────────────────────────────────────────────
  resultBanner: {
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: 'center',
    marginBottom: 24,
  },
  bannerPass: { backgroundColor: '#16A34A' },
  bannerFail: { backgroundColor: '#DC2626' },
  resultVerdict: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: 4 },
  resultScore: { fontSize: 48, fontWeight: '800', color: '#FFFFFF', lineHeight: 56 },
  resultPct: { fontSize: 20, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 6 },
  resultMeta: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  topicTable: { gap: 8, marginBottom: 24 },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topicName: { width: 110, fontSize: 12, fontWeight: '600', color: '#334155' },
  topicBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  topicBarFill: { height: 8, borderRadius: 4 },
  topicBarStrong: { backgroundColor: '#16A34A' },
  topicBarWeak: { backgroundColor: '#F59E0B' },
  topicScore: { width: 32, fontSize: 12, fontWeight: '700', color: '#475569', textAlign: 'right' },
});
