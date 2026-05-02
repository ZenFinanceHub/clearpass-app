import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Question,
  QuestionState,
  TopicCategory,
  UserProgress,
  calculateReadiness,
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
  updateStudyStreak,
} from '@/src/storage';
import { explainAnswer } from '@clearpass/ai';

const SESSION_SIZE = 10;
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

type Phase = 'loading' | 'quiz' | 'results';

type SessionResult = {
  question: Question;
  selectedIndex: number;
  correct: boolean;
};

export default function PracticeScreen() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const questionStatesRef = useRef<Record<string, QuestionState>>({});
  const userProgressRef = useRef<UserProgress | null>(null);
  const resultsRef = useRef<SessionResult[]>([]);

  useEffect(() => {
    void startSession();
  }, []);

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
    setQuestions(sessionQuestions);
    setPhase(sessionQuestions.length > 0 ? 'quiz' : 'results');
  }

  async function handlePlayAgain() {
    setPhase('loading');
    await startSession();
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
    for (const [cat, data] of Object.entries(topicData) as [TopicCategory, { correct: number; total: number }][]) {
      const sessionAccuracy = Math.round((data.correct / data.total) * 100);
      const existing = updatedScores[cat] ?? 0;
      updatedScores[cat] =
        existing === 0
          ? sessionAccuracy
          : Math.round(existing * 0.6 + sessionAccuracy * 0.4);
    }

    const streaked = updateStudyStreak(progress);

    const updated: UserProgress = {
      ...streaked,
      topicScores: updatedScores,
      totalQuestionsAnswered: progress.totalQuestionsAnswered + results.length,
      lastStudied: new Date().toISOString(),
    };
    updated.readinessScore = calculateReadiness(updated).score;

    userProgressRef.current = updated;
    await saveUserProgress(updated);
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
    return <ResultsScreen results={sessionResults} onPlayAgain={handlePlayAgain} />;
  }

  const question = questions[currentIndex];
  const isAnswered = selectedIndex !== null;
  const answeredCorrectly = isAnswered && selectedIndex === question.correctIndex;
  const progress = ((currentIndex + (isAnswered ? 1 : 0)) / questions.length) * 100;
  const topicEmoji = TOPIC_EMOJI[question.topicCategory];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>
          Question {currentIndex + 1} of {questions.length}
        </Text>
        <Text style={styles.progressPct}>{Math.round(progress)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
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
        <View style={[styles.explanation, answeredCorrectly ? styles.explanationGreen : styles.explanationRed]}>
          <Text style={[styles.explanationTitle, answeredCorrectly ? styles.explanationTitleGreen : styles.explanationTitleRed]}>
            {answeredCorrectly ? 'Correct!' : 'Incorrect'}
          </Text>
          <Text style={[styles.explanationBody, answeredCorrectly ? styles.explanationBodyGreen : styles.explanationBodyRed]}>
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

function resultConfig(pct: number): { borderColor: string; accentColor: string; label: string; emoji: string } {
  if (pct === 100) return { borderColor: '#34D399', accentColor: '#34D399', label: 'PERFECT!', emoji: '🏆' };
  if (pct >= 80) return { borderColor: '#A78BFA', accentColor: '#A78BFA', label: 'GREAT JOB!', emoji: '⭐' };
  if (pct >= 60) return { borderColor: '#FBBF24', accentColor: '#FBBF24', label: 'NOT BAD!', emoji: '👍' };
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
}: {
  results: SessionResult[];
  onPlayAgain: () => void;
}) {
  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const cfg = resultConfig(pct);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={[styles.scoreBanner, { borderColor: cfg.borderColor }]}>
        <Text style={styles.resultEmoji}>{cfg.emoji}</Text>
        <Text style={[styles.resultLabel, { color: cfg.accentColor }]}>{cfg.label}</Text>
        <Text style={styles.scoreValue}>
          {correct} / {total}
        </Text>
        <Text style={styles.scorePct}>{pct}%</Text>
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

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={onPlayAgain}
        activeOpacity={0.85}
      >
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

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0A0A0F' },
  loadingText: { color: '#6B7280', fontSize: 15 },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  progressPct: { fontSize: 13, color: '#A78BFA', fontWeight: '700' },
  progressTrack: { height: 6, backgroundColor: '#1C1C27', borderRadius: 3, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#A78BFA', borderRadius: 3 },

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

  badge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
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

  explanation: { borderRadius: 12, padding: 16, marginBottom: 14, borderLeftWidth: 3 },
  explanationGreen: { backgroundColor: '#064E3B', borderLeftColor: '#34D399' },
  explanationRed: { backgroundColor: '#450A0A', borderLeftColor: '#F87171' },
  explanationTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  explanationTitleGreen: { color: '#34D399' },
  explanationTitleRed: { color: '#F87171' },
  explanationBody: { fontSize: 14, lineHeight: 21 },
  explanationBodyGreen: { color: '#D1FAE5' },
  explanationBodyRed: { color: '#FEE2E2' },

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
});
