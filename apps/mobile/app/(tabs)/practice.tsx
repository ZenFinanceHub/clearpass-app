import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
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
import { explainAnswer } from '@clearpass/ai';

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

type Phase = 'start' | 'loading' | 'quiz' | 'results' | 'battle' | 'battleResults';

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

  // Normal quiz state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // XP / achievements for results screen
  const [xpGained, setXpGained] = useState(0);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);

  // Battle mode display state
  const [battleDisplay, setBattleDisplay] = useState<BattleDisplay>({
    idx: 0,
    selected: null,
    combo: 0,
    maxCombo: 0,
    score: 0,
  });
  const [battleXpEarned, setBattleXpEarned] = useState(0);
  const [battleNewAchievements, setBattleNewAchievements] = useState<Achievement[]>([]);

  // Refs
  const questionStatesRef = useRef<Record<string, QuestionState>>({});
  const userProgressRef = useRef<UserProgress | null>(null);
  const resultsRef = useRef<SessionResult[]>([]);

  // Battle refs (mutable without re-render)
  const battleQsRef = useRef<Question[]>([]);
  const battleWeakTopicsRef = useRef<TopicCategory[]>([]);
  const battleIdxRef = useRef(0);
  const battleComboRef = useRef(0);
  const battleMaxComboRef = useRef(0);
  const battleScoreRef = useRef(0);
  const battleAnsweredRef = useRef(false);
  const battleCancelledRef = useRef(false);

  async function startSession() {
    const [statesMap, progress] = await Promise.all([
      loadQuestionStates(),
      loadUserProgress(),
    ]);

    questionStatesRef.current = statesMap;
    userProgressRef.current = progress ?? createFreshUserProgress();

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

    // Pick 3 weakest topics by topicScore
    const weakTopics = Object.values(TopicCategory)
      .sort((a, b) => (progress.topicScores[a] ?? 0) - (progress.topicScores[b] ?? 0))
      .slice(0, 3);

    battleWeakTopicsRef.current = weakTopics;

    // 5 questions per weak topic, shuffled
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
    };
    updated.readinessScore = calculateReadiness(updated).score;

    // Award practice XP
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

    // Update daily challenge progress
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#A78BFA" />
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
        <Text style={styles.questionText}>{question.questionText}</Text>
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
              style={[styles.option, cardStyle]}
              onPress={() => handleAnswer(idx)}
              activeOpacity={isAnswered ? 1 : 0.75}
              disabled={isAnswered}
            >
              <View style={[styles.badge, badgeStyle]}>
                <Text style={[styles.badgeText, badgeTextStyle]}>{LABELS[idx]}</Text>
              </View>
              <Text style={[styles.optionText, textStyle]}>{option}</Text>
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
          <Text
            style={[
              styles.explanationBody,
              answeredCorrectly ? styles.explanationBodyGreen : styles.explanationBodyRed,
            ]}
          >
            {question.explanation}
          </Text>
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
              <ActivityIndicator size="small" color="#A78BFA" />
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
        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>
            {currentIndex + 1 >= questions.length ? 'See Results' : 'Next Question ->'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
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
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.startContent}>
      <Text style={styles.startTitle}>Practice Mode</Text>
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
    return { borderColor: '#34D399', accentColor: '#34D399', label: 'PERFECT!', emoji: '🏆' };
  if (pct >= 80)
    return { borderColor: '#A78BFA', accentColor: '#A78BFA', label: 'GREAT JOB!', emoji: '⭐' };
  if (pct >= 60)
    return { borderColor: '#FBBF24', accentColor: '#FBBF24', label: 'NOT BAD!', emoji: '👍' };
  return { borderColor: '#F87171', accentColor: '#F87171', label: 'KEEP GOING!', emoji: '💪' };
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
    combo >= 5 ? '#F87171' : combo >= 3 ? '#FBBF24' : combo >= 2 ? '#34D399' : '#6B7280';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
        <Text style={styles.questionText}>{question.questionText}</Text>
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
              <Text style={[styles.optionText, textStyle]}>{option}</Text>
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
  const bannerColor = excellent ? '#34D399' : good ? '#FBBF24' : '#F87171';
  const label = excellent ? 'EXCELLENT!' : good ? 'GOOD FIGHT!' : 'KEEP TRAINING!';

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
          <Text style={[styles.battleStatValue, { color: xpEarned > 0 ? '#A78BFA' : '#374151' }]}>
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

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 16, paddingBottom: 48 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#0A0A0F',
  },
  loadingText: { color: '#6B7280', fontSize: 15 },

  // Start screen
  startContent: { padding: 24, paddingBottom: 48, flexGrow: 1, justifyContent: 'center' },
  startTitle: { fontSize: 28, fontWeight: '800', color: '#F1F0FF', marginBottom: 8 },
  startSub: { fontSize: 15, color: '#6B7280', marginBottom: 32, lineHeight: 22 },
  startOr: {
    textAlign: 'center',
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
    marginVertical: 16,
  },
  battleButton: {
    backgroundColor: '#13131A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F87171',
  },
  battleButtonTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F87171',
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
  progressPct: { fontSize: 13, color: '#A78BFA', fontWeight: '700' },
  progressTrack: {
    height: 6,
    backgroundColor: '#1C1C27',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: '#A78BFA', borderRadius: 3 },

  // Question card
  questionCard: {
    backgroundColor: '#13131A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    borderLeftWidth: 3,
    borderLeftColor: '#A78BFA',
  },
  topicBadge: {
    alignSelf: 'flex-end',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
    backgroundColor: '#1C1C27',
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
  },
  topicBadgeEmoji: { fontSize: 16 },
  questionText: { fontSize: 17, fontWeight: '600', color: '#F1F0FF', lineHeight: 26 },

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
  optionDefault: { backgroundColor: '#13131A', borderColor: '#1F1F2E' },
  optionCorrect: { backgroundColor: '#064E3B', borderColor: '#34D399' },
  optionWrong: { backgroundColor: '#450A0A', borderColor: '#F87171' },
  optionDimmed: { backgroundColor: '#13131A', borderColor: '#1F1F2E' },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeDefault: { backgroundColor: '#1C1C27' },
  badgeCorrect: { backgroundColor: '#34D399' },
  badgeWrong: { backgroundColor: '#F87171' },
  badgeText: { fontSize: 13, fontWeight: '800' },
  badgeTextDefault: { color: '#6B7280' },
  badgeTextColored: { color: '#FFFFFF' },
  optionText: { flex: 1, fontSize: 15, lineHeight: 22 },
  optionTextDefault: { color: '#F1F0FF' },
  optionTextCorrect: { color: '#34D399', fontWeight: '600' },
  optionTextWrong: { color: '#F87171', fontWeight: '600' },
  optionTextDimmed: { color: '#374151' },

  // Explanation
  explanation: { borderRadius: 12, padding: 16, marginBottom: 14, borderLeftWidth: 3 },
  explanationGreen: { backgroundColor: '#064E3B', borderLeftColor: '#34D399' },
  explanationRed: { backgroundColor: '#450A0A', borderLeftColor: '#F87171' },
  explanationTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  explanationTitleGreen: { color: '#34D399' },
  explanationTitleRed: { color: '#F87171' },
  explanationBody: { fontSize: 14, lineHeight: 21 },
  explanationBodyGreen: { color: '#D1FAE5' },
  explanationBodyRed: { color: '#FEE2E2' },

  // Buttons
  primaryButton: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  outlineButton: {
    backgroundColor: '#13131A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F1F2E',
  },
  outlineButtonText: { color: '#6B7280', fontSize: 16, fontWeight: '600' },

  // Results screen
  scoreBanner: {
    backgroundColor: '#13131A',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  resultEmoji: { fontSize: 56, marginBottom: 8 },
  resultLabel: { fontSize: 22, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  scoreValue: { fontSize: 72, fontWeight: '900', color: '#F1F0FF', lineHeight: 80 },
  scorePct: { fontSize: 20, color: '#6B7280', fontWeight: '600', marginTop: 4 },
  xpNotif: {
    fontSize: 16,
    fontWeight: '700',
    color: '#A78BFA',
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
  breakdownRowCorrect: { backgroundColor: '#064E3B', borderLeftColor: '#34D399' },
  breakdownRowWrong: { backgroundColor: '#450A0A', borderLeftColor: '#F87171' },
  breakdownDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  dotGreen: { backgroundColor: '#34D399' },
  dotRed: { backgroundColor: '#F87171' },
  dotText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  breakdownText: { flex: 1, fontSize: 13, color: '#F1F0FF', lineHeight: 20 },

  // AI tutor
  explainButton: {
    backgroundColor: '#1C1C27',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A78BFA',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  explainButtonText: { color: '#A78BFA', fontSize: 14, fontWeight: '700' },
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
    backgroundColor: '#1C1C27',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#A78BFA',
  },
  aiCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 1,
    marginBottom: 6,
  },
  aiCardBody: { fontSize: 14, color: '#9CA3AF', lineHeight: 22 },

  // Achievement banner
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
    color: '#F87171',
    letterSpacing: 1,
  },
  battleProgress: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  comboBadge: {
    backgroundColor: '#13131A',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 54,
  },
  comboValue: { fontSize: 18, fontWeight: '900', lineHeight: 22 },
  comboLabel: { fontSize: 9, fontWeight: '700', color: '#374151', letterSpacing: 0.5 },
  battleScoreBadge: {
    backgroundColor: '#13131A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F1F2E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 54,
  },
  battleScoreValue: { fontSize: 18, fontWeight: '900', color: '#F1F0FF', lineHeight: 22 },
  battleScoreLabel: { fontSize: 9, fontWeight: '700', color: '#374151', letterSpacing: 0.5 },
  battleTopicsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  battleTopicChip: {
    fontSize: 20,
    backgroundColor: '#13131A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  battleAutoAdvance: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  battleAutoAdvanceText: { fontSize: 13, color: '#374151', fontStyle: 'italic' },

  // Battle results
  battleResultScore: { fontSize: 72, fontWeight: '900', color: '#F1F0FF', lineHeight: 80 },
  battleStatRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  battleStat: {
    flex: 1,
    backgroundColor: '#13131A',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
  },
  battleStatValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F1F0FF',
    marginBottom: 4,
  },
  battleStatLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  battleHint: {
    backgroundColor: '#13131A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#FBBF24',
  },
  battleHintText: { fontSize: 13, color: '#FBBF24', fontWeight: '600' },
  battleExitButton: {
    backgroundColor: '#13131A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  battleExitText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
});
