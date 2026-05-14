import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
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
  getQuestionsForSession,
  initQuestionState,
  updateQuestionState,
} from '@clearpass/core';
import { allQuestions, getQuestionById } from '@clearpass/content';
import {
  createFreshUserProgress,
  loadQuestionStates,
  loadUserProgress,
  saveQuestionStates,
  saveUserProgress,
  syncProgressToCloud,
  updateStudyStreak,
} from '@/src/storage';
import {
  FREE_QUESTION_LIMIT,
  incrementFreeQuestionsAnswered,
  isPremium,
} from '@/src/subscription';
import { explainAnswer } from '@clearpass/ai';
import * as Speech from 'expo-speech';
import { useAccessibility } from '@/src/AccessibilityContext';
import { useTheme } from '@/src/theme';

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

type Phase = 'start' | 'loading' | 'quiz' | 'results' | 'battle' | 'battleResults' | 'dailyLimit';

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
  const [phase, setPhase] = useState<Phase>('start');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

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

  const { settings } = useAccessibility();
  const theme = useTheme();

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

  useEffect(() => {
    if (phase !== 'quiz' || !settings.textToSpeech || questions.length === 0) return;
    const q = questions[currentIndex];
    if (!q) return;
    const opts = q.options.map((opt, i) => `Option ${LABELS[i]}: ${opt}`).join('. ');
    Speech.stop();
    Speech.speak(`${q.questionText}. ${opts}`, { language: 'en-GB' });
    return () => { Speech.stop(); };
  }, [phase, currentIndex, questions, settings.textToSpeech]);

  async function handleProUpgrade() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth'); return; }
    try {
      const proxyUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? 'https://clearpass-app-production.up.railway.app'
        : 'http://localhost:3001';
      const res = await fetch(`${proxyUrl}/api/create-checkout-session`, {
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
    const [statesMap, loaded] = await Promise.all([
      loadQuestionStates(),
      loadUserProgress(),
    ]);

    questionStatesRef.current = statesMap;
    const today = new Date().toISOString().split('T')[0];
    const base = loaded ?? createFreshUserProgress();
    const isNewDay = base.lastStudied.split('T')[0] !== today;
    const progress = isNewDay ? { ...base, dailyQuestionsAnswered: 0 } : base;
    userProgressRef.current = progress;

    if (!(progress.isPro ?? false) && (progress.dailyQuestionsAnswered ?? 0) >= 10) {
      setPhase('dailyLimit');
      return;
    }

    const sessionIds = getQuestionsForSession(
      Object.values(statesMap),
      allQuestions.map((q) => q.id),
      SESSION_SIZE,
    );

    const sessionQuestions = sessionIds
      .map((id) => getQuestionById(id))
      .filter((q): q is Question => q !== undefined);

    resultsRef.current = [];
    setSessionResults([]);
    setCurrentIndex(0);
    setSelectedIndex(null);
    setAiExplanation(null);
    setAiLoading(false);
    setXpGained(0);
    setNewAchievements([]);
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

      setSelectedIndex(optionIndex);
      setSessionResults(resultsRef.current);

      await saveQuestionStates(questionStatesRef.current);
    },
    [selectedIndex, questions, currentIndex],
  );

  const handleNext = useCallback(async () => {
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
  }, [currentIndex, questions.length]);

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

    setXpGained(xpThisSession);
    setNewAchievements(unlocked);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'start') {
    return <StartView onStart={() => { setPhase('loading'); void startSession(); }} onBattle={() => void startBattle()} />;
  }

  if (phase === 'loading') {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color="#0D9488" />
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
      <ResultsScreen
        results={sessionResults}
        onPlayAgain={handlePlayAgain}
        xpGained={xpGained}
        newAchievements={newAchievements}
      />
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
        {settings.textToSpeech && (
          <TouchableOpacity
            style={styles.speakerBtn}
            onPress={() => { const opts = question.options.map((o, i) => `Option ${LABELS[i]}: ${o}`).join('. '); Speech.stop(); Speech.speak(`${question.questionText}. ${opts}`, { language: 'en-GB' }); }}
            activeOpacity={0.75}
          >
            <Text style={styles.speakerBtnText}>{'[ >> ]'}</Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.questionText, { fontSize: theme.fontSize(17), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(26), color: theme.textColor }]}>{question.questionText}</Text>
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
            <TouchableOpacity
              key={idx}
              style={[styles.option, cardStyle, settings.highContrast ? { borderWidth: 2, borderColor: isAnswered ? undefined : theme.borderColor } : undefined]}
              onPress={() => handleAnswer(idx)}
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

      {isAnswered && !answeredCorrectly && (
        <>
          {aiExplanation !== null ? (
            <View style={styles.aiCard}>
              <Text style={styles.aiCardTitle}>AI TUTOR</Text>
              <Text style={styles.aiCardBody}>{aiExplanation}</Text>
            </View>
          ) : aiLoading ? (
            <View style={styles.aiLoadingRow}>
              <ActivityIndicator size="small" color="#0D9488" />
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
}: {
  onStart: () => void;
  onBattle: () => void;
}) {
  const theme = useTheme();
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

      <TouchableOpacity style={styles.battleButton} onPress={onBattle} activeOpacity={0.85}>
        <Text style={styles.battleButtonTitle}>{'⚔'}{' Battle Mode'}</Text>
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
    return { borderColor: '#0D9488', accentColor: '#0D9488', label: 'PERFECT!', emoji: '🏆' };
  if (pct >= 80)
    return { borderColor: '#6366F1', accentColor: '#6366F1', label: 'GREAT JOB!', emoji: '⭐' };
  if (pct >= 60)
    return { borderColor: '#F59E0B', accentColor: '#F59E0B', label: 'NOT BAD!', emoji: '👍' };
  return { borderColor: '#EF4444', accentColor: '#EF4444', label: 'KEEP GOING!', emoji: '💪' };
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
}: {
  results: SessionResult[];
  onPlayAgain: () => void;
  xpGained: number;
  newAchievements: Achievement[];
}) {
  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const cfg = resultConfig(pct);
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

      <Text style={[styles.motivationalMsg, { color: cfg.accentColor }]}>
        {motivationalMessage(correct, total)}
      </Text>

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
    combo >= 5 ? '#EF4444' : combo >= 3 ? '#F59E0B' : combo >= 2 ? '#0D9488' : '#9CA3AF';
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
  const bannerColor = excellent ? '#0D9488' : good ? '#F59E0B' : '#EF4444';
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
          <Text style={[styles.battleStatValue, { color: xpEarned > 0 ? '#6366F1' : '#9CA3AF' }]}>
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
  loadingText: { color: '#6B7280', fontSize: 15 },

  // Start screen
  startContent: { padding: 24, paddingTop: 24, paddingBottom: 48 },
  startTitle: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  startSub: { fontSize: 15, color: '#6B7280', marginBottom: 32, lineHeight: 22 },
  startOr: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    marginVertical: 16,
  },
  battleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  battleButtonTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 4,
  },
  battleButtonSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  battleButtonSub: { fontSize: 12, color: '#6B7280', lineHeight: 18 },

  // Progress bar
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  progressPct: { fontSize: 13, color: '#6366F1', fontWeight: '700' },
  progressTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: '#0D9488', borderRadius: 3 },

  // Question card
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  topicBadge: {
    alignSelf: 'flex-end',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
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
  optionDefault: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  optionCorrect: { backgroundColor: '#F0FDFA', borderColor: '#0D9488', borderWidth: 2 },
  optionWrong:   { backgroundColor: '#FEF2F2', borderColor: '#EF4444', borderWidth: 2 },
  optionDimmed:  { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeDefault: { backgroundColor: '#F3F4F6' },
  badgeCorrect: { backgroundColor: '#0D9488' },
  badgeWrong:   { backgroundColor: '#EF4444' },
  badgeText: { fontSize: 13, fontWeight: '800' },
  badgeTextDefault: { color: '#6B7280' },
  badgeTextColored: { color: '#FFFFFF' },
  optionText: { flex: 1, fontSize: 15, lineHeight: 22 },
  optionTextDefault: { color: '#111827' },
  optionTextCorrect: { color: '#0D9488', fontWeight: '600' },
  optionTextWrong:   { color: '#EF4444', fontWeight: '600' },
  optionTextDimmed:  { color: '#9CA3AF' },

  // Explanation
  explanation: { borderRadius: 12, padding: 16, marginBottom: 14, borderLeftWidth: 3 },
  explanationGreen: { backgroundColor: '#F0FDFA', borderLeftColor: '#0D9488' },
  explanationRed:   { backgroundColor: '#FEF2F2', borderLeftColor: '#EF4444' },
  explanationTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  explanationTitleGreen: { color: '#0D9488' },
  explanationTitleRed:   { color: '#EF4444' },
  explanationBody: { fontSize: 14, lineHeight: 21 },
  explanationBodyGreen: { color: '#065F46' },
  explanationBodyRed:   { color: '#991B1B' },

  // Buttons
  primaryButton: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  outlineButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  outlineButtonText: { color: '#0D9488', fontSize: 16, fontWeight: '600' },

  // Results screen
  scoreBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  resultEmoji: { fontSize: 56, marginBottom: 8 },
  resultLabel: { fontSize: 22, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  scoreValue: { fontSize: 72, fontWeight: '900', color: '#111827', lineHeight: 80 },
  scorePct: { fontSize: 20, color: '#6B7280', fontWeight: '600', marginTop: 4 },
  xpNotif: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D9488',
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
    color: '#6B7280',
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
  breakdownRowCorrect: { backgroundColor: '#F0FDFA', borderLeftColor: '#0D9488' },
  breakdownRowWrong:   { backgroundColor: '#FEF2F2', borderLeftColor: '#EF4444' },
  breakdownDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  dotGreen: { backgroundColor: '#0D9488' },
  dotRed:   { backgroundColor: '#EF4444' },
  dotText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  breakdownText: { flex: 1, fontSize: 13, color: '#111827', lineHeight: 20 },

  tutorButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#0D9488',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  tutorButtonText: { color: '#0D9488', fontSize: 15, fontWeight: '700' },

  // AI tutor
  explainButton: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0D9488',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  explainButtonText: { color: '#0D9488', fontSize: 14, fontWeight: '700' },
  aiLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  aiLoadingText: { color: '#6B7280', fontSize: 14 },
  aiCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  aiCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 1,
    marginBottom: 6,
  },
  aiCardBody: { fontSize: 14, color: '#374151', lineHeight: 22 },

  // Achievement banner
  achievementBanner: {
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#6366F1',
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  achievementBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: 1,
    marginBottom: 6,
  },
  achievementBannerItem: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
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
    color: '#EF4444',
    letterSpacing: 1,
  },
  battleProgress: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  comboBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 54,
  },
  comboValue: { fontSize: 18, fontWeight: '900', lineHeight: 22 },
  comboLabel: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },
  battleScoreBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 54,
  },
  battleScoreValue: { fontSize: 18, fontWeight: '900', color: '#111827', lineHeight: 22 },
  battleScoreLabel: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5 },
  battleTopicsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  battleTopicChip: {
    fontSize: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  battleAutoAdvance: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  battleAutoAdvanceText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },

  // Battle results
  battleResultScore: { fontSize: 72, fontWeight: '900', color: '#111827', lineHeight: 80 },
  battleStatRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  battleStat: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  battleStatValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  battleStatLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  battleHint: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FBBF24',
  },
  battleHintText: { fontSize: 13, color: '#FBBF24', fontWeight: '600' },
  battleExitButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  battleExitText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  speakerBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    marginBottom: 8,
  },
  speakerBtnText: { fontSize: 11, fontWeight: '700' as const, color: '#6366F1' },

  // Daily limit gate
  limitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderTopWidth: 3,
    borderTopColor: '#FBBF24',
    alignItems: 'center',
    gap: 12,
    maxWidth: 400,
    width: '100%',
  },
  limitTitle: { fontSize: 22, fontWeight: '800', color: '#FBBF24', textAlign: 'center' },
  limitBody: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  limitUpgradeBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 4,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  limitUpgradeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  limitNote: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
  limitBackBtn: { paddingVertical: 8 },
  limitBackText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },

  ruleLink: { color: '#0D9488', fontWeight: '700', textDecorationLine: 'underline' },
});
