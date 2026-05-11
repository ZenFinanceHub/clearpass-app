import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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
  saveUserProgress,
} from '@/src/storage';
import { isPremium } from '@/src/subscription';
import { useTheme } from '@/src/theme';

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

function buildTestQuestions(): Question[] {
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
  selected.push(...remaining.slice(0, TOTAL_QUESTIONS - selected.length));

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
type ResultData = { correct: number; timeTaken: number; byTopic: ByTopic; xpEarned: number; newAchievements: Achievement[]; passed: boolean };

export default function MockScreen() {
  const theme = useTheme();
  const [phase, setPhase] = useState<Phase>('start');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(TIME_LIMIT_SECONDS);
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const questionsRef = useRef<Question[]>([]);
  const answersRef = useRef<(number | null)[]>([]);
  const timeRemainingRef = useRef(TIME_LIMIT_SECONDS);
  const hasSubmittedRef = useRef(false);
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
    if (phase !== 'test') {
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
  }, [phase]);

  useEffect(() => {
    if (phase === 'test' && timeRemaining <= 0) void doSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, phase]);

  function handleStart() {
    hasSubmittedRef.current = false;
    const qs = buildTestQuestions();
    const initialAnswers: (number | null)[] = Array(qs.length).fill(null);
    questionsRef.current = qs;
    answersRef.current = initialAnswers;
    timeRemainingRef.current = TIME_LIMIT_SECONDS;
    setQuestions(qs);
    setUserAnswers(initialAnswers);
    setFlagged(new Set());
    setCurrentIndex(0);
    setTimeRemaining(TIME_LIMIT_SECONDS);
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
    const timeTaken = TIME_LIMIT_SECONDS - Math.max(0, timeRemainingRef.current);
    const { correct, byTopic } = scoreTest(qs, ans);
    const passed = correct >= PASS_MARK;

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

    setResultData({ correct, timeTaken, byTopic, xpEarned, newAchievements, passed });
    setPhase('results');
  }

  if (phase === 'start') return <StartView onStart={handleStart} />;

  if (phase === 'results' && resultData) {
    return (
      <ResultsView
        data={resultData}
        onReview={() => { setExpandedRows(new Set()); setPhase('review'); }}
        onDone={() => router.replace('/(tabs)/home')}
      />
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
        <Text style={[styles.timerText, isWarning && styles.timerWarn]}>
          {formatTime(timeRemaining)}
        </Text>
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

      {/* Grid overview modal */}
      <Modal visible={showGrid} transparent animationType="slide" onRequestClose={() => setShowGrid(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{'Question Overview'}</Text>
              <TouchableOpacity onPress={() => setShowGrid(false)} activeOpacity={0.7}>
                <Text style={styles.modalClose}>{'Close'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#374151' }]} /><Text style={styles.legendLabel}>{'answered'}</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} /><Text style={styles.legendLabel}>{'flagged'}</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#7B5EA7' }]} /><Text style={styles.legendLabel}>{'current'}</Text></View>
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
const INFO_CARDS = [
  { emoji: '📝', text: '50 questions' },
  { emoji: '⏱', text: '57 minutes' },
  { emoji: '✅', text: 'Pass mark: 43/50' },
  { emoji: '🔁', text: 'Change & flag answers' },
];

function StartView({ onStart }: { onStart: () => void }) {
  const theme = useTheme();
  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <Text style={[styles.screenTitle, { fontSize: theme.fontSize(28), fontFamily: theme.fontFamily, color: theme.textColor }]}>
        {'Mock Theory Test'}
      </Text>
      <Text style={[styles.screenSub, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>
        {'Conditions: Just like the real DVSA test'}
      </Text>

      <View style={styles.infoGrid}>
        {INFO_CARDS.map(({ emoji, text }) => (
          <View key={text} style={styles.infoCard}>
            <Text style={styles.infoEmoji}>{emoji}</Text>
            <Text style={[styles.infoCardText, { fontSize: theme.fontSize(13), fontFamily: theme.fontFamily, color: theme.textColor }]}>
              {text}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={onStart} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>{'Start Test'}</Text>
      </TouchableOpacity>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>{'Once started, the timer cannot be paused'}</Text>
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
  const { correct, timeTaken, byTopic, xpEarned, newAchievements, passed } = data;

  const topicRows = (Object.entries(byTopic) as [TopicCategory, TopicTally][])
    .filter(([, t]) => t.total > 0)
    .sort(([a], [b]) => TOPIC_LABELS[a].localeCompare(TOPIC_LABELS[b]));

  return (
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
        <Text style={[styles.verdictText, { color: passed ? '#34D399' : '#F87171' }]}>
          {passed ? 'PASS' : 'FAIL'}
        </Text>
        <Text style={styles.scoreText}>{correct}{' / '}{TOTAL_QUESTIONS}</Text>
        <Text style={styles.passMarkText}>{'Pass mark: '}{PASS_MARK}{'/50'}</Text>
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

      <TouchableOpacity style={styles.primaryBtn} onPress={onDone} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>{'Done'}</Text>
      </TouchableOpacity>
    </ScrollView>
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
                    <Text style={styles.tutorBtnText}>{'Ask AI Tutor 🤖'}</Text>
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
    backgroundColor: '#13131A',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1F1F2E',
  },
  qCounter: { fontSize: 14, fontWeight: '600', color: '#6B7280', width: 80 },
  timerText: { fontSize: 22, fontWeight: '800', color: '#F1F0FF', fontVariant: ['tabular-nums'], textAlign: 'center' },
  timerWarn: { color: '#F87171' },
  flagTouchable: { width: 80, alignItems: 'flex-end' },
  flagIcon: { fontSize: 18, fontWeight: '800', color: '#374151' },
  flagIconActive: { color: '#F59E0B' },

  // Question card
  questionCard: {
    backgroundColor: '#13131A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    borderLeftWidth: 3,
    borderLeftColor: '#7B5EA7',
    gap: 10,
  },
  flaggedPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  flaggedPillText: { fontSize: 10, fontWeight: '800', color: '#F59E0B', letterSpacing: 1 },
  questionText: { fontSize: 17, fontWeight: '600', color: '#F1F0FF', lineHeight: 26 },

  // Options
  optionList: { gap: 8 },
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
  optionSelected: { borderColor: '#7B5EA7', backgroundColor: '#1C1427' },
  badge: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#1C1C27', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badgeSelected: { backgroundColor: '#7B5EA7' },
  badgeText: { fontSize: 13, fontWeight: '800', color: '#6B7280' },
  badgeTextSelected: { color: '#FFFFFF' },
  optionText: { flex: 1, fontSize: 15, color: '#9CA3AF', lineHeight: 21 },
  optionTextSelected: { color: '#F1F0FF', fontWeight: '600' },

  // Nav row
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { backgroundColor: '#13131A', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#1F1F2E' },
  navBtnDisabled: { borderColor: '#111118', backgroundColor: '#0D0D14' },
  navBtnText: { fontSize: 14, fontWeight: '700', color: '#A78BFA' },
  navBtnTextDisabled: { color: '#374151' },
  overviewBtn: { alignItems: 'center', paddingVertical: 4 },
  overviewCount: { fontSize: 15, fontWeight: '700', color: '#F1F0FF' },
  overviewHint: { fontSize: 10, color: '#4B5563', marginTop: 1 },

  // Submit
  submitBtn: { backgroundColor: '#7B5EA7', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  // Grid modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#13131A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#F1F0FF' },
  modalClose: { fontSize: 15, fontWeight: '600', color: '#A78BFA' },
  legendRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendLabel: { fontSize: 11, color: '#6B7280' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gridCell: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#374151', backgroundColor: '#0D0D14', alignItems: 'center', justifyContent: 'center' },
  gridCellAnswered: { backgroundColor: '#374151', borderColor: '#374151' },
  gridCellFlagged: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  gridCellCurrent: { backgroundColor: '#7B5EA7', borderColor: '#7B5EA7' },
  gridCellText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
  gridCellTextBright: { color: '#FFFFFF' },

  // Start view
  screenTitle: { fontSize: 28, fontWeight: '900', color: '#F1F0FF' },
  screenSub: { fontSize: 14, color: '#6B7280', marginTop: -4 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoCard: { flex: 1, minWidth: '45%', backgroundColor: '#13131A', borderRadius: 14, padding: 16, alignItems: 'center', gap: 8, borderWidth: 0.5, borderColor: '#1F1F2E' },
  infoEmoji: { fontSize: 28 },
  infoCardText: { fontSize: 13, fontWeight: '600', color: '#F1F0FF', textAlign: 'center' },
  primaryBtn: { backgroundColor: '#7B5EA7', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  warningBox: { backgroundColor: '#1A1108', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#78350F' },
  warningText: { fontSize: 13, color: '#D97706', textAlign: 'center', fontWeight: '500' },

  // Results view
  achievementBanner: { backgroundColor: '#1C1C27', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#A78BFA', borderLeftWidth: 4, borderLeftColor: '#A78BFA' },
  achievementTitle: { fontSize: 11, fontWeight: '800', color: '#A78BFA', letterSpacing: 1, marginBottom: 6 },
  achievementItem: { fontSize: 14, fontWeight: '700', color: '#F1F0FF', marginBottom: 2 },
  resultBadge: { borderRadius: 20, borderWidth: 1.5, paddingVertical: 32, alignItems: 'center', gap: 6, backgroundColor: '#13131A' },
  resultBadgePass: { borderColor: '#34D399' },
  resultBadgeFail: { borderColor: '#F87171' },
  verdictText: { fontSize: 40, fontWeight: '900', letterSpacing: 6 },
  scoreText: { fontSize: 52, fontWeight: '800', color: '#F1F0FF', lineHeight: 60 },
  passMarkText: { fontSize: 13, color: '#6B7280' },
  timeTakenText: { fontSize: 13, color: '#6B7280' },
  xpBadge: { backgroundColor: '#1C1427', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: '#7B5EA7', marginTop: 4 },
  xpBadgeText: { fontSize: 15, fontWeight: '700', color: '#A78BFA' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase' },
  topicTable: { gap: 6 },
  topicRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#13131A', borderRadius: 10, padding: 10, gap: 8, borderWidth: 0.5, borderColor: '#1F1F2E' },
  topicName: { width: 110, fontSize: 12, fontWeight: '600', color: '#F1F0FF' },
  topicBarTrack: { flex: 1, height: 8, backgroundColor: '#1C1C27', borderRadius: 4, overflow: 'hidden' },
  topicBarFill: { height: 8, borderRadius: 4 },
  barStrong: { backgroundColor: '#34D399' },
  barWeak: { backgroundColor: '#F59E0B' },
  topicScore: { width: 32, fontSize: 12, fontWeight: '700', color: '#6B7280', textAlign: 'right' },
  secondaryBtn: { backgroundColor: '#13131A', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#7B5EA7' },
  secondaryBtnText: { color: '#A78BFA', fontSize: 16, fontWeight: '700' },

  // Review view
  reviewHeader: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#13131A', borderBottomWidth: 0.5, borderBottomColor: '#1F1F2E', gap: 4 },
  reviewBackBtn: { fontSize: 14, fontWeight: '600', color: '#A78BFA' },
  reviewHeaderTitle: { fontSize: 20, fontWeight: '800', color: '#F1F0FF' },
  filterRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#0D0D14', borderBottomWidth: 0.5, borderBottomColor: '#1F1F2E' },
  filterTab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#13131A', borderWidth: 1, borderColor: '#1F1F2E' },
  filterTabActive: { backgroundColor: '#7B5EA7', borderColor: '#7B5EA7' },
  filterTabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTabTextActive: { color: '#FFFFFF' },
  reviewContent: { padding: 12, paddingBottom: 48, gap: 8 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15, color: '#4B5563' },
  reviewRow: { backgroundColor: '#13131A', borderRadius: 14, overflow: 'hidden', borderWidth: 0.5, borderColor: '#1F1F2E' },
  reviewRowHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  reviewQNum: { fontSize: 12, fontWeight: '800', color: '#7B5EA7', width: 32 },
  reviewPreview: { flex: 1, fontSize: 13, color: '#9CA3AF' },
  reviewIcons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewFlagIcon: { fontSize: 14, fontWeight: '700', color: '#F59E0B' },
  correctIcon: { fontSize: 14, fontWeight: '900', color: '#34D399' },
  wrongIcon: { fontSize: 14, fontWeight: '900', color: '#F87171' },
  reviewExpanded: { paddingHorizontal: 14, paddingBottom: 14, gap: 12, borderTopWidth: 0.5, borderTopColor: '#1F1F2E' },
  reviewFullQ: { fontSize: 14, color: '#F1F0FF', lineHeight: 21, paddingTop: 12 },
  reviewOptions: { gap: 6 },
  reviewOpt: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 10, padding: 10, gap: 10, backgroundColor: '#0D0D14', borderWidth: 1, borderColor: '#1F1F2E' },
  reviewOptCorrect: { backgroundColor: 'rgba(52,211,153,0.1)', borderColor: '#34D399' },
  reviewOptWrong: { backgroundColor: 'rgba(248,113,113,0.1)', borderColor: '#F87171' },
  reviewOptLabel: { fontSize: 12, fontWeight: '800', color: '#6B7280', width: 18 },
  reviewOptText: { flex: 1, fontSize: 13, color: '#9CA3AF' },
  reviewOptTextCorrect: { color: '#34D399', fontWeight: '600' },
  reviewOptTextWrong: { color: '#F87171', fontWeight: '600' },
  explanationBox: { backgroundColor: '#1C1C27', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: '#374151' },
  explanationText: { fontSize: 13, color: '#9CA3AF', lineHeight: 19 },

  tutorBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7B5EA7',
    backgroundColor: '#0D0D14',
    paddingVertical: 12,
    alignItems: 'center',
  },
  tutorBtnText: { color: '#A78BFA', fontSize: 14, fontWeight: '700' },
});
