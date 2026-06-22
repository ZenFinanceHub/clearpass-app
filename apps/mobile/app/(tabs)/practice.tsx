import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/supabase';
import {
  Achievement,
  TopicCategory,
  Question,
  QuestionState,
  UserProgress,
  XP_REWARDS,
  awardXp,
  calculateReadiness,
  checkAchievements,
  initQuestionState,
  updateQuestionState,
} from '@clearpass/core';
import { recordAnswer, selectPracticeQuestions, getDueQuestions } from '@/src/spacedRepetition';
import { allQuestions, getQuestionById } from '@clearpass/content';
import {
  createFreshUserProgress,
  getBookmarkedQuestions,
  getWeakSpotQuestions,
  isBookmarked as checkIsBookmarked,
  loadQuestionStates,
  loadUserProgress,
  recordWeakSpotResult,
  clearWeakSpot,
  saveQuestionStates,
  saveSessionHistory,
  saveUserProgress,
  syncProgressToCloud,
  toggleBookmark,
  updateStudyStreak,
} from '@/src/storage';
import { submitSessionStats, getComparativeStats, type ComparativeStats } from '@/src/analytics';
import { playCorrect, playWrong } from '@/src/sounds';
import { cancelStreakProtectionNotification } from '@/src/notifications';
import {
  FREE_QUESTION_LIMIT,
  incrementFreeQuestionsAnswered,
  resetFreeQuestionsAnswered,
  isPremium,
} from '@/src/subscription';
import { explainAnswer } from '@clearpass/ai';
import { TOPIC_LABELS } from '@/src/tutorNudges';
import { checkAndTriggerCelebrations, CelebrationEvent } from '@/src/celebrations';
import { CelebrationModal } from '@/src/components/CelebrationModal';
import { ShareCardModal } from '@/src/components/ShareableCard';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useAccessibility } from '@/src/AccessibilityContext';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';
import { getProxyUrl } from '@/src/proxyUrl';

const SESSION_SIZE = 10;
const BATTLE_PER_TOPIC = 5;
const BATTLE_ADVANCE_MS = 1000;
const LABELS = ['A', 'B', 'C', 'D'];

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

const TOPIC_EMOJI: Record<TopicCategory, string> = {
  [TopicCategory.Alertness]: '👁',
  [TopicCategory.Attitude]: '❤',
  [TopicCategory.SafetyAndYourVehicle]: '🔧',
  [TopicCategory.SafetyMargins]: '📏',
  [TopicCategory.HazardAwareness]: '⚠',
  [TopicCategory.VulnerableRoadUsers]: '🚶',
  [TopicCategory.OtherTypes]: '🚛',
  [TopicCategory.VehicleHandling]: '🚗',
  [TopicCategory.MotorwayRules]: '🛣',
  [TopicCategory.RulesOfTheRoad]: '📋',
  [TopicCategory.RoadAndTrafficSigns]: '🚦',
  [TopicCategory.DocumentsAndRegulations]: '📄',
  [TopicCategory.AccidentsAndEmergencies]: '🚨',
  [TopicCategory.VehicleLoading]: '📦',
};

type Phase = 'start' | 'loading' | 'quiz' | 'results' | 'battle' | 'battleResults' | 'dailyLimit' | 'speedRound' | 'speedRoundResults' | 'weakSpot' | 'weakSpotResults';

type SessionResult = {
  question: Question;
  selectedIndex: number;
  correct: boolean;
};

type BattleDisplay = {
  idx: number;
  selected: number | null;
  combo: number;
  maxCombo: number;
  score: number;
};

export default function PracticeScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  const [phase, setPhase] = useState<Phase>('start');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showSRButtons, setShowSRButtons] = useState(false);
  const srRecordedRef = useRef(false);

  const [xpGained, setXpGained] = useState(0);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);

  const [battleDisplay, setBattleDisplay] = useState<BattleDisplay>({
    idx: 0,
    selected: null,
    combo: 0,
    maxCombo: 0,
    score: 0,
  });
  const [battleXpEarned, setBattleXpEarned] = useState(0);
  const [battleNewAchievements, setBattleNewAchievements] = useState<Achievement[]>([]);

  const [speedDisplay, setSpeedDisplay] = useState<{ timeLeft: number; idx: number; selected: number | null }>({ timeLeft: 90, idx: 0, selected: null });
  const [speedFinalResults, setSpeedFinalResults] = useState<SessionResult[]>([]);
  const [speedXpGained, setSpeedXpGained] = useState(0);
  const [speedTimeUsed, setSpeedTimeUsed] = useState(0);

  const [weakSpotCount, setWeakSpotCount] = useState(0);
  const [weakDisplay, setWeakDisplay] = useState<{
    selected: number | null;
    consecutive: number;
    clearedCount: number;
    totalCount: number;
    showCleared: boolean;
  }>({ selected: null, consecutive: 0, clearedCount: 0, totalCount: 0, showCleared: false });
  const [weakFinalCleared, setWeakFinalCleared] = useState<Question[]>([]);
  const [weakXpGained, setWeakXpGained] = useState(0);

  const [sessionTopic, setSessionTopic] = useState<string | null>(null);
  const [sessionPct, setSessionPct] = useState(0);

  const [sessionStreakDays, setSessionStreakDays] = useState(0);
  const [sessionTutorNudge, setSessionTutorNudge] = useState<{ topic: string; topicKey: string } | null>(null);
  const [celebQueue, setCelebQueue] = useState<CelebrationEvent[]>([]);
  const [activeCelebration, setActiveCelebration] = useState<CelebrationEvent | null>(null);

  const { settings } = useAccessibility();
  const theme = useTheme();

  const [currentBookmarked, setCurrentBookmarked] = useState(false);
  const sessionStartTimeRef = useRef<number>(0);

  const questionStatesRef = useRef<Record<string, QuestionState>>({});
  const userProgressRef = useRef<UserProgress | null>(null);
  const resultsRef = useRef<SessionResult[]>([]);

  const battleQsRef = useRef<Question[]>([]);
  const battleWeakTopicsRef = useRef<TopicCategory[]>([]);
  const battleIdxRef = useRef(0);
  const battleComboRef = useRef(0);
  const battleMaxComboRef = useRef(0);
  const battleScoreRef = useRef(0);
  const battleAnsweredRef = useRef(false);
  const battleCancelledRef = useRef(false);

  const speedQsRef = useRef<Question[]>([]);
  const speedIdxRef = useRef(0);
  const speedResultsRef2 = useRef<SessionResult[]>([]);
  const speedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedTimeRef = useRef(90);
  const speedAnsweredRef2 = useRef(false);
  const speedEndedRef = useRef(false);
  const speedStartMsRef = useRef(0);

  type WeakItem = { question: Question; consecutive: number };
  const weakQueueRef   = useRef<WeakItem[]>([]);
  const weakOrigRef    = useRef<Question[]>([]);
  const weakClearedRef = useRef<Set<string>>(new Set());
  const weakAnsweredRef3 = useRef(false);
  const weakAttemptsRef  = useRef(0);

  const optionScales = useRef([0,1,2,3].map(() => new Animated.Value(1))).current;

  // Reset option scales each new question
  useEffect(() => {
    optionScales.forEach(s => s.setValue(1));
  }, [currentIndex]);

  // Bounce the correct answer card when revealed
  useEffect(() => {
    if (selectedIndex === null || questions.length === 0) return;
    const q = questions[currentIndex];
    if (!q) return;
    const correctScale = optionScales[q.correctIndex];
    Animated.spring(correctScale, {
      toValue: 1.04,
      useNativeDriver: true,
      speed: 60,
      bounciness: 10,
    }).start(() => {
      Animated.spring(correctScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
        bounciness: 3,
      }).start();
    });
  }, [selectedIndex]);

  useEffect(() => {
    void getWeakSpotQuestions().then(ids => setWeakSpotCount(ids.length));
  }, [phase === 'start' ? phase : null]);

  // Auto-speak question + options when a new question loads (no answer yet)
  useEffect(() => {
    if (phase !== 'quiz' || !settings.textToSpeech || questions.length === 0 || selectedIndex !== null) return;
    const q = questions[currentIndex];
    if (!q) return;
    const opts = q.options.map((opt, i) => `Option ${LABELS[i]}: ${opt}`).join('. ');
    Speech.stop();
    Speech.speak(`${q.questionText}. ${opts}`, { language: 'en-GB' });
    return () => { Speech.stop(); };
  }, [phase, currentIndex, questions, settings.textToSpeech]); // selectedIndex intentionally omitted — stopping is handled in handleAnswer

  // Speak result when answer is revealed
  useEffect(() => {
    if (phase !== 'quiz' || !settings.textToSpeech || selectedIndex === null || questions.length === 0) return;
    const q = questions[currentIndex];
    if (!q) return;
    const verdict = selectedIndex === q.correctIndex ? 'Correct!' : 'Incorrect.';
    Speech.stop();
    Speech.speak(`${verdict} ${q.explanation}`, { language: 'en-GB' });
  }, [phase, currentIndex, questions, settings.textToSpeech, selectedIndex]);

  // Sync bookmark state when question changes
  useEffect(() => {
    if (phase !== 'quiz' || questions.length === 0) return;
    const q = questions[currentIndex];
    if (!q) return;
    void checkIsBookmarked(q.id).then(setCurrentBookmarked);
  }, [phase, currentIndex, questions]);

  async function handleToggleBookmark() {
    const q = questions[currentIndex];
    if (!q) return;
    const nowBookmarked = await toggleBookmark(q.id);
    setCurrentBookmarked(nowBookmarked);
  }

  async function handleProUpgrade() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth'); return; }
    try {
      const res = await fetch(`${getProxyUrl()}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) await Linking.openURL(data.url);
    } catch {
      router.push('/auth');
    }
  }

  async function startSession() {
    void cancelStreakProtectionNotification();
    const [statesMap, loaded] = await Promise.all([
      loadQuestionStates(),
      loadUserProgress(),
    ]);

    questionStatesRef.current = statesMap;
    const today = new Date().toISOString().split('T')[0];
    const base = loaded ?? createFreshUserProgress();
    const isNewDay = base.lastStudied.split('T')[0] !== today;
    const progress = isNewDay ? { ...base, dailyQuestionsAnswered: 0 } : base;
    if (isNewDay) await resetFreeQuestionsAnswered();
    userProgressRef.current = progress;

    if (!(progress.isPro ?? false) && (progress.dailyQuestionsAnswered ?? 0) >= 10) {
      setPhase('dailyLimit');
      return;
    }

    let sessionQuestions: Question[];
    if (mode === 'bookmarked') {
      const bookmarkedIds = await getBookmarkedQuestions();
      const all = bookmarkedIds
        .map((id) => getQuestionById(id))
        .filter((q): q is Question => q !== undefined);
      sessionQuestions = all.sort(() => Math.random() - 0.5).slice(0, SESSION_SIZE);
      if (sessionQuestions.length === 0) {
        sessionQuestions = await selectPracticeQuestions(allQuestions, SESSION_SIZE);
      }
    } else if (mode === 'review') {
      const dueIds = await getDueQuestions(allQuestions.map(q => q.id), SESSION_SIZE);
      sessionQuestions = dueIds
        .map(id => getQuestionById(id))
        .filter((q): q is Question => q !== undefined);
      if (sessionQuestions.length === 0) {
        sessionQuestions = await selectPracticeQuestions(allQuestions, SESSION_SIZE);
      }
    } else {
      sessionQuestions = await selectPracticeQuestions(allQuestions, SESSION_SIZE);
    }
    sessionStartTimeRef.current = Date.now();

    resultsRef.current = [];
    setSessionResults([]);
    setCurrentIndex(0);
    setSelectedIndex(null);
    setAiExplanation(null);
    setAiLoading(false);
    setXpGained(0);
    setNewAchievements([]);
    setSessionTutorNudge(null);
    setQuestions(sessionQuestions);
    setPhase(sessionQuestions.length > 0 ? 'quiz' : 'results');
  }

  async function startBattle() {
    const progress = (await loadUserProgress()) ?? createFreshUserProgress();
    userProgressRef.current = progress;

    const weakTopics = Object.values(TopicCategory)
      .sort((a, b) => (progress.topicScores[a] ?? 0) - (progress.topicScores[b] ?? 0))
      .slice(0, 3);

    battleWeakTopicsRef.current = weakTopics;

    const qs: Question[] = [];
    for (const topic of weakTopics) {
      const pool = allQuestions
        .filter((q) => q.topicCategory === topic)
        .sort(() => Math.random() - 0.5)
        .slice(0, BATTLE_PER_TOPIC);
      qs.push(...pool);
    }
    const shuffled = qs.sort(() => Math.random() - 0.5);

    battleQsRef.current = shuffled;
    battleIdxRef.current = 0;
    battleComboRef.current = 0;
    battleMaxComboRef.current = 0;
    battleScoreRef.current = 0;
    battleAnsweredRef.current = false;
    battleCancelledRef.current = false;

    setBattleDisplay({ idx: 0, selected: null, combo: 0, maxCombo: 0, score: 0 });
    setBattleXpEarned(0);
    setBattleNewAchievements([]);
    setPhase('battle');
  }

  function handleBattleAnswer(optionIndex: number) {
    if (battleAnsweredRef.current) return;
    battleAnsweredRef.current = true;

    const capturedIdx = battleIdxRef.current;
    const q = battleQsRef.current[capturedIdx];
    if (!q) return;

    const isCorrect = optionIndex === q.correctIndex;
    const newCombo = isCorrect ? battleComboRef.current + 1 : 0;
    const multiplier = Math.min(Math.max(newCombo, 1), 5);
    const gained = isCorrect ? multiplier : 0;

    battleComboRef.current = newCombo;
    if (newCombo > battleMaxComboRef.current) {
      battleMaxComboRef.current = newCombo;
    }
    battleScoreRef.current += gained;

    setBattleDisplay({
      idx: capturedIdx,
      selected: optionIndex,
      combo: newCombo,
      maxCombo: battleMaxComboRef.current,
      score: battleScoreRef.current,
    });

    setTimeout(() => {
      if (battleCancelledRef.current) return;
      const nextIdx = capturedIdx + 1;
      if (nextIdx >= battleQsRef.current.length) {
        void finaliseBattle();
      } else {
        battleIdxRef.current = nextIdx;
        battleAnsweredRef.current = false;
        setBattleDisplay({
          idx: nextIdx,
          selected: null,
          combo: battleComboRef.current,
          maxCombo: battleMaxComboRef.current,
          score: battleScoreRef.current,
        });
      }
    }, BATTLE_ADVANCE_MS);
  }

  async function finaliseBattle() {
    const score = battleScoreRef.current;
    const xpEarned = score >= 10 ? XP_REWARDS.BATTLE_MODE_WIN : 0;

    let progress = userProgressRef.current ?? createFreshUserProgress();

    if (xpEarned > 0) {
      progress = awardXp(progress, xpEarned);
    }

    const battleRecord = {
      date: new Date().toISOString(),
      score,
      topicsUsed: battleWeakTopicsRef.current.map((t) => String(t)),
    };
    progress = {
      ...progress,
      battleModeHistory: [...(progress.battleModeHistory ?? []), battleRecord],
    };

    const { newAchievements: unlocked, updatedProgress } = checkAchievements(progress);
    userProgressRef.current = updatedProgress;
    await saveUserProgress(updatedProgress);
    await syncProgressToCloud(updatedProgress);

    setBattleXpEarned(xpEarned);
    setBattleNewAchievements(unlocked);
    setPhase('battleResults');
  }

  function startSpeedRound() {
    void cancelStreakProtectionNotification();
    const qs = allQuestions.sort(() => Math.random() - 0.5).slice(0, 10);
    speedQsRef.current = qs;
    speedIdxRef.current = 0;
    speedResultsRef2.current = [];
    speedAnsweredRef2.current = false;
    speedEndedRef.current = false;
    speedTimeRef.current = 90;
    speedStartMsRef.current = Date.now();

    setSpeedDisplay({ timeLeft: 90, idx: 0, selected: null });
    setSpeedFinalResults([]);
    setSpeedXpGained(0);
    setSpeedTimeUsed(0);
    setPhase('speedRound');

    speedTimerRef.current = setInterval(() => {
      speedTimeRef.current -= 1;
      if (speedTimeRef.current <= 0) {
        if (speedTimerRef.current) { clearInterval(speedTimerRef.current); speedTimerRef.current = null; }
        void finaliseSpeedRound(true);
      } else {
        setSpeedDisplay(prev => ({ ...prev, timeLeft: speedTimeRef.current }));
      }
    }, 1000);
  }

  function handleSpeedAnswer(optionIndex: number) {
    if (speedAnsweredRef2.current || speedEndedRef.current) return;
    speedAnsweredRef2.current = true;

    const q = speedQsRef.current[speedIdxRef.current];
    if (!q) return;
    const correct = optionIndex === q.correctIndex;

    if (settings.soundEffects) {
      if (correct) playCorrect(); else playWrong();
    }
    void (correct
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

    speedResultsRef2.current = [...speedResultsRef2.current, { question: q, selectedIndex: optionIndex, correct }];
    setSpeedDisplay(prev => ({ ...prev, selected: optionIndex }));

    setTimeout(() => {
      if (speedEndedRef.current) return;
      const nextIdx = speedIdxRef.current + 1;
      if (nextIdx >= speedQsRef.current.length) {
        if (speedTimerRef.current) { clearInterval(speedTimerRef.current); speedTimerRef.current = null; }
        void finaliseSpeedRound(false);
      } else {
        speedIdxRef.current = nextIdx;
        speedAnsweredRef2.current = false;
        setSpeedDisplay(prev => ({ ...prev, idx: nextIdx, selected: null }));
      }
    }, 400);
  }

  async function finaliseSpeedRound(timerExpired: boolean) {
    if (speedEndedRef.current) return;
    speedEndedRef.current = true;

    const results = speedResultsRef2.current;
    const timeUsed = Math.round((Date.now() - speedStartMsRef.current) / 1000);
    const correctCount = results.filter(r => r.correct).length;
    const allCompleted = results.length === 10;

    let xp = correctCount * 5;
    if (allCompleted && timeUsed < 60) xp += 10;

    const progress = (await loadUserProgress()) ?? createFreshUserProgress();
    const updated = awardXp(progress, xp);
    await saveUserProgress(updated);
    await syncProgressToCloud(updated);

    void saveSessionHistory({
      date: new Date().toISOString(),
      score: correctCount,
      total: results.length,
      topic: 'Speed Round',
      durationSeconds: timeUsed,
    });

    setSpeedFinalResults(results);
    setSpeedXpGained(xp);
    setSpeedTimeUsed(timeUsed);
    setPhase('speedRoundResults');
  }

  async function startWeakSpotDrill() {
    void cancelStreakProtectionNotification();
    const ids = await getWeakSpotQuestions();
    const qs = ids.map(id => getQuestionById(id)).filter((q): q is Question => q !== undefined);
    if (qs.length < 5) { setPhase('start'); return; }

    const queue: WeakItem[] = qs.sort(() => Math.random() - 0.5).map(q => ({ question: q, consecutive: 0 }));
    weakQueueRef.current = queue;
    weakOrigRef.current = qs;
    weakClearedRef.current = new Set();
    weakAnsweredRef3.current = false;
    weakAttemptsRef.current = 0;

    setWeakDisplay({ selected: null, consecutive: 0, clearedCount: 0, totalCount: qs.length, showCleared: false });
    setWeakFinalCleared([]);
    setWeakXpGained(0);
    setPhase('weakSpot');
  }

  function handleWeakAnswer(optionIndex: number) {
    if (weakAnsweredRef3.current) return;
    weakAnsweredRef3.current = true;
    weakAttemptsRef.current += 1;

    const item = weakQueueRef.current[0];
    if (!item) return;
    const correct = optionIndex === item.question.correctIndex;

    if (settings.soundEffects) { if (correct) playCorrect(); else playWrong(); }
    void (correct
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    void recordWeakSpotResult(item.question.id, correct);

    const newConsecutive = correct ? item.consecutive + 1 : 0;
    setWeakDisplay(prev => ({ ...prev, selected: optionIndex, consecutive: newConsecutive }));

    const maxAttempts = weakOrigRef.current.length * 6;
    if (weakAttemptsRef.current >= maxAttempts) {
      setTimeout(() => { void finaliseWeakSpot(); }, 400);
      return;
    }

    setTimeout(() => {
      weakQueueRef.current.shift();

      if (correct && newConsecutive >= 3) {
        weakClearedRef.current.add(item.question.id);
        void clearWeakSpot(item.question.id);
        setWeakDisplay(prev => ({
          ...prev,
          showCleared: true,
          clearedCount: weakClearedRef.current.size,
        }));
        setTimeout(() => {
          if (weakQueueRef.current.length === 0) {
            void finaliseWeakSpot();
          } else {
            const next = weakQueueRef.current[0]!;
            weakAnsweredRef3.current = false;
            setWeakDisplay(prev => ({
              ...prev,
              selected: null,
              showCleared: false,
              consecutive: next.consecutive,
              clearedCount: weakClearedRef.current.size,
            }));
          }
        }, 700);
      } else {
        weakQueueRef.current.push({ ...item, consecutive: newConsecutive });
        if (weakQueueRef.current.length === 0) {
          void finaliseWeakSpot();
        } else {
          const next = weakQueueRef.current[0]!;
          weakAnsweredRef3.current = false;
          setWeakDisplay(prev => ({
            ...prev,
            selected: null,
            showCleared: false,
            consecutive: next.consecutive,
          }));
        }
      }
    }, 400);
  }

  async function finaliseWeakSpot() {
    const clearedQuestions = weakOrigRef.current.filter(q => weakClearedRef.current.has(q.id));
    const xp = clearedQuestions.length * 15;
    const progress = (await loadUserProgress()) ?? createFreshUserProgress();
    const updated = awardXp(progress, xp);
    await saveUserProgress(updated);
    await syncProgressToCloud(updated);
    setWeakFinalCleared(clearedQuestions);
    setWeakXpGained(xp);
    setPhase('weakSpotResults');
  }

  async function handlePlayAgain() {
    setPhase('start');
  }

  function exitBattle() {
    battleCancelledRef.current = true;
    setPhase('start');
  }

  const handleAnswer = useCallback(
    async (optionIndex: number) => {
      if (selectedIndex !== null) return;
      Speech.stop();

      const question = questions[currentIndex];
      const correct = optionIndex === question.correctIndex;

      const existing =
        questionStatesRef.current[question.id] ?? initQuestionState(question.id);
      const updated = updateQuestionState(existing, correct, correct ? 4 : 1);
      questionStatesRef.current = {
        ...questionStatesRef.current,
        [question.id]: updated,
      };

      const result: SessionResult = { question, selectedIndex: optionIndex, correct };
      resultsRef.current = [...resultsRef.current, result];

      if (settings.soundEffects) {
        if (correct) playCorrect(); else playWrong();
      }
      void (correct
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

      void recordWeakSpotResult(question.id, correct);

      setSelectedIndex(optionIndex);
      setSessionResults(resultsRef.current);

      // SR: auto-record wrong answers; correct answers wait for Easy/Hard tap
      srRecordedRef.current = false;
      if (!correct) {
        void recordAnswer(question.id, false, false);
        srRecordedRef.current = true;
      } else {
        setShowSRButtons(true);
      }

      await saveQuestionStates(questionStatesRef.current);
    },
    [selectedIndex, questions, currentIndex],
  );

  function handleSRRecord(wasHard: boolean) {
    if (srRecordedRef.current) return;
    const question = questions[currentIndex];
    srRecordedRef.current = true;
    setShowSRButtons(false);
    void recordAnswer(question.id, true, wasHard);
  }

  const handleNext = useCallback(async () => {
    Speech.stop();
    // Auto-record easy if user skipped the SR rating on a correct answer
    if (!srRecordedRef.current && selectedIndex !== null) {
      const q = questions[currentIndex];
      if (q && selectedIndex === q.correctIndex) {
        void recordAnswer(q.id, true, false);
      }
    }
    srRecordedRef.current = false;
    setShowSRButtons(false);

    const count = await incrementFreeQuestionsAnswered();
    if (count >= FREE_QUESTION_LIMIT) {
      const premium = await isPremium();
      if (!premium) {
        router.push('/paywall');
        return;
      }
    }
    const isLast = currentIndex + 1 >= questions.length;
    if (isLast) {
      await finaliseSession();
      setPhase('results');
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedIndex(null);
      setAiExplanation(null);
      setAiLoading(false);
    }
  }, [currentIndex, questions, questions.length, selectedIndex]);

  const handleExplain = useCallback(async () => {
    if (aiLoading || aiExplanation !== null) return;
    const q = questions[currentIndex];
    if (selectedIndex === null) return;
    setAiLoading(true);
    const result = await explainAnswer(
      q.questionText,
      q.options,
      q.correctIndex,
      selectedIndex,
      ANTHROPIC_API_KEY,
    );
    setAiExplanation(result);
    setAiLoading(false);
  }, [aiLoading, aiExplanation, questions, currentIndex, selectedIndex]);

  async function finaliseSession() {
    const results = resultsRef.current;
    const progress = userProgressRef.current ?? createFreshUserProgress();

    const topicData: Partial<Record<TopicCategory, { correct: number; total: number }>> = {};
    for (const { question, correct } of results) {
      const cat = question.topicCategory;
      if (!topicData[cat]) topicData[cat] = { correct: 0, total: 0 };
      topicData[cat]!.total += 1;
      if (correct) topicData[cat]!.correct += 1;
    }

    const updatedScores = { ...progress.topicScores };
    for (const [cat, data] of Object.entries(topicData) as [
      TopicCategory,
      { correct: number; total: number },
    ][]) {
      const sessionAccuracy = Math.round((data.correct / data.total) * 100);
      const existing = updatedScores[cat] ?? 0;
      updatedScores[cat] =
        existing === 0
          ? sessionAccuracy
          : Math.round(existing * 0.6 + sessionAccuracy * 0.4);
    }

    const streaked = updateStudyStreak(progress);
    const correctCount = results.filter((r) => r.correct).length;

    let updated: UserProgress = {
      ...streaked,
      topicScores: updatedScores,
      totalQuestionsAnswered: progress.totalQuestionsAnswered + results.length,
      lastStudied: new Date().toISOString(),
      dailyQuestionsAnswered: (progress.dailyQuestionsAnswered ?? 0) + results.length,
    };
    updated.readinessScore = calculateReadiness(updated).score;

    let xpThisSession = XP_REWARDS.PRACTICE_COMPLETED;
    if (correctCount === SESSION_SIZE) {
      xpThisSession += XP_REWARDS.PRACTICE_PERFECT;
      if (!(updated.achievements ?? []).includes('perfect_ten_eligible')) {
        updated = {
          ...updated,
          achievements: [...(updated.achievements ?? []), 'perfect_ten_eligible'],
        };
      }
    }
    updated = awardXp(updated, xpThisSession);

    const today = new Date().toISOString().split('T')[0];
    const dc = updated.dailyChallenge;
    if (dc && dc.date === today && !dc.completed) {
      let newCount = dc.currentCount;

      if (dc.challengeType === 'anyQuestions') {
        newCount = Math.min(newCount + correctCount, dc.targetCount);
      } else if (dc.challengeType === 'topic' && dc.topicCategory) {
        const topicCorrect = results.filter(
          (r) => r.correct && r.question.topicCategory === dc.topicCategory,
        ).length;
        newCount = Math.min(newCount + topicCorrect, dc.targetCount);
      } else if (dc.challengeType === 'practiceScore') {
        if (correctCount >= dc.targetCount) newCount = dc.targetCount;
      } else if (dc.challengeType === 'timeMinutes') {
        newCount = Math.min(newCount + 10, dc.targetCount);
      }

      const justCompleted = newCount >= dc.targetCount;
      if (justCompleted) {
        updated = awardXp(updated, XP_REWARDS.DAILY_CHALLENGE);
        xpThisSession += XP_REWARDS.DAILY_CHALLENGE;
      }
      updated = {
        ...updated,
        dailyChallenge: { ...dc, currentCount: newCount, completed: justCompleted },
      };
    }

    const { newAchievements: unlocked, updatedProgress: final } = checkAchievements(updated);
    userProgressRef.current = final;
    await saveUserProgress(final);
    await syncProgressToCloud(final);

    const durationSeconds = Math.round((Date.now() - sessionStartTimeRef.current) / 1000);
    const topicKeys = Object.keys(topicData) as TopicCategory[];
    const sessionTopic = topicKeys.length === 1 ? (TOPIC_LABELS[topicKeys[0]] ?? 'Mixed') : 'Mixed';
    void saveSessionHistory({ date: new Date().toISOString(), score: correctCount, total: results.length, topic: sessionTopic, durationSeconds });

    setXpGained(xpThisSession);
    setNewAchievements(unlocked);
    setSessionStreakDays(final.studyStreakDays ?? 0);

    const singleTopic = topicKeys.length === 1 ? (TOPIC_LABELS[topicKeys[0]] ?? null) : null;
    setSessionTopic(singleTopic);
    setSessionPct(results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0);
    if (singleTopic) void submitSessionStats(singleTopic, correctCount, results.length);

    const strugglingEntry = Object.entries(topicData).find(
      ([, data]) => data.total >= 2 && data.correct / data.total < 0.5,
    );
    if (strugglingEntry) {
      const [topicKey] = strugglingEntry;
      setSessionTutorNudge({
        topic: TOPIC_LABELS[topicKey as TopicCategory] ?? topicKey,
        topicKey,
      });
    } else {
      setSessionTutorNudge(null);
    }

    try {
      const celebEvents = await checkAndTriggerCelebrations(final);
      if (celebEvents.length > 0) {
        setActiveCelebration(celebEvents[0]);
        setCelebQueue(celebEvents.slice(1));
      }
    } catch {}
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

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'start') {
    return (
      <>
        <OfflineBanner />
        <StartView
          onStart={() => { setPhase('loading'); void startSession(); }}
          onBattle={() => void startBattle()}
          onSpeedRound={() => startSpeedRound()}
          onWeakSpot={() => void startWeakSpotDrill()}
          weakSpotCount={weakSpotCount}
        />
      </>
    );
  }

  if (phase === 'loading') {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={Colors.indigo} />
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
    );
  }

  if (phase === 'dailyLimit') {
    return (
      <DailyLimitView
        onUpgrade={() => void handleProUpgrade()}
        onBack={() => setPhase('start')}
      />
    );
  }

  if (phase === 'results') {
    return (
      <>
        <OfflineBanner />
        <ResultsScreen
          results={sessionResults}
          onPlayAgain={handlePlayAgain}
          xpGained={xpGained}
          newAchievements={newAchievements}
          tutorNudge={sessionTutorNudge}
          streakDays={sessionStreakDays}
          sessionTopic={sessionTopic}
          userAccuracyPct={sessionPct}
        />
        {activeCelebration && (
          <CelebrationModal event={activeCelebration} onDismiss={handleCelebDismiss} />
        )}
      </>
    );
  }

  if (phase === 'battle') {
    const bq = battleQsRef.current[battleDisplay.idx];
    if (!bq) return null;
    return (
      <BattleView
        question={bq}
        questionIndex={battleDisplay.idx}
        totalQuestions={battleQsRef.current.length}
        selected={battleDisplay.selected}
        combo={battleDisplay.combo}
        score={battleDisplay.score}
        weakTopics={battleWeakTopicsRef.current}
        onAnswer={handleBattleAnswer}
        onExit={exitBattle}
      />
    );
  }

  if (phase === 'speedRound') {
    const sq = speedQsRef.current[speedDisplay.idx];
    if (!sq) return null;
    return (
      <SpeedRoundView
        question={sq}
        questionIndex={speedDisplay.idx}
        totalQuestions={speedQsRef.current.length}
        selected={speedDisplay.selected}
        timeLeft={speedDisplay.timeLeft}
        onAnswer={handleSpeedAnswer}
        onExit={() => {
          speedEndedRef.current = true;
          if (speedTimerRef.current) { clearInterval(speedTimerRef.current); speedTimerRef.current = null; }
          setPhase('start');
        }}
      />
    );
  }

  if (phase === 'speedRoundResults') {
    return (
      <SpeedRoundResultsView
        results={speedFinalResults}
        timeUsed={speedTimeUsed}
        xpGained={speedXpGained}
        onPlayAgain={() => startSpeedRound()}
        onBack={handlePlayAgain}
      />
    );
  }

  if (phase === 'weakSpot') {
    const wq = weakQueueRef.current[0];
    if (!wq) return null;
    return (
      <WeakSpotView
        question={wq.question}
        selected={weakDisplay.selected}
        consecutive={weakDisplay.consecutive}
        clearedCount={weakDisplay.clearedCount}
        totalCount={weakDisplay.totalCount}
        showCleared={weakDisplay.showCleared}
        onAnswer={handleWeakAnswer}
        onExit={() => void finaliseWeakSpot()}
      />
    );
  }

  if (phase === 'weakSpotResults') {
    return (
      <WeakSpotResultsView
        clearedQuestions={weakFinalCleared}
        totalQuestions={weakOrigRef.current.length}
        xpGained={weakXpGained}
        onPlayAgain={() => void startWeakSpotDrill()}
        onBack={handlePlayAgain}
      />
    );
  }

  if (phase === 'battleResults') {
    return (
      <BattleResultsScreen
        score={battleDisplay.score}
        maxCombo={battleDisplay.maxCombo}
        totalQuestions={battleQsRef.current.length}
        xpEarned={battleXpEarned}
        newAchievements={battleNewAchievements}
        onPlayAgain={() => void startBattle()}
        onBackToPractice={handlePlayAgain}
      />
    );
  }

  // quiz phase
  const question = questions[currentIndex];
  const isAnswered = selectedIndex !== null;
  const answeredCorrectly = isAnswered && selectedIndex === question.correctIndex;
  const progressPct = ((currentIndex + (isAnswered ? 1 : 0)) / questions.length) * 100;
  const topicEmoji = TOPIC_EMOJI[question.topicCategory];

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>
          {'Question '}{currentIndex + 1}{' of '}{questions.length}
        </Text>
        <Text style={styles.progressPct}>{Math.round(progressPct)}{'%'}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
      </View>

      <View style={styles.questionCard}>
        <View style={styles.topicBadge}>
          <Text style={styles.topicBadgeEmoji}>{topicEmoji}</Text>
        </View>
        <TouchableOpacity style={styles.bookmarkBtn} onPress={() => void handleToggleBookmark()} activeOpacity={0.7}>
          <Text style={styles.bookmarkBtnText}>{currentBookmarked ? '🔖' : '🏷️'}</Text>
        </TouchableOpacity>
        {settings.textToSpeech && (
          <TouchableOpacity
            style={styles.speakerBtn}
            onPress={() => { const opts = question.options.map((o, i) => `Option ${LABELS[i]}: ${o}`).join('. '); Speech.stop(); Speech.speak(`${question.questionText}. ${opts}`, { language: 'en-GB' }); }}
            activeOpacity={0.75}
          >
            <Text style={styles.speakerBtnText}>{'[ >> ]'}</Text>
          </TouchableOpacity>
        )}
        <Text
          style={[styles.questionText, { fontSize: theme.fontSize(17), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(26), color: theme.textColor }]}
          onPress={settings.textToSpeech ? () => { Speech.stop(); Speech.speak(question.questionText, { language: 'en-GB' }); } : undefined}
          suppressHighlighting={!settings.textToSpeech}
        >
          {question.questionText}
        </Text>
      </View>

      <View style={styles.optionList}>
        {question.options.map((option, idx) => {
          const isCorrect = idx === question.correctIndex;
          const isSelected = idx === selectedIndex;

          let cardStyle = styles.optionDefault;
          let badgeStyle = styles.badgeDefault;
          let textStyle = styles.optionTextDefault;
          let badgeTextStyle = styles.badgeTextDefault;

          if (isAnswered) {
            if (isCorrect) {
              cardStyle = styles.optionCorrect;
              badgeStyle = styles.badgeCorrect;
              textStyle = styles.optionTextCorrect;
              badgeTextStyle = styles.badgeTextColored;
            } else if (isSelected) {
              cardStyle = styles.optionWrong;
              badgeStyle = styles.badgeWrong;
              textStyle = styles.optionTextWrong;
              badgeTextStyle = styles.badgeTextColored;
            } else {
              cardStyle = styles.optionDimmed;
              textStyle = styles.optionTextDimmed;
            }
          }

          return (
            <Animated.View key={idx} style={{ transform: [{ scale: optionScales[idx] }] }}>
              <TouchableOpacity
                style={[styles.option, cardStyle, settings.highContrast ? { borderWidth: 2, borderColor: isAnswered ? undefined : theme.borderColor } : undefined]}
                onPress={() => {
                  if (isAnswered) {
                    if (settings.textToSpeech) { Speech.stop(); Speech.speak(option, { language: 'en-GB' }); }
                    return;
                  }
                  Animated.sequence([
                    Animated.timing(optionScales[idx], { toValue: 0.95, duration: 70, useNativeDriver: true }),
                    Animated.spring(optionScales[idx], { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }),
                  ]).start();
                  void handleAnswer(idx);
                }}
                activeOpacity={!isAnswered || settings.textToSpeech ? 0.75 : 1}
                disabled={isAnswered && !settings.textToSpeech}
              >
                <View style={[styles.badge, badgeStyle]}>
                  <Text style={[styles.badgeText, badgeTextStyle]}>{LABELS[idx]}</Text>
                </View>
                <Text style={[styles.optionText, textStyle, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing }]}>{option}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {isAnswered && (
        <View
          style={[
            styles.explanation,
            answeredCorrectly ? styles.explanationGreen : styles.explanationRed,
          ]}
        >
          <Text
            style={[
              styles.explanationTitle,
              answeredCorrectly ? styles.explanationTitleGreen : styles.explanationTitleRed,
            ]}
          >
            {answeredCorrectly ? 'Correct!' : 'Incorrect'}
          </Text>
          <LinkedExplanation
            text={question.explanation}
            bodyStyle={answeredCorrectly ? styles.explanationBodyGreen : styles.explanationBodyRed}
          />
        </View>
      )}

      {isAnswered && answeredCorrectly && showSRButtons && (
        <View style={styles.srRow}>
          <Text style={styles.srRowLabel}>How well did you know this?</Text>
          <View style={styles.srBtns}>
            <TouchableOpacity style={styles.easyBtn} onPress={() => handleSRRecord(false)} activeOpacity={0.8}>
              <Text style={styles.easyBtnText}>{'Easy ✓'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.hardBtn} onPress={() => handleSRRecord(true)} activeOpacity={0.8}>
              <Text style={styles.hardBtnText}>{'Hard ✓'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isAnswered && !answeredCorrectly && (
        <>
          {aiExplanation !== null ? (
            <View style={styles.aiCard}>
              <Text style={styles.aiCardTitle}>AI TUTOR</Text>
              <Text style={styles.aiCardBody}>{aiExplanation}</Text>
            </View>
          ) : aiLoading ? (
            <View style={styles.aiLoadingRow}>
              <ActivityIndicator size="small" color={Colors.indigo} />
              <Text style={styles.aiLoadingText}>Getting explanation...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.explainButton}
              onPress={handleExplain}
              activeOpacity={0.85}
            >
              <Text style={styles.explainButtonText}>Explain this answer</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {isAnswered && (
        <TouchableOpacity
          style={styles.tutorButton}
          onPress={() => router.push({
            pathname: '/(tabs)/tutor',
            params: {
              questionText: question.questionText,
              userAnswerText: selectedIndex !== null ? question.options[selectedIndex] : '',
              correctAnswerText: question.options[question.correctIndex],
              explanation: question.explanation,
            },
          })}
          activeOpacity={0.85}
        >
          <Text style={styles.tutorButtonText}>{'Ask AI Tutor 🤖'}</Text>
        </TouchableOpacity>
      )}

      {isAnswered && (
        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>
            {currentIndex + 1 >= questions.length ? 'See Results' : 'Next Question ->'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ── LinkedExplanation ─────────────────────────────────────────────────────────

const RULE_PATTERN = /(?:Highway Code )?Rule (\d+)/g;

function LinkedExplanation({ text, bodyStyle }: { text: string; bodyStyle: object }) {
  const segments: { text: string; ruleNumber?: number }[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  RULE_PATTERN.lastIndex = 0;
  while ((match = RULE_PATTERN.exec(text)) !== null) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index) });
    segments.push({ text: match[0], ruleNumber: parseInt(match[1], 10) });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });

  return (
    <Text style={[styles.explanationBody, bodyStyle]}>
      {segments.map((seg, i) =>
        seg.ruleNumber ? (
          <Text
            key={i}
            style={styles.ruleLink}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/highwaycode',
                params: { ruleNumber: String(seg.ruleNumber) },
              })
            }
          >
            {seg.text}
          </Text>
        ) : (
          <Text key={i}>{seg.text}</Text>
        ),
      )}
    </Text>
  );
}

// ── Sub-screens ───────────────────────────────────────────────────────────────

function StartView({
  onStart,
  onBattle,
  onSpeedRound,
  onWeakSpot,
  weakSpotCount,
}: {
  onStart: () => void;
  onBattle: () => void;
  onSpeedRound: () => void;
  onWeakSpot: () => void;
  weakSpotCount: number;
}) {
  const theme = useTheme();
  const hasWeakSpots = weakSpotCount >= 5;
  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.startContent}>
      <Text style={[styles.startTitle, { color: theme.textColor }]}>Practice Mode</Text>
      <Text style={styles.startSub}>
        Adaptive questions based on your progress
      </Text>

      <TouchableOpacity style={styles.primaryButton} onPress={onStart} activeOpacity={0.85}>
        <Text style={styles.primaryButtonText}>Start Practice</Text>
      </TouchableOpacity>

      <Text style={styles.startOr}>{'- or -'}</Text>

      <TouchableOpacity
        style={[styles.weakSpotButton, !hasWeakSpots && styles.weakSpotButtonDisabled]}
        onPress={hasWeakSpots ? onWeakSpot : undefined}
        activeOpacity={hasWeakSpots ? 0.85 : 1}
      >
        <Text style={[styles.weakSpotButtonTitle, !hasWeakSpots && { color: Colors.subtleText }]}>
          {'[!] Weak Spots'}
          {hasWeakSpots ? ` (${weakSpotCount})` : ''}
        </Text>
        <Text style={styles.weakSpotButtonSubtitle}>
          {hasWeakSpots
            ? 'Questions you keep getting wrong - drill until cleared'
            : 'Keep practising -- we will identify your weak spots after a few sessions'}
        </Text>
        {hasWeakSpots && (
          <Text style={styles.weakSpotButtonSub}>{'15 XP per weak spot cleared'}</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.startOr}>{'- or -'}</Text>

      <TouchableOpacity style={styles.speedButton} onPress={onSpeedRound} activeOpacity={0.85}>
        <Text style={styles.speedButtonTitle}>{'[>] Speed Round'}</Text>
        <Text style={styles.speedButtonSubtitle}>10 questions, 90-second countdown</Text>
        <Text style={styles.speedButtonSub}>
          {'5 XP per correct answer + 10 XP bonus if you finish all 10 under 60s'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.startOr}>{'- or -'}</Text>

      <TouchableOpacity style={styles.battleButton} onPress={onBattle} activeOpacity={0.85}>
        <Text style={styles.battleButtonTitle}>{'[x] Battle Mode'}</Text>
        <Text style={styles.battleButtonSubtitle}>Race through your 3 weakest topics</Text>
        <Text style={styles.battleButtonSub}>
          Build combos for bonus points - how high can you score?
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function resultConfig(pct: number): {
  borderColor: string;
  accentColor: string;
  label: string;
  emoji: string;
} {
  if (pct === 100)
    return { borderColor: Colors.emerald, accentColor: Colors.emerald, label: 'PERFECT!', emoji: '🏆' };
  if (pct >= 80)
    return { borderColor: Colors.indigo, accentColor: Colors.indigo, label: 'GREAT JOB!', emoji: '⭐' };
  if (pct >= 60)
    return { borderColor: Colors.amber, accentColor: Colors.amber, label: 'NOT BAD!', emoji: '👍' };
  return { borderColor: Colors.red, accentColor: Colors.red, label: 'KEEP GOING!', emoji: '💪' };
}

function motivationalMessage(correct: number, total: number): string {
  if (correct === total) return "Perfect score! You're a theory test legend!";
  const pct = Math.round((correct / total) * 100);
  if (pct >= 80) return 'Almost perfect - keep it up!';
  if (pct >= 60) return "Good effort - a bit more practice and you'll nail it!";
  return "Keep going - every wrong answer is one you'll definitely know next time!";
}

function ResultsScreen({
  results,
  onPlayAgain,
  xpGained,
  newAchievements,
  tutorNudge,
  streakDays,
  sessionTopic,
  userAccuracyPct,
}: {
  results: SessionResult[];
  onPlayAgain: () => void;
  xpGained: number;
  newAchievements: Achievement[];
  tutorNudge?: { topic: string; topicKey: string } | null;
  streakDays?: number;
  sessionTopic?: string | null;
  userAccuracyPct?: number;
}) {
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [comparative, setComparative] = useState<ComparativeStats | null>(null);
  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const cfg = resultConfig(pct);
  const theme = useTheme();
  const topicSet = new Set(results.map((r) => r.question.topicCategory));
  const dominantTopic = topicSet.size === 1 ? TOPIC_LABELS[Array.from(topicSet)[0] as TopicCategory] : undefined;

  useEffect(() => {
    if (!sessionTopic || userAccuracyPct === undefined) return;
    void getComparativeStats(sessionTopic, userAccuracyPct).then(setComparative);
  }, [sessionTopic, userAccuracyPct]);

  return (
  <>
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
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

      <View style={[styles.scoreBanner, { borderColor: cfg.borderColor }]}>
        <Text style={styles.resultEmoji}>{cfg.emoji}</Text>
        <Text style={[styles.resultLabel, { color: cfg.accentColor }]}>{cfg.label}</Text>
        <Text style={styles.scoreValue}>
          {correct}{' / '}{total}
        </Text>
        <Text style={styles.scorePct}>{pct}{'%'}</Text>
        {xpGained > 0 && (
          <Text style={styles.xpNotif}>{'+'}{xpGained}{' XP earned!'}</Text>
        )}
      </View>

      {comparative && comparative.totalAnswers >= 50 && sessionTopic && (
        <View style={styles.comparativeCard}>
          <Text style={styles.comparativeText}>
            {'You scored better than '}
            <Text style={styles.comparativePct}>{comparative.betterThan}{'%'}</Text>
            {' of ClearPass users on '}{sessionTopic}
          </Text>
          <Text style={styles.comparativeAvg}>
            {'Platform average: '}{comparative.platformAvgPct}{'%'}
          </Text>
        </View>
      )}

      <Text style={[styles.motivationalMsg, { color: cfg.accentColor }]}>
        {motivationalMessage(correct, total)}
      </Text>

      {tutorNudge && !nudgeDismissed && (
        <View style={styles.sessionNudgeCard}>
          <View style={styles.sessionNudgeHeader}>
            <Text style={styles.sessionNudgeTitle}>{'🤖 Struggling with '}{tutorNudge.topic}</Text>
            <TouchableOpacity
              onPress={() => setNudgeDismissed(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.sessionNudgeDismiss}>{'x'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sessionNudgeBody}>
            {'Our AI tutor can help you understand these questions better.'}
          </Text>
          <View style={styles.sessionNudgeBtns}>
            <TouchableOpacity
              style={styles.sessionNudgeAskBtn}
              onPress={() => router.push({
                pathname: '/(tabs)/tutor',
                params: { topic: tutorNudge.topicKey },
              })}
              activeOpacity={0.85}
            >
              <Text style={styles.sessionNudgeAskText}>{'Ask Tutor'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sessionNudgeLaterBtn}
              onPress={() => setNudgeDismissed(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.sessionNudgeLaterText}>{'Maybe Later'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>Question Breakdown</Text>
      <View style={styles.breakdownList}>
        {results.map(({ question, correct: isCorrect }, i) => (
          <View
            key={question.id}
            style={[
              styles.breakdownRow,
              isCorrect ? styles.breakdownRowCorrect : styles.breakdownRowWrong,
            ]}
          >
            <View style={[styles.breakdownDot, isCorrect ? styles.dotGreen : styles.dotRed]}>
              <Text style={styles.dotText}>{isCorrect ? '+' : 'x'}</Text>
            </View>
            <Text style={styles.breakdownText} numberOfLines={2}>
              {i + 1}.{'  '}{question.questionText}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.shareLink} onPress={() => setShowShareCard(true)} activeOpacity={0.75}>
        <Text style={styles.shareLinkText}>{'Share Result'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.primaryButton} onPress={onPlayAgain} activeOpacity={0.85}>
        <Text style={styles.primaryButtonText}>Play Again</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.outlineButton}
        onPress={() => router.replace('/(tabs)/home')}
        activeOpacity={0.85}
      >
        <Text style={styles.outlineButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>

    {showShareCard && (
      <ShareCardModal
        visible={showShareCard}
        onClose={() => setShowShareCard(false)}
        data={{ type: 'practice', correct, total, topic: dominantTopic, streakDays }}
      />
    )}
  </>
  );
}

function BattleView({
  question,
  questionIndex,
  totalQuestions,
  selected,
  combo,
  score,
  weakTopics,
  onAnswer,
  onExit,
}: {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  selected: number | null;
  combo: number;
  score: number;
  weakTopics: TopicCategory[];
  onAnswer: (idx: number) => void;
  onExit: () => void;
}) {
  const multiplier = Math.min(Math.max(combo, 1), 5);
  const comboColor =
    combo >= 5 ? Colors.red : combo >= 3 ? Colors.amber : combo >= 2 ? Colors.indigo : Colors.subtleText;
  const theme = useTheme();

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <View style={styles.battleHeader}>
        <TouchableOpacity style={styles.battleExitButton} onPress={onExit} activeOpacity={0.85}>
          <Text style={styles.battleExitText}>Exit</Text>
        </TouchableOpacity>
        <View style={styles.battleHeaderLeft}>
          <Text style={styles.battleLabel}>{'BATTLE MODE'}</Text>
          <Text style={styles.battleProgress}>
            {'Q '}{questionIndex + 1}{' / '}{totalQuestions}
          </Text>
        </View>
        <View style={styles.battleHeaderRight}>
          <View style={[styles.comboBadge, { borderColor: comboColor }]}>
            <Text style={[styles.comboValue, { color: comboColor }]}>
              {'x'}{multiplier}
            </Text>
            <Text style={styles.comboLabel}>COMBO</Text>
          </View>
          <View style={styles.battleScoreBadge}>
            <Text style={styles.battleScoreValue}>{score}</Text>
            <Text style={styles.battleScoreLabel}>SCORE</Text>
          </View>
        </View>
      </View>

      <View style={styles.battleTopicsRow}>
        {weakTopics.map((t) => (
          <Text key={t} style={styles.battleTopicChip}>
            {TOPIC_EMOJI[t]}
          </Text>
        ))}
      </View>

      <View style={styles.questionCard}>
        <Text style={[styles.questionText, { fontSize: theme.fontSize(17), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(26), color: theme.textColor }]}>{question.questionText}</Text>
      </View>

      <View style={styles.optionList}>
        {question.options.map((option, idx) => {
          const isCorrect = idx === question.correctIndex;
          const isSelected = idx === selected;
          const isAnswered = selected !== null;

          let cardStyle = styles.optionDefault;
          let badgeStyle = styles.badgeDefault;
          let textStyle = styles.optionTextDefault;
          let badgeTextStyle = styles.badgeTextDefault;

          if (isAnswered) {
            if (isCorrect) {
              cardStyle = styles.optionCorrect;
              badgeStyle = styles.badgeCorrect;
              textStyle = styles.optionTextCorrect;
              badgeTextStyle = styles.badgeTextColored;
            } else if (isSelected) {
              cardStyle = styles.optionWrong;
              badgeStyle = styles.badgeWrong;
              textStyle = styles.optionTextWrong;
              badgeTextStyle = styles.badgeTextColored;
            } else {
              cardStyle = styles.optionDimmed;
              textStyle = styles.optionTextDimmed;
            }
          }

          return (
            <TouchableOpacity
              key={idx}
              style={[styles.option, cardStyle, theme.highContrast ? { borderWidth: 2, borderColor: isAnswered ? undefined : theme.borderColor } : undefined]}
              onPress={() => onAnswer(idx)}
              activeOpacity={isAnswered ? 1 : 0.75}
              disabled={isAnswered}
            >
              <View style={[styles.badge, badgeStyle]}>
                <Text style={[styles.badgeText, badgeTextStyle]}>{LABELS[idx]}</Text>
              </View>
              <Text style={[styles.optionText, textStyle, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing }]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selected !== null && (
        <View style={styles.battleAutoAdvance}>
          <Text style={styles.battleAutoAdvanceText}>Next question in 1s...</Text>
        </View>
      )}
    </ScrollView>
  );
}

function BattleResultsScreen({
  score,
  maxCombo,
  totalQuestions,
  xpEarned,
  newAchievements,
  onPlayAgain,
  onBackToPractice,
}: {
  score: number;
  maxCombo: number;
  totalQuestions: number;
  xpEarned: number;
  newAchievements: Achievement[];
  onPlayAgain: () => void;
  onBackToPractice: () => void;
}) {
  const excellent = score >= 12;
  const good = score >= 8;
  const bannerColor = excellent ? Colors.emerald : good ? Colors.amber : Colors.red;
  const label = excellent ? 'EXCELLENT!' : good ? 'GOOD FIGHT!' : 'KEEP TRAINING!';
  const theme = useTheme();

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
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

      <View style={[styles.scoreBanner, { borderColor: bannerColor }]}>
        <Text style={styles.resultEmoji}>{'⚔'}</Text>
        <Text style={[styles.resultLabel, { color: bannerColor }]}>{label}</Text>
        <Text style={styles.battleResultScore}>{score}</Text>
        <Text style={styles.scorePct}>{'/ ' + totalQuestions + ' max'}</Text>
        {xpEarned > 0 && (
          <Text style={styles.xpNotif}>{'+'}{xpEarned}{' XP earned!'}</Text>
        )}
      </View>

      <View style={styles.battleStatRow}>
        <View style={styles.battleStat}>
          <Text style={styles.battleStatValue}>{maxCombo}{'x'}</Text>
          <Text style={styles.battleStatLabel}>Max Combo</Text>
        </View>
        <View style={styles.battleStat}>
          <Text style={styles.battleStatValue}>{score}</Text>
          <Text style={styles.battleStatLabel}>Score</Text>
        </View>
        <View style={styles.battleStat}>
          <Text style={[styles.battleStatValue, { color: xpEarned > 0 ? Colors.indigo : Colors.subtleText }]}>
            {xpEarned > 0 ? '+' + xpEarned : '0'}
          </Text>
          <Text style={styles.battleStatLabel}>XP</Text>
        </View>
      </View>

      {score < 10 && (
        <View style={styles.battleHint}>
          <Text style={styles.battleHintText}>
            Score 10+ to earn {XP_REWARDS.BATTLE_MODE_WIN} XP next time!
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={onPlayAgain} activeOpacity={0.85}>
        <Text style={styles.primaryButtonText}>Play Again</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.outlineButton} onPress={onBackToPractice} activeOpacity={0.85}>
        <Text style={styles.outlineButtonText}>Back to Practice</Text>
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

function WeakSpotView({
  question,
  selected,
  consecutive,
  clearedCount,
  totalCount,
  showCleared,
  onAnswer,
  onExit,
}: {
  question: Question;
  selected: number | null;
  consecutive: number;
  clearedCount: number;
  totalCount: number;
  showCleared: boolean;
  onAnswer: (idx: number) => void;
  onExit: () => void;
}) {
  const theme = useTheme();
  const clearPct = totalCount > 0 ? (clearedCount / totalCount) * 100 : 0;
  const isAnswered = selected !== null;

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <View style={styles.weakHeader}>
        <TouchableOpacity style={styles.battleExitButton} onPress={onExit} activeOpacity={0.85}>
          <Text style={styles.battleExitText}>Finish</Text>
        </TouchableOpacity>
        <View style={styles.weakHeaderCenter}>
          <Text style={styles.weakModeLabel}>{'WEAK SPOTS'}</Text>
          <Text style={[styles.weakProgress, { color: theme.subTextColor }]}>
            {clearedCount}{' / '}{totalCount}{' cleared'}
          </Text>
        </View>
        <View style={[styles.weakConsecBadge, consecutive > 0 ? { borderColor: Colors.emerald } : { borderColor: Colors.border }]}>
          <Text style={[styles.weakConsecValue, { color: consecutive > 0 ? Colors.emerald : Colors.subtleText }]}>
            {consecutive}{'/3'}
          </Text>
          <Text style={[styles.weakConsecLabel, { color: theme.subTextColor }]}>streak</Text>
        </View>
      </View>

      <View style={styles.weakBarTrack}>
        <View style={[styles.weakBarFill, { width: `${clearPct}%` as any }]} />
      </View>

      <View style={[styles.questionCard, { backgroundColor: theme.cardColor }]}>
        <Text style={[styles.questionText, { fontSize: theme.fontSize(17), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(26), color: theme.textColor }]}>
          {question.questionText}
        </Text>
      </View>

      {showCleared && (
        <View style={styles.weakClearedBanner}>
          <Text style={styles.weakClearedText}>{'[v] Cleared!'}</Text>
        </View>
      )}

      {!showCleared && (
        <View style={styles.optionList}>
          {question.options.map((option, idx) => {
            const isCorrect = idx === question.correctIndex;
            const isSelected = idx === selected;
            let cardStyle = styles.optionDefault;
            let badgeStyle = styles.badgeDefault;
            let textStyle = styles.optionTextDefault;
            let badgeTextStyle = styles.badgeTextDefault;
            if (isAnswered) {
              if (isCorrect) { cardStyle = styles.optionCorrect; badgeStyle = styles.badgeCorrect; textStyle = styles.optionTextCorrect; badgeTextStyle = styles.badgeTextColored; }
              else if (isSelected) { cardStyle = styles.optionWrong; badgeStyle = styles.badgeWrong; textStyle = styles.optionTextWrong; badgeTextStyle = styles.badgeTextColored; }
              else { cardStyle = styles.optionDimmed; textStyle = styles.optionTextDimmed; }
            }
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.option, cardStyle]}
                onPress={() => onAnswer(idx)}
                activeOpacity={isAnswered ? 1 : 0.75}
                disabled={isAnswered}
              >
                <View style={[styles.badge, badgeStyle]}>
                  <Text style={[styles.badgeText, badgeTextStyle]}>{LABELS[idx]}</Text>
                </View>
                <Text style={[styles.optionText, textStyle, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing }]}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {isAnswered && !showCleared && (
        <View style={[styles.explanation, selected === question.correctIndex ? styles.explanationGreen : styles.explanationRed]}>
          <Text style={[styles.explanationTitle, selected === question.correctIndex ? styles.explanationTitleGreen : styles.explanationTitleRed]}>
            {selected === question.correctIndex ? `Correct! (${consecutive}/3 in a row)` : 'Incorrect - keep going!'}
          </Text>
          <Text style={[styles.explanationBody, selected === question.correctIndex ? styles.explanationBodyGreen : styles.explanationBodyRed]}>
            {question.explanation}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function WeakSpotResultsView({
  clearedQuestions,
  totalQuestions,
  xpGained,
  onPlayAgain,
  onBack,
}: {
  clearedQuestions: Question[];
  totalQuestions: number;
  xpGained: number;
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  const theme = useTheme();
  const cleared = clearedQuestions.length;
  const allCleared = cleared === totalQuestions;
  const bannerColor = allCleared ? Colors.emerald : cleared > 0 ? Colors.indigo : Colors.amber;
  const topicSet = new Set(clearedQuestions.map(q => TOPIC_LABELS[q.topicCategory]));

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <View style={[styles.scoreBanner, { borderColor: bannerColor }]}>
        <Text style={[styles.weakResultBadgeLabel, { color: bannerColor }]}>{'WEAK SPOTS DRILL'}</Text>
        <Text style={[styles.resultLabel, { color: bannerColor }]}>
          {allCleared ? 'ALL CLEARED!' : cleared > 0 ? 'GOOD PROGRESS!' : 'KEEP DRILLING!'}
        </Text>
        <Text style={styles.scoreValue}>{cleared}{' / '}{totalQuestions}</Text>
        <Text style={styles.scorePct}>{'weak spots cleared'}</Text>
        {xpGained > 0 && (
          <Text style={styles.xpNotif}>{'+'}{xpGained}{' XP earned!'}</Text>
        )}
      </View>

      {topicSet.size > 0 && (
        <>
          <Text style={styles.sectionLabel}>Topics Cleared</Text>
          <View style={styles.weakTopicList}>
            {Array.from(topicSet).map(topic => (
              <View key={topic} style={styles.weakTopicChip}>
                <Text style={styles.weakTopicChipText}>{topic}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={onPlayAgain} activeOpacity={0.85}>
        <Text style={styles.primaryButtonText}>Drill Again</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.outlineButton} onPress={onBack} activeOpacity={0.85}>
        <Text style={styles.outlineButtonText}>Back to Practice</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SpeedRoundView({
  question,
  questionIndex,
  totalQuestions,
  selected,
  timeLeft,
  onAnswer,
  onExit,
}: {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  selected: number | null;
  timeLeft: number;
  onAnswer: (idx: number) => void;
  onExit: () => void;
}) {
  const theme = useTheme();
  const isLow = timeLeft < 20;
  const timerColor = isLow ? Colors.red : Colors.indigo;

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <View style={styles.speedHeader}>
        <TouchableOpacity style={styles.battleExitButton} onPress={onExit} activeOpacity={0.85}>
          <Text style={styles.battleExitText}>Exit</Text>
        </TouchableOpacity>
        <View style={[styles.speedTimerBox, { borderColor: timerColor }]}>
          <Text style={[styles.speedTimerValue, { color: timerColor }]}>{timeLeft}</Text>
          <Text style={[styles.speedTimerLabel, { color: timerColor }]}>{'sec'}</Text>
        </View>
        <View style={styles.speedProgressBox}>
          <Text style={styles.speedProgressText}>
            {'Q '}{questionIndex + 1}{' / '}{totalQuestions}
          </Text>
          <Text style={styles.speedModeLabel}>{'SPEED ROUND'}</Text>
        </View>
      </View>

      <View style={[styles.speedTimerBar, { backgroundColor: Colors.surfaceGray }]}>
        <View style={[styles.speedTimerFill, { width: `${(timeLeft / 90) * 100}%` as any, backgroundColor: timerColor }]} />
      </View>

      <View style={styles.questionCard}>
        <Text style={[styles.questionText, { fontSize: theme.fontSize(17), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(26), color: theme.textColor }]}>
          {question.questionText}
        </Text>
      </View>

      <View style={styles.optionList}>
        {question.options.map((option, idx) => {
          const isCorrect = idx === question.correctIndex;
          const isSelected = idx === selected;
          const isAnswered = selected !== null;

          let cardStyle = styles.optionDefault;
          let badgeStyle = styles.badgeDefault;
          let textStyle = styles.optionTextDefault;
          let badgeTextStyle = styles.badgeTextDefault;

          if (isAnswered) {
            if (isCorrect) {
              cardStyle = styles.optionCorrect;
              badgeStyle = styles.badgeCorrect;
              textStyle = styles.optionTextCorrect;
              badgeTextStyle = styles.badgeTextColored;
            } else if (isSelected) {
              cardStyle = styles.optionWrong;
              badgeStyle = styles.badgeWrong;
              textStyle = styles.optionTextWrong;
              badgeTextStyle = styles.badgeTextColored;
            } else {
              cardStyle = styles.optionDimmed;
              textStyle = styles.optionTextDimmed;
            }
          }

          return (
            <TouchableOpacity
              key={idx}
              style={[styles.option, cardStyle]}
              onPress={() => onAnswer(idx)}
              activeOpacity={isAnswered ? 1 : 0.75}
              disabled={isAnswered}
            >
              <View style={[styles.badge, badgeStyle]}>
                <Text style={[styles.badgeText, badgeTextStyle]}>{LABELS[idx]}</Text>
              </View>
              <Text style={[styles.optionText, textStyle, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing }]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selected !== null && (
        <View style={styles.battleAutoAdvance}>
          <Text style={styles.battleAutoAdvanceText}>Next question...</Text>
        </View>
      )}
    </ScrollView>
  );
}

function SpeedRoundResultsView({
  results,
  timeUsed,
  xpGained,
  onPlayAgain,
  onBack,
}: {
  results: SessionResult[];
  timeUsed: number;
  xpGained: number;
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  const theme = useTheme();
  const correct = results.filter(r => r.correct).length;
  const total = results.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const cfg = resultConfig(pct);
  const allCompleted = total === 10;
  const speedBonus = allCompleted && timeUsed < 60;

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <View style={[styles.scoreBanner, { borderColor: cfg.borderColor }]}>
        <Text style={[styles.speedRoundBadgeLabel, { color: Colors.red }]}>{'SPEED ROUND'}</Text>
        <Text style={[styles.resultLabel, { color: cfg.accentColor }]}>{cfg.label}</Text>
        <Text style={styles.scoreValue}>{correct}{' / '}{total}</Text>
        <Text style={styles.scorePct}>{pct}{'%'}</Text>
        <View style={styles.speedStatsRow}>
          <View style={styles.speedStat}>
            <Text style={[styles.speedStatValue, { color: theme.textColor }]}>{timeUsed}{'s'}</Text>
            <Text style={[styles.speedStatLabel, { color: theme.subTextColor }]}>Time used</Text>
          </View>
          <View style={styles.speedStat}>
            <Text style={[styles.speedStatValue, { color: theme.textColor }]}>{total}{' / 10'}</Text>
            <Text style={[styles.speedStatLabel, { color: theme.subTextColor }]}>Answered</Text>
          </View>
        </View>
        {speedBonus && (
          <View style={styles.speedBonusTag}>
            <Text style={styles.speedBonusText}>{'[*] Speed Bonus! +10 XP'}</Text>
          </View>
        )}
        {xpGained > 0 && (
          <Text style={styles.xpNotif}>{'+'}{xpGained}{' XP earned!'}</Text>
        )}
      </View>

      <Text style={styles.sectionLabel}>Question Breakdown</Text>
      <View style={styles.breakdownList}>
        {results.map(({ question, correct: isCorrect }, i) => (
          <View
            key={question.id}
            style={[styles.breakdownRow, isCorrect ? styles.breakdownRowCorrect : styles.breakdownRowWrong]}
          >
            <View style={[styles.breakdownDot, isCorrect ? styles.dotGreen : styles.dotRed]}>
              <Text style={styles.dotText}>{isCorrect ? '+' : 'x'}</Text>
            </View>
            <Text style={styles.breakdownText} numberOfLines={2}>
              {i + 1}.{'  '}{question.questionText}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={onPlayAgain} activeOpacity={0.85}>
        <Text style={styles.primaryButtonText}>Play Again</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.outlineButton} onPress={onBack} activeOpacity={0.85}>
        <Text style={styles.outlineButtonText}>Back to Practice</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function DailyLimitView({ onUpgrade, onBack }: { onUpgrade: () => void; onBack: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.centered, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.limitCard}>
        <Text style={styles.limitTitle}>Daily limit reached</Text>
        <Text style={styles.limitBody}>
          {'You have used your 10 free questions today.'}
        </Text>
        <TouchableOpacity style={styles.limitUpgradeBtn} onPress={onUpgrade} activeOpacity={0.85}>
          <Text style={styles.limitUpgradeBtnText}>Upgrade to Pro - £4.99</Text>
        </TouchableOpacity>
        <Text style={styles.limitNote}>Come back tomorrow for more free questions</Text>
        <TouchableOpacity style={styles.limitBackBtn} onPress={onBack} activeOpacity={0.75}>
          <Text style={styles.limitBackText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: Colors.mutedText, fontSize: 15 },

  // Start screen
  startContent: { padding: 24, paddingTop: 24, paddingBottom: 48 },
  startTitle: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  startSub: { fontSize: 15, color: Colors.mutedText, marginBottom: 32, lineHeight: 22 },
  startOr: {
    textAlign: 'center',
    color: Colors.mutedText,
    fontSize: 13,
    fontWeight: '600',
    marginVertical: 16,
  },
  battleButton: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.red,
  },
  battleButtonTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.red,
    marginBottom: 4,
  },
  battleButtonSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.mutedText,
    marginBottom: 6,
  },
  battleButtonSub: { fontSize: 12, color: Colors.mutedText, lineHeight: 18 },

  // Progress bar
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, color: Colors.mutedText, fontWeight: '500' },
  progressPct: { fontSize: 13, color: Colors.indigo, fontWeight: '700' },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.surfaceGray,
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: Colors.indigo, borderRadius: 3 },

  // Question card
  questionCard: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.indigo,
  },
  topicBadge: {
    alignSelf: 'flex-end',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
    backgroundColor: Colors.surfaceGray,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  topicBadgeEmoji: { fontSize: 16 },
  questionText: { fontSize: 17, fontWeight: '600', lineHeight: 26 },

  // Options
  optionList: { gap: 10, marginBottom: 14 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  optionDefault: { backgroundColor: Colors.cardWhite, borderColor: Colors.border },
  optionCorrect: { backgroundColor: Colors.emeraldBg, borderColor: Colors.emerald, borderWidth: 2 },
  optionWrong:   { backgroundColor: Colors.redBg, borderColor: Colors.red, borderWidth: 2 },
  optionDimmed:  { backgroundColor: Colors.cardWhite, borderColor: Colors.border },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeDefault: { backgroundColor: Colors.surfaceGray },
  badgeCorrect: { backgroundColor: Colors.emerald },
  badgeWrong:   { backgroundColor: Colors.red },
  badgeText: { fontSize: 13, fontWeight: '800' },
  badgeTextDefault: { color: Colors.mutedText },
  badgeTextColored: { color: Colors.cardWhite },
  optionText: { flex: 1, fontSize: 15, lineHeight: 22 },
  optionTextDefault: { color: Colors.textPrimary },
  optionTextCorrect: { color: Colors.emerald, fontWeight: '600' },
  optionTextWrong:   { color: Colors.red, fontWeight: '600' },
  optionTextDimmed:  { color: Colors.subtleText },

  // Explanation
  explanation: { borderRadius: 12, padding: 16, marginBottom: 14, borderLeftWidth: 3 },
  explanationGreen: { backgroundColor: Colors.emeraldBg, borderLeftColor: Colors.emerald },
  explanationRed:   { backgroundColor: Colors.redBg, borderLeftColor: Colors.red },
  explanationTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  explanationTitleGreen: { color: Colors.emerald },
  explanationTitleRed:   { color: Colors.red },
  explanationBody: { fontSize: 14, lineHeight: 21 },
  explanationBodyGreen: { color: '#065F46' },
  explanationBodyRed:   { color: '#991B1B' },

  // Buttons
  primaryButton: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  primaryButtonText: { color: Colors.cardWhite, fontSize: 16, fontWeight: '700' },
  outlineButton: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  outlineButtonText: { color: Colors.indigo, fontSize: 16, fontWeight: '600' },

  // Results screen
  scoreBanner: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  resultEmoji: { fontSize: 56, marginBottom: 8 },
  resultLabel: { fontSize: 22, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  scoreValue: { fontSize: 72, fontWeight: '900', color: Colors.textPrimary, lineHeight: 80 },
  scorePct: { fontSize: 20, color: Colors.mutedText, fontWeight: '600', marginTop: 4 },
  xpNotif: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.indigo,
    marginTop: 10,
  },
  motivationalMsg: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
    marginBottom: 20,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.mutedText,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  breakdownList: { gap: 8, marginBottom: 24 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderLeftWidth: 3,
  },
  breakdownRowCorrect: { backgroundColor: Colors.emeraldBg, borderLeftColor: Colors.emerald },
  breakdownRowWrong:   { backgroundColor: Colors.redBg, borderLeftColor: Colors.red },
  breakdownDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  dotGreen: { backgroundColor: Colors.emerald },
  dotRed:   { backgroundColor: Colors.red },
  dotText: { color: Colors.cardWhite, fontSize: 12, fontWeight: '800' },
  breakdownText: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 20 },

  tutorButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.indigo,
    backgroundColor: Colors.cardWhite,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  tutorButtonText: { color: Colors.indigo, fontSize: 15, fontWeight: '700' },

  // AI tutor
  explainButton: {
    backgroundColor: Colors.emeraldBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.indigo,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  explainButtonText: { color: Colors.indigo, fontSize: 14, fontWeight: '700' },
  aiLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  aiLoadingText: { color: Colors.mutedText, fontSize: 14 },
  aiCard: {
    backgroundColor: Colors.surfaceGray,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.indigo,
  },
  aiCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.indigo,
    letterSpacing: 1,
    marginBottom: 6,
  },
  aiCardBody: { fontSize: 14, color: Colors.textDark, lineHeight: 22 },

  // Achievement banner
  achievementBanner: {
    backgroundColor: Colors.indigoBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.indigo,
    borderLeftWidth: 4,
    borderLeftColor: Colors.indigo,
  },
  achievementBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.indigo,
    letterSpacing: 1,
    marginBottom: 6,
  },
  achievementBannerItem: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },

  // Battle header
  battleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  battleHeaderLeft: { gap: 2 },
  battleHeaderRight: { flexDirection: 'row', gap: 10 },
  battleLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.red,
    letterSpacing: 1,
  },
  battleProgress: { fontSize: 13, fontWeight: '600', color: Colors.mutedText },
  comboBadge: {
    backgroundColor: Colors.surfaceGray,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 54,
  },
  comboValue: { fontSize: 18, fontWeight: '900', lineHeight: 22 },
  comboLabel: { fontSize: 9, fontWeight: '700', color: Colors.mutedText, letterSpacing: 0.5 },
  battleScoreBadge: {
    backgroundColor: Colors.surfaceGray,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 54,
  },
  battleScoreValue: { fontSize: 18, fontWeight: '900', color: Colors.textPrimary, lineHeight: 22 },
  battleScoreLabel: { fontSize: 9, fontWeight: '700', color: Colors.mutedText, letterSpacing: 0.5 },
  battleTopicsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  battleTopicChip: {
    fontSize: 20,
    backgroundColor: Colors.surfaceGray,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  battleAutoAdvance: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  battleAutoAdvanceText: { fontSize: 13, color: Colors.mutedText, fontStyle: 'italic' },

  // Battle results
  battleResultScore: { fontSize: 72, fontWeight: '900', color: Colors.textPrimary, lineHeight: 80 },
  battleStatRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  battleStat: {
    flex: 1,
    backgroundColor: Colors.cardWhite,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  battleStatValue: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  battleStatLabel: { fontSize: 11, color: Colors.mutedText, fontWeight: '500' },
  battleHint: {
    backgroundColor: Colors.amberBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.amber,
  },
  battleHintText: { fontSize: 13, color: Colors.amber, fontWeight: '600' },
  battleExitButton: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  battleExitText: { fontSize: 12, fontWeight: '600', color: Colors.mutedText },

  speakerBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.surfaceGray,
    borderRadius: 6,
    marginBottom: 8,
  },
  speakerBtnText: { fontSize: 11, fontWeight: '700' as const, color: Colors.indigo },
  bookmarkBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  bookmarkBtnText: { fontSize: 20 },

  // Daily limit gate
  limitCard: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 20,
    padding: 28,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 3,
    borderTopColor: Colors.amber,
    alignItems: 'center',
    gap: 12,
    maxWidth: 400,
    width: '100%',
  },
  limitTitle: { fontSize: 22, fontWeight: '800', color: Colors.amber, textAlign: 'center' },
  limitBody: { fontSize: 15, color: Colors.mutedText, textAlign: 'center', lineHeight: 22 },
  limitUpgradeBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 4,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  limitUpgradeBtnText: { color: Colors.cardWhite, fontSize: 15, fontWeight: '700' },
  limitNote: { fontSize: 13, color: Colors.mutedText, textAlign: 'center' },
  limitBackBtn: { paddingVertical: 8 },
  limitBackText: { color: Colors.mutedText, fontSize: 14, fontWeight: '600' },

  // Weak Spot Drill
  weakSpotButton: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.amber,
  },
  weakSpotButtonDisabled: { borderColor: Colors.border, opacity: 0.7 },
  weakSpotButtonTitle:    { fontSize: 18, fontWeight: '800', color: Colors.amber, marginBottom: 4 },
  weakSpotButtonSubtitle: { fontSize: 13, fontWeight: '600', color: Colors.mutedText, marginBottom: 6 },
  weakSpotButtonSub:      { fontSize: 12, color: Colors.mutedText, lineHeight: 18 },
  weakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  weakHeaderCenter: { alignItems: 'center', gap: 2 },
  weakModeLabel: { fontSize: 11, fontWeight: '800', color: Colors.amber, letterSpacing: 1 },
  weakProgress:  { fontSize: 13, fontWeight: '600' },
  weakConsecBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 54,
  },
  weakConsecValue: { fontSize: 18, fontWeight: '900', lineHeight: 22 },
  weakConsecLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  weakBarTrack: {
    height: 6,
    backgroundColor: Colors.surfaceGray,
    borderRadius: 3,
    marginBottom: 14,
    overflow: 'hidden',
  },
  weakBarFill: { height: 6, backgroundColor: Colors.emerald, borderRadius: 3 },
  weakClearedBanner: {
    backgroundColor: Colors.emeraldBg,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.emerald,
    marginBottom: 14,
  },
  weakClearedText: { fontSize: 22, fontWeight: '900', color: Colors.emerald },
  weakResultBadgeLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  weakTopicList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  weakTopicChip: {
    backgroundColor: Colors.emeraldBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: Colors.emerald,
  },
  weakTopicChipText: { fontSize: 13, fontWeight: '600', color: Colors.emerald },

  // Comparative stats
  comparativeCard: {
    backgroundColor: Colors.indigoBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: Colors.indigo,
  },
  comparativeText: { fontSize: 14, color: Colors.textDark, lineHeight: 20 },
  comparativePct:  { fontWeight: '800', color: Colors.indigo },
  comparativeAvg:  { fontSize: 12, color: Colors.mutedText, marginTop: 4 },

  // Speed Round
  speedButton: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.red,
  },
  speedButtonTitle: { fontSize: 18, fontWeight: '800', color: Colors.red, marginBottom: 4 },
  speedButtonSubtitle: { fontSize: 13, fontWeight: '600', color: Colors.mutedText, marginBottom: 6 },
  speedButtonSub: { fontSize: 12, color: Colors.mutedText, lineHeight: 18 },
  speedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  speedTimerBox: {
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  speedTimerValue: { fontSize: 32, fontWeight: '900', lineHeight: 36 },
  speedTimerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  speedProgressBox: { alignItems: 'flex-end', gap: 2 },
  speedProgressText: { fontSize: 13, fontWeight: '600', color: Colors.mutedText },
  speedModeLabel: { fontSize: 10, fontWeight: '800', color: Colors.red, letterSpacing: 1 },
  speedTimerBar: { height: 6, borderRadius: 3, marginBottom: 14, overflow: 'hidden' },
  speedTimerFill: { height: 6, borderRadius: 3 },
  speedRoundBadgeLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  speedStatsRow: { flexDirection: 'row', gap: 24, marginTop: 8, marginBottom: 4 },
  speedStat: { alignItems: 'center', gap: 2 },
  speedStatValue: { fontSize: 20, fontWeight: '800' },
  speedStatLabel: { fontSize: 11, fontWeight: '500' },
  speedBonusTag: {
    backgroundColor: Colors.amberBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.amber,
  },
  speedBonusText: { fontSize: 13, fontWeight: '700', color: '#D97706' },

  ruleLink: { color: Colors.indigo, fontWeight: '700', textDecorationLine: 'underline' },

  shareLink: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  shareLinkText: { fontSize: 14, color: Colors.indigo, fontWeight: '600', textDecorationLine: 'underline' },

  // Session tutor nudge card
  sessionNudgeCard: {
    backgroundColor: Colors.amberBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.amber,
    borderLeftWidth: 3,
    borderLeftColor: Colors.amber,
    padding: 14,
    marginBottom: 16,
  },
  sessionNudgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sessionNudgeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
    marginRight: 8,
  },
  sessionNudgeDismiss: { fontSize: 15, color: Colors.mutedText, fontWeight: '600' },
  sessionNudgeBody: { fontSize: 13, color: '#78350F', lineHeight: 18, marginBottom: 10 },
  sessionNudgeBtns: { flexDirection: 'row', gap: 8 },
  sessionNudgeAskBtn: {
    flex: 1,
    backgroundColor: Colors.amber,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sessionNudgeAskText: { color: Colors.cardWhite, fontSize: 13, fontWeight: '700' },
  sessionNudgeLaterBtn: {
    flex: 1,
    backgroundColor: Colors.cardWhite,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sessionNudgeLaterText: { color: Colors.mutedText, fontSize: 13, fontWeight: '600' },

  // Spaced repetition rating
  srRow: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 10,
  },
  srRowLabel: { fontSize: 12, color: Colors.mutedText, fontWeight: '500', marginBottom: 8 },
  srBtns:     { flexDirection: 'row', gap: 8 },
  easyBtn: {
    flex: 1,
    backgroundColor: Colors.emeraldBg,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  easyBtnText: { fontSize: 14, fontWeight: '700', color: '#065F46' },
  hardBtn: {
    flex: 1,
    backgroundColor: Colors.amberBg,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  hardBtnText: { fontSize: 14, fontWeight: '700', color: '#92400E' },
});
