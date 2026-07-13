import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { allQuestions, questionsByTopic } from '@clearpass/content';
import {
  createFreshUserProgress,
  loadUserProgress,
  recordWeakSpotResult,
  saveUserProgress,
} from '@/src/storage';
import { isPremium } from '@/src/subscription';
import { useTheme } from '@/src/theme';
import { checkAndTriggerCelebrations, CelebrationEvent } from '@/src/celebrations';
import * as Haptics from 'expo-haptics';
import { CelebrationModal } from '@/src/components/CelebrationModal';
import { ShareCardModal } from '@/src/components/ShareableCard';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { Pip } from '@/src/components/Pip';
import { Colors } from '@/src/constants/theme';

const TOTAL_QUESTIONS = 50;
const TIME_LIMIT_SECONDS = 57 * 60;
const PASS_MARK = 43;
const QUICK_QUESTIONS = 25;
const QUICK_TIME_SECONDS = 28 * 60;
const QUICK_PASS_MARK = 22;
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

function buildTestQuestions(count: number = TOTAL_QUESTIONS): Question[] {
  const selected: Question[] = [];
  const usedIds = new Set<string>();

  for (const cat of Object.values(TopicCategory)) {
    const pool = questionsByTopic[cat];
    if (!pool || pool.length === 0) continue;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    selected.push(pick);
    usedIds.add(pick.id);
  }

  const remaining = allQuestions.filter((q) => !usedIds.has(q.id));
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  selected.push(...remaining.slice(0, count - selected.length));

  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }

  return selected;
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

type TopicTally = { correct: number; total: number };
type ByTopic = Partial<Record<TopicCategory, TopicTally>>;

function scoreTest(questions: Question[], answers: (number | null)[]): { correct: number; byTopic: ByTopic } {
  let correct = 0;
  const byTopic: ByTopic = {};
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!byTopic[q.topicCategory]) byTopic[q.topicCategory] = { correct: 0, total: 0 };
    byTopic[q.topicCategory]!.total += 1;
    if (answers[i] === q.correctIndex) { correct += 1; byTopic[q.topicCategory]!.correct += 1; }
  }
  return { correct, byTopic };
}

type Phase = 'start' | 'test' | 'review' | 'results';
type ReviewFilter = 'all' | 'wrong' | 'flagged';
type ResultData = { correct: number; timeTaken: number; byTopic: ByTopic; xpEarned: number; newAchievements: Achievement[]; passed: boolean; streakDays: number; total: number; passMark: number };

export default function MockScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('start');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(TIME_LIMIT_SECONDS);
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [celebQueue, setCelebQueue] = useState<CelebrationEvent[]>([]);
  const [activeCelebration, setActiveCelebration] = useState<CelebrationEvent | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [mockMode, setMockMode] = useState<'standard' | 'quick'>('standard');

  const questionsRef = useRef<Question[]>([]);
  const answersRef = useRef<(number | null)[]>([]);
  const timeRemainingRef = useRef(TIME_LIMIT_SECONDS);
  const hasSubmittedRef = useRef(false);
  const activeLimitRef = useRef(TIME_LIMIT_SECONDS);
  const activePassMarkRef = useRef(PASS_MARK);
  const activeTotalRef = useRef(TOTAL_QUESTIONS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const premium = await isPremium();
        if (!premium) router.replace('/paywall');
      })();
    }, []),
  );

  useEffect(() => {
    if (phase !== 'test' || isPaused) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 1;
        timeRemainingRef.current = next;
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [phase, isPaused]);

  useEffect(() => {
    if (phase === 'test' && timeRemaining <= 0) void doSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, phase]);

  function handleStart(mode: 'standard' | 'quick') {
    const activeTotal = mode === 'quick' ? QUICK_QUESTIONS : TOTAL_QUESTIONS;
    const activeTime = mode === 'quick' ? QUICK_TIME_SECONDS : TIME_LIMIT_SECONDS;
    const activeMark = mode === 'quick' ? QUICK_PASS_MARK : PASS_MARK;
    setMockMode(mode);
    activeLimitRef.current = activeTime;
    activePassMarkRef.current = activeMark;
    activeTotalRef.current = activeTotal;
    hasSubmittedRef.current = false;
    setIsPaused(false);
    const qs = buildTestQuestions(activeTotal);
    const initialAnswers: (number | null)[] = Array(qs.length).fill(null);
    questionsRef.current = qs;
    answersRef.current = initialAnswers;
    timeRemainingRef.current = activeTime;
    setQuestions(qs);
    setUserAnswers(initialAnswers);
    setFlagged(new Set());
    setCurrentIndex(0);
    setTimeRemaining(activeTime);
    setResultData(null);
    setExpandedRows(new Set());
    setShowGrid(false);
    setPhase('test');
  }

  function handleSelect(optionIndex: number) {
    const next = [...answersRef.current];
    next[currentIndex] = optionIndex;
    answersRef.current = next;
    setUserAnswers([...next]);
    void Haptics.selectionAsync();
  }

  function toggleFlag(idx: number) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function toggleExpand(idx: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  async function doSubmit() {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const qs = questionsRef.current;
    const ans = answersRef.current;
    const timeTaken = activeLimitRef.current - Math.max(0, timeRemainingRef.current);
    const { correct, byTopic } = scoreTest(qs, ans);
    for (let i = 0; i < qs.length; i++) {
      void recordWeakSpotResult(qs[i].id, ans[i] === qs[i].correctIndex);
    }
    const passed = correct >= activePassMarkRef.current;

    const topicBreakdown = Object.values(TopicCategory).reduce((acc, cat) => {
      const t = byTopic[cat];
      acc[cat] = t && t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
      return acc;
    }, {} as Record<TopicCategory, number>);

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
    progress = { ...progress, mockTestHistory: [...progress.mockTestHistory, mockResult], lastStudied: new Date().toISOString() };
    progress.readinessScore = calculateReadiness(progress).score;

    let xpEarned = XP_REWARDS.MOCK_COMPLETED;
    if (passed) xpEarned += XP_REWARDS.MOCK_PASSED;
    progress = awardXp(progress, xpEarned);

    const today = new Date().toISOString().split('T')[0];
    const dc = progress.dailyChallenge;
    if (dc && dc.date === today && !dc.completed && dc.challengeType === 'mock') {
      progress = awardXp(progress, XP_REWARDS.DAILY_CHALLENGE);
      xpEarned += XP_REWARDS.DAILY_CHALLENGE;
      progress = { ...progress, dailyChallenge: { ...dc, currentCount: dc.targetCount, completed: true } };
    }

    const { newAchievements, updatedProgress } = checkAchievements(progress);
    await saveUserProgress(updatedProgress);

    try {
      const celebEvents = await checkAndTriggerCelebrations(updatedProgress);
      if (celebEvents.length > 0) {
        setActiveCelebration(celebEvents[0]);
        setCelebQueue(celebEvents.slice(1));
      }
    } catch {}

    setResultData({ correct, timeTaken, byTopic, xpEarned, newAchievements, passed, streakDays: updatedProgress.studyStreakDays ?? 0, total: activeTotalRef.current, passMark: activePassMarkRef.current });
    void (passed
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
    setPhase('results');
  }

  function handleCelebDismiss() {
    const [next, ...rest] = celebQueue;
    if (next) {
      setActiveCelebration(next);
      setCelebQueue(rest);
    } else {
      setActiveCelebration(null);
    }
  }

  if (phase === 'start') return (
    <>
      <OfflineBanner />
      <StartView
        onStart={handleStart}
      />
    </>
  );

  if (phase === 'results' && resultData) {
    return (
      <>
        <OfflineBanner />
        <ResultsView
          data={resultData}
          onReview={() => { setExpandedRows(new Set()); setPhase('review'); }}
          onDone={() => router.replace('/(tabs)/home')}
        />
        {activeCelebration && (
          <CelebrationModal event={activeCelebration} onDismiss={handleCelebDismiss} />
        )}
      </>
    );
  }

  if (phase === 'review') {
    return (
      <ReviewView
        questions={questions}
        userAnswers={userAnswers}
        flagged={flagged}
        expandedRows={expandedRows}
        onToggleExpand={toggleExpand}
        onBack={() => setPhase('results')}
      />
    );
  }

  // ── TEST PHASE ──
  const q = questions[currentIndex];
  if (!q) return null;

  const selectedOption = userAnswers[currentIndex];
  const answeredCount = userAnswers.filter((a) => a !== null).length;
  const isOnLast = currentIndex === questions.length - 1;
  const showSubmit = isOnLast || answeredCount === questions.length;
  const isWarning = timeRemaining < 5 * 60;
  const isFlagged = flagged.has(currentIndex);

  return (
    <View style={[styles.flex, { backgroundColor: theme.backgroundColor }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={[styles.qCounter, { fontFamily: theme.fontFamily, color: theme.subTextColor }]}>
          {'Q '}{currentIndex + 1}{' / '}{questions.length}
        </Text>
        <TouchableOpacity style={styles.timerGroup} onPress={() => setIsPaused(true)} activeOpacity={0.8}>
          <Text style={[styles.timerText, isWarning && styles.timerWarn]}>
            {formatTime(timeRemaining)}
          </Text>
          <Text style={styles.pauseHint}>{'tap to pause'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.flagTouchable} onPress={() => toggleFlag(currentIndex)} activeOpacity={0.7}>
          <Text style={[styles.flagIcon, isFlagged && styles.flagIconActive]}>{'[!]'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Question */}
        <View style={styles.questionCard}>
          {isFlagged && (
            <View style={styles.flaggedPill}>
              <Text style={styles.flaggedPillText}>{'FLAGGED'}</Text>
            </View>
          )}
          {q.imageUrl && (
            <Image source={{ uri: q.imageUrl }} style={styles.questionImage} resizeMode="contain" />
          )}
          <Text style={[styles.questionText, { fontSize: theme.fontSize(17), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(26), color: theme.textColor }]}>
            {q.questionText}
          </Text>
        </View>

        {/* Options */}
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
                  <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>{LABELS[idx]}</Text>
                </View>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing }]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Navigation */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
            onPress={() => setCurrentIndex((i) => i - 1)}
            disabled={currentIndex === 0}
            activeOpacity={0.75}
          >
            <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>{'< Prev'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.overviewBtn} onPress={() => setShowGrid(true)} activeOpacity={0.8}>
            <Text style={styles.overviewCount}>{answeredCount}{' / '}{questions.length}</Text>
            <Text style={styles.overviewHint}>{'tap for overview'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, isOnLast && styles.navBtnDisabled]}
            onPress={() => setCurrentIndex((i) => i + 1)}
            disabled={isOnLast}
            activeOpacity={0.75}
          >
            <Text style={[styles.navBtnText, isOnLast && styles.navBtnTextDisabled]}>{'Next >'}</Text>
          </TouchableOpacity>
        </View>

        {showSubmit && (
          <TouchableOpacity style={styles.submitBtn} onPress={() => void doSubmit()} activeOpacity={0.85}>
            <Text style={styles.submitBtnText}>{'Submit Test'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Pause overlay */}
      {isPaused && (
        <View style={styles.pauseOverlay}>
          <View style={styles.pauseCard}>
            <Text style={styles.pauseTitle}>{'Test Paused'}</Text>
            <Text style={[styles.timerText, isWarning && styles.timerWarn, { marginVertical: 8 }]}>
              {formatTime(timeRemaining)}
            </Text>
            <Text style={styles.pauseNote}>
              {'Real DVSA tests cannot be paused — this is for practice only'}
            </Text>
            <TouchableOpacity style={styles.resumeBtn} onPress={() => setIsPaused(false)} activeOpacity={0.85}>
              <Text style={styles.resumeBtnText}>{'Resume Test'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.abandonBtn} onPress={() => { setIsPaused(false); void doSubmit(); }} activeOpacity={0.85}>
              <Text style={styles.abandonBtnText}>{'Submit & End Test'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Grid overview modal */}
      <Modal visible={showGrid} transparent animationType="slide" onRequestClose={() => setShowGrid(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{'Question Overview'}</Text>
              <TouchableOpacity onPress={() => setShowGrid(false)} activeOpacity={0.7}>
                <Text style={styles.modalClose}>{'Close'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#D1D5DB' }]} /><Text style={styles.legendLabel}>{'answered'}</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} /><Text style={styles.legendLabel}>{'flagged'}</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.indigo }]} /><Text style={styles.legendLabel}>{'current'}</Text></View>
            </View>
            <ScrollView>
              <View style={styles.grid}>
                {questions.map((_, idx) => {
                  const answered = userAnswers[idx] !== null;
                  const isFlg = flagged.has(idx);
                  const isCur = idx === currentIndex;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.gridCell,
                        answered && styles.gridCellAnswered,
                        isFlg && styles.gridCellFlagged,
                        isCur && styles.gridCellCurrent,
                      ]}
                      onPress={() => { setCurrentIndex(idx); setShowGrid(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.gridCellText, (answered || isFlg || isCur) && styles.gridCellTextBright]}>
                        {idx + 1}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── START VIEW ──
function StartView({ onStart }: { onStart: (mode: 'standard' | 'quick') => void }) {
  const theme = useTheme();
  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <Text style={[styles.screenTitle, { fontSize: theme.fontSize(28), fontFamily: theme.fontFamily, color: theme.textColor }]}>
        {'Mock Theory Test'}
      </Text>
      <Text style={[styles.screenSub, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>
        {'Choose your session length'}
      </Text>

      <TouchableOpacity style={[styles.modeCard, { backgroundColor: theme.cardColor, borderColor: Colors.indigo }]} onPress={() => onStart('standard')} activeOpacity={0.85}>
        <View style={styles.modeCardHeader}>
          <Text style={styles.modeCardTitle}>{'Standard Mock'}</Text>
          <View style={styles.modeCardBadge}><Text style={styles.modeCardBadgeText}>{'DVSA Format'}</Text></View>
        </View>
        <View style={styles.modeCardStats}>
          <View style={styles.modeStat}><Text style={styles.modeStatEmoji}>{'📝'}</Text><Text style={[styles.modeStatText, { color: theme.textColor }]}>{'50 questions'}</Text></View>
          <View style={styles.modeStat}><Text style={styles.modeStatEmoji}>{'⏱'}</Text><Text style={[styles.modeStatText, { color: theme.textColor }]}>{'57 minutes'}</Text></View>
          <View style={styles.modeStat}><Text style={styles.modeStatEmoji}>{'✅'}</Text><Text style={[styles.modeStatText, { color: theme.textColor }]}>{'Pass: 43/50'}</Text></View>
        </View>
        <View style={styles.modeCardBtn}>
          <Text style={styles.modeCardBtnText}>{'Start Standard Test'}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.modeCard, styles.modeCardQuick, { backgroundColor: theme.cardColor }]} onPress={() => onStart('quick')} activeOpacity={0.85}>
        <View style={styles.modeCardHeader}>
          <Text style={styles.modeCardTitle}>{'Quick Mock'}</Text>
          <View style={[styles.modeCardBadge, styles.modeCardBadgeQuick]}><Text style={styles.modeCardBadgeText}>{'~28 min'}</Text></View>
        </View>
        <View style={styles.modeCardStats}>
          <View style={styles.modeStat}><Text style={styles.modeStatEmoji}>{'📝'}</Text><Text style={[styles.modeStatText, { color: theme.textColor }]}>{'25 questions'}</Text></View>
          <View style={styles.modeStat}><Text style={styles.modeStatEmoji}>{'⏱'}</Text><Text style={[styles.modeStatText, { color: theme.textColor }]}>{'28 minutes'}</Text></View>
          <View style={styles.modeStat}><Text style={styles.modeStatEmoji}>{'✅'}</Text><Text style={[styles.modeStatText, { color: theme.textColor }]}>{'Pass: 22/25'}</Text></View>
        </View>
        <View style={[styles.modeCardBtn, styles.modeCardBtnQuick]}>
          <Text style={styles.modeCardBtnText}>{'Start Quick Mock'}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>{'Tap the timer during the test to pause — real DVSA tests cannot be paused'}</Text>
      </View>
    </ScrollView>
  );
}

// ── RESULTS VIEW ──
function ResultsView({
  data,
  onReview,
  onDone,
}: {
  data: ResultData;
  onReview: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const [showShareCard, setShowShareCard] = useState(false);
  const { correct, timeTaken, byTopic, xpEarned, newAchievements, passed, streakDays, total, passMark } = data;

  const topicRows = (Object.entries(byTopic) as [TopicCategory, TopicTally][])
    .filter(([, t]) => t.total > 0)
    .sort(([a], [b]) => TOPIC_LABELS[a].localeCompare(TOPIC_LABELS[b]));

  return (
  <>
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      {newAchievements.length > 0 && (
        <View style={styles.achievementBanner}>
          <Text style={styles.achievementTitle}>{'ACHIEVEMENT UNLOCKED'}</Text>
          {newAchievements.map((a) => (
            <Text key={a.id} style={styles.achievementItem}>{a.title}{'  +'}{a.xpReward}{' XP'}</Text>
          ))}
        </View>
      )}

      <View style={[styles.resultBadge, passed ? styles.resultBadgePass : styles.resultBadgeFail]}>
        <Pip size={80} mood={passed ? 'celebrate' : 'sympathetic'} />
        <Text style={[styles.verdictText, { color: passed ? Colors.indigo : '#EF4444' }]}>
          {passed ? 'PASS' : 'FAIL'}
        </Text>
        <Text style={styles.scoreText}>{correct}{' / '}{total}</Text>
        <Text style={styles.passMarkText}>{'Pass mark: '}{passMark}{'/'}{total}</Text>
        <Text style={styles.timeTakenText}>{'Completed in '}{formatTime(timeTaken)}</Text>
        {xpEarned > 0 && (
          <View style={styles.xpBadge}>
            <Text style={styles.xpBadgeText}>{'+'}{xpEarned}{' XP earned'}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionLabel}>{'TOPIC BREAKDOWN'}</Text>
      <View style={styles.topicTable}>
        {topicRows.map(([cat, tally]) => {
          const pct = Math.round((tally.correct / tally.total) * 100);
          return (
            <View key={cat} style={styles.topicRow}>
              <Text style={[styles.topicName, { fontSize: theme.fontSize(12), fontFamily: theme.fontFamily, color: theme.textColor }]} numberOfLines={1}>
                {TOPIC_LABELS[cat]}
              </Text>
              <View style={styles.topicBarTrack}>
                <View style={[styles.topicBarFill, { width: `${pct}%` as `${number}%` }, pct >= 80 ? styles.barStrong : styles.barWeak]} />
              </View>
              <Text style={styles.topicScore}>{tally.correct}{'/'}{tally.total}</Text>
            </View>
          );
        })}
      </View>

      <TouchableOpacity style={styles.secondaryBtn} onPress={onReview} activeOpacity={0.85}>
        <Text style={styles.secondaryBtnText}>{'Review Answers'}</Text>
      </TouchableOpacity>

      {passed && (
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowShareCard(true)} activeOpacity={0.85}>
          <Text style={styles.secondaryBtnText}>{'Share Result'}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.primaryBtn} onPress={onDone} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>{'Done'}</Text>
      </TouchableOpacity>
    </ScrollView>

    {showShareCard && (
      <ShareCardModal
        visible={showShareCard}
        onClose={() => setShowShareCard(false)}
        data={{ type: 'mock', score: correct, total, passed, timeTakenSeconds: timeTaken, streakDays }}
      />
    )}
  </>
  );
}

// ── REVIEW VIEW ──
function ReviewView({
  questions,
  userAnswers,
  flagged,
  expandedRows,
  onToggleExpand,
  onBack,
}: {
  questions: Question[];
  userAnswers: (number | null)[];
  flagged: Set<number>;
  expandedRows: Set<number>;
  onToggleExpand: (idx: number) => void;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [filter, setFilter] = useState<ReviewFilter>('all');

  const filteredIndices = questions.map((_, idx) => idx).filter((idx) => {
    if (filter === 'wrong') return userAnswers[idx] !== questions[idx].correctIndex;
    if (filter === 'flagged') return flagged.has(idx);
    return true;
  });

  return (
    <View style={[styles.flex, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.reviewHeader}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.reviewBackBtn}>{'< Back to Results'}</Text>
        </TouchableOpacity>
        <Text style={[styles.reviewHeaderTitle, { fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Review Answers'}</Text>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'wrong', 'flagged'] as ReviewFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'All' : f === 'wrong' ? 'Wrong' : 'Flagged'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.reviewContent}>
        {filteredIndices.length === 0 && (
          <Text style={[styles.emptyText, { color: theme.subTextColor, fontFamily: theme.fontFamily }]}>
            {'Nothing to show here'}
          </Text>
        )}
        {filteredIndices.map((idx) => {
          const q = questions[idx];
          const userAnswer = userAnswers[idx];
          const isCorrect = userAnswer === q.correctIndex;
          const isFlg = flagged.has(idx);
          const isExpanded = expandedRows.has(idx);

          return (
            <View key={idx} style={styles.reviewRow}>
              <TouchableOpacity style={styles.reviewRowHeader} onPress={() => onToggleExpand(idx)} activeOpacity={0.75}>
                <Text style={styles.reviewQNum}>{'Q'}{idx + 1}</Text>
                <Text
                  style={[styles.reviewPreview, { fontSize: theme.fontSize(13), fontFamily: theme.fontFamily, color: theme.textColor }]}
                  numberOfLines={1}
                >
                  {q.questionText.length > 40 ? q.questionText.slice(0, 40) + '...' : q.questionText}
                </Text>
                <View style={styles.reviewIcons}>
                  {isFlg && <Text style={styles.reviewFlagIcon}>{'[!]'}</Text>}
                  <Text style={isCorrect ? styles.correctIcon : styles.wrongIcon}>
                    {isCorrect ? '[V]' : '[X]'}
                  </Text>
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.reviewExpanded}>
                  <Text style={[styles.reviewFullQ, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(21), color: theme.textColor }]}>
                    {q.questionText}
                  </Text>
                  <View style={styles.reviewOptions}>
                    {q.options.map((opt, optIdx) => {
                      const isUserPick = optIdx === userAnswer;
                      const isCorrectOpt = optIdx === q.correctIndex;
                      return (
                        <View
                          key={optIdx}
                          style={[
                            styles.reviewOpt,
                            isCorrectOpt && styles.reviewOptCorrect,
                            isUserPick && !isCorrect && styles.reviewOptWrong,
                          ]}
                        >
                          <Text style={styles.reviewOptLabel}>{LABELS[optIdx]}</Text>
                          <Text style={[
                            styles.reviewOptText,
                            isCorrectOpt && styles.reviewOptTextCorrect,
                            isUserPick && !isCorrect && styles.reviewOptTextWrong,
                            { fontSize: theme.fontSize(13), fontFamily: theme.fontFamily },
                          ]}>
                            {opt}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.explanationBox}>
                    <Text style={[styles.explanationText, { fontSize: theme.fontSize(13), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(19) }]}>
                      {q.explanation}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.tutorBtn}
                    onPress={() => router.push({
                      pathname: '/(tabs)/tutor',
                      params: {
                        questionText: q.questionText,
                        userAnswerText: userAnswer !== null ? q.options[userAnswer] : 'No answer selected',
                        correctAnswerText: q.options[q.correctIndex],
                        explanation: q.explanation,
                      },
                    })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.tutorBtnText}>{'Ask Pip 🦔'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── STYLES ──
const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 12 },

  // Test top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  qCounter: { fontSize: 14, fontWeight: '600', width: 80 },
  timerGroup: { alignItems: 'center' },
  timerText: { fontSize: 22, fontWeight: '800', color: '#111827', fontVariant: ['tabular-nums'], textAlign: 'center' },
  pauseHint: { fontSize: 9, color: '#9CA3AF', marginTop: 1, textAlign: 'center' },
  timerWarn: { color: '#EF4444' },
  flagTouchable: { width: 80, alignItems: 'flex-end' },
  flagIcon: { fontSize: 18, fontWeight: '800', color: '#9CA3AF' },
  flagIconActive: { color: '#B45309' },

  // Pause overlay
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  pauseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '82%',
    alignItems: 'center',
    gap: 12,
  },
  pauseTitle: { fontSize: 22, fontWeight: '900', color: '#111827' },
  pauseNote: { fontSize: 12, color: '#6B7280', textAlign: 'center', lineHeight: 18 },
  resumeBtn: { backgroundColor: Colors.indigo, borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center', marginTop: 4 },
  resumeBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  abandonBtn: { borderRadius: 14, paddingVertical: 12, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  abandonBtnText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },

  // Question card
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderLeftWidth: 3,
    borderLeftColor: Colors.indigo,
    gap: 10,
  },
  flaggedPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  flaggedPillText: { fontSize: 10, fontWeight: '800', color: '#B45309', letterSpacing: 1 },
  questionImage: { width: '100%', height: 160, borderRadius: 8, marginBottom: 12 },
  questionText: { fontSize: 17, fontWeight: '600', lineHeight: 26 },

  // Options
  optionList: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 13,
    gap: 12,
  },
  optionSelected: { borderColor: Colors.indigo, borderWidth: 2, backgroundColor: Colors.indigoBg },
  badge: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badgeSelected: { backgroundColor: Colors.indigo },
  badgeText: { fontSize: 13, fontWeight: '800', color: '#6B7280' },
  badgeTextSelected: { color: '#FFFFFF' },
  optionText: { flex: 1, fontSize: 15, color: '#374151', lineHeight: 21 },
  optionTextSelected: { color: '#111827', fontWeight: '600' },

  // Nav row
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  navBtnDisabled: { borderColor: '#F3F4F6', backgroundColor: '#F3F4F6' },
  navBtnText: { fontSize: 14, fontWeight: '700', color: Colors.indigo },
  navBtnTextDisabled: { color: '#9CA3AF' },
  overviewBtn: { alignItems: 'center', paddingVertical: 4 },
  overviewCount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  overviewHint: { fontSize: 10, color: '#6B7280', marginTop: 1 },

  // Submit
  submitBtn: { backgroundColor: Colors.indigo, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  // Grid modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  modalClose: { fontSize: 15, fontWeight: '600', color: Colors.indigo },
  legendRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendLabel: { fontSize: 11, color: '#6B7280' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gridCell: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  gridCellAnswered: { backgroundColor: '#D1D5DB', borderColor: '#D1D5DB' },
  gridCellFlagged: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  gridCellCurrent: { backgroundColor: Colors.indigo, borderColor: Colors.indigo },
  gridCellText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  gridCellTextBright: { color: '#FFFFFF' },

  // Start view
  screenTitle: { fontSize: 28, fontWeight: '900' },
  screenSub: { fontSize: 14, marginTop: -4 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoCard: { flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, alignItems: 'center', gap: 8, borderWidth: 0.5, borderColor: '#E5E7EB' },
  infoEmoji: { fontSize: 28 },
  infoCardText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  // Mode selection cards
  modeCard: { borderRadius: 16, padding: 20, borderWidth: 2, borderColor: Colors.indigo, gap: 14 },
  modeCardQuick: { borderColor: Colors.orange },
  modeCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeCardTitle: { fontSize: 19, fontWeight: '700', color: Colors.textPrimary },
  modeCardBadge: { backgroundColor: Colors.indigoBg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  modeCardBadgeQuick: { backgroundColor: Colors.orangeBg },
  modeCardBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.indigo },
  modeCardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  modeStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modeStatEmoji: { fontSize: 16 },
  modeStatText: { fontSize: 13, fontWeight: '500' },
  modeCardBtn: { backgroundColor: Colors.indigo, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  modeCardBtnQuick: { backgroundColor: Colors.orange },
  modeCardBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  primaryBtn: { backgroundColor: Colors.indigo, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  warningBox: { backgroundColor: '#FFFBEB', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#F59E0B' },
  warningText: { fontSize: 13, color: '#D97706', textAlign: 'center', fontWeight: '500' },

  // Results view
  achievementBanner: { backgroundColor: Colors.indigoBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.indigo, borderLeftWidth: 4, borderLeftColor: Colors.indigo },
  achievementTitle: { fontSize: 11, fontWeight: '800', color: Colors.indigo, letterSpacing: 1, marginBottom: 6 },
  achievementItem: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  resultBadge: { borderRadius: 20, borderWidth: 1.5, paddingVertical: 32, alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF' },
  resultBadgePass: { borderColor: Colors.emerald },
  resultBadgeFail: { borderColor: '#EF4444' },
  verdictText: { fontSize: 40, fontWeight: '900', letterSpacing: 6 },
  scoreText: { fontSize: 52, fontWeight: '800', color: '#111827', lineHeight: 60 },
  passMarkText: { fontSize: 13, color: '#6B7280' },
  timeTakenText: { fontSize: 13, color: '#6B7280' },
  xpBadge: { backgroundColor: Colors.indigoBg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: Colors.indigo, marginTop: 4 },
  xpBadgeText: { fontSize: 15, fontWeight: '700', color: Colors.indigo },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase' },
  topicTable: { gap: 6 },
  topicRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, gap: 8, borderWidth: 0.5, borderColor: '#E5E7EB' },
  topicName: { width: 110, fontSize: 12, fontWeight: '600' },
  topicBarTrack: { flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  topicBarFill: { height: 8, borderRadius: 4 },
  barStrong: { backgroundColor: Colors.emerald },
  barWeak: { backgroundColor: '#F59E0B' },
  topicScore: { width: 32, fontSize: 12, fontWeight: '700', color: '#6B7280', textAlign: 'right' },
  secondaryBtn: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.indigo },
  secondaryBtnText: { color: Colors.indigo, fontSize: 16, fontWeight: '700' },

  // Review view
  reviewHeader: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', gap: 4 },
  reviewBackBtn: { fontSize: 14, fontWeight: '600', color: Colors.indigo },
  reviewHeaderTitle: { fontSize: 20, fontWeight: '800' },
  filterRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#F7F8FA', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  filterTab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  filterTabActive: { backgroundColor: Colors.indigo, borderColor: Colors.indigo },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTabTextActive: { color: '#FFFFFF' },
  reviewContent: { padding: 12, paddingBottom: 48, gap: 8 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15 },
  reviewRow: { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', borderWidth: 0.5, borderColor: '#E5E7EB' },
  reviewRowHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  reviewQNum: { fontSize: 12, fontWeight: '800', color: Colors.indigo, width: 32 },
  reviewPreview: { flex: 1, fontSize: 13 },
  reviewIcons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewFlagIcon: { fontSize: 14, fontWeight: '700', color: '#B45309' },
  correctIcon: { fontSize: 14, fontWeight: '900', color: Colors.emerald },
  wrongIcon: { fontSize: 14, fontWeight: '900', color: '#EF4444' },
  reviewExpanded: { paddingHorizontal: 14, paddingBottom: 14, gap: 12, borderTopWidth: 0.5, borderTopColor: '#E5E7EB' },
  reviewFullQ: { fontSize: 14, lineHeight: 21, paddingTop: 12 },
  reviewOptions: { gap: 6 },
  reviewOpt: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 10, padding: 10, gap: 10, backgroundColor: '#F7F8FA', borderWidth: 1, borderColor: '#E5E7EB' },
  reviewOptCorrect: { backgroundColor: '#F0FDFA', borderColor: Colors.emerald },
  reviewOptWrong:   { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
  reviewOptLabel: { fontSize: 12, fontWeight: '800', color: '#6B7280', width: 18 },
  reviewOptText: { flex: 1, fontSize: 13, color: '#374151' },
  reviewOptTextCorrect: { color: Colors.emerald, fontWeight: '600' },
  reviewOptTextWrong:   { color: '#EF4444', fontWeight: '600' },
  explanationBox: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: Colors.indigo },
  explanationText: { fontSize: 13, color: '#374151', lineHeight: 19 },

  tutorBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.indigo,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    alignItems: 'center',
  },
  tutorBtnText: { color: Colors.indigo, fontSize: 14, fontWeight: '700' },

});
