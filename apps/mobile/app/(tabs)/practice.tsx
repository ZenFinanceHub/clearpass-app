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

  // Refs hold mutable state that doesn't need to trigger re-renders but must
  // be current inside async callbacks.
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

    setQuestions(sessionQuestions);
    setPhase(sessionQuestions.length > 0 ? 'quiz' : 'results');
  }

  const handleAnswer = useCallback(
    async (optionIndex: number) => {
      if (selectedIndex !== null) return;

      const question = questions[currentIndex];
      const correct = optionIndex === question.correctIndex;

      // SM-2 update
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
    console.log('Calling AI with question:', q.questionText);
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

    // Compute per-topic accuracy for this session
    const topicData: Partial<Record<TopicCategory, { correct: number; total: number }>> = {};
    for (const { question, correct } of results) {
      const cat = question.topicCategory;
      if (!topicData[cat]) topicData[cat] = { correct: 0, total: 0 };
      topicData[cat]!.total += 1;
      if (correct) topicData[cat]!.correct += 1;
    }

    // Blend session accuracy into the rolling topic scores (60/40 weighted average)
    const updatedScores = { ...progress.topicScores };
    for (const [cat, data] of Object.entries(topicData) as [TopicCategory, { correct: number; total: number }][]) {
      const sessionAccuracy = Math.round((data.correct / data.total) * 100);
      const existing = updatedScores[cat] ?? 0;
      updatedScores[cat] =
        existing === 0
          ? sessionAccuracy
          : Math.round(existing * 0.6 + sessionAccuracy * 0.4);
    }

    // updateStudyStreak uses the old lastStudied before we overwrite it
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

  // Loading
  if (phase === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
    );
  }

  // Results
  if (phase === 'results') {
    return <ResultsScreen results={sessionResults} />;
  }

  // Quiz
  const question = questions[currentIndex];
  const isAnswered = selectedIndex !== null;
  const answeredCorrectly = isAnswered && selectedIndex === question.correctIndex;
  const progress = ((currentIndex + (isAnswered ? 1 : 0)) / questions.length) * 100;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Progress */}
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>
          Question {currentIndex + 1} of {questions.length}
        </Text>
        <Text style={styles.progressPct}>{Math.round(progress)}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
      </View>

      {/* Question card */}
      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{question.questionText}</Text>
      </View>

      {/* Options */}
      <View style={styles.optionList}>
        {question.options.map((option, idx) => {
          const isCorrect = idx === question.correctIndex;
          const isSelected = idx === selectedIndex;

          let cardStyle = styles.optionDefault;
          let badgeStyle = styles.badgeDefault;
          let textStyle = styles.optionTextDefault;

          if (isAnswered) {
            if (isCorrect) {
              cardStyle = styles.optionCorrect;
              badgeStyle = styles.badgeCorrect;
              textStyle = styles.optionTextCorrect;
            } else if (isSelected) {
              cardStyle = styles.optionWrong;
              badgeStyle = styles.badgeWrong;
              textStyle = styles.optionTextWrong;
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
                <Text style={styles.badgeText}>{LABELS[idx]}</Text>
              </View>
              <Text style={[styles.optionText, textStyle]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Explanation */}
      {isAnswered && (
        <View style={[styles.explanation, answeredCorrectly ? styles.explanationGreen : styles.explanationRed]}>
          <Text style={styles.explanationTitle}>
            {answeredCorrectly ? 'Correct!' : 'Incorrect'}
          </Text>
          <Text style={styles.explanationBody}>{question.explanation}</Text>
        </View>
      )}

      {/* AI tutor explanation - wrong answers only */}
      {isAnswered && !answeredCorrectly && (
        <>
          {aiExplanation !== null ? (
            <View style={styles.aiCard}>
              <Text style={styles.aiCardTitle}>AI Tutor</Text>
              <Text style={styles.aiCardBody}>{aiExplanation}</Text>
            </View>
          ) : aiLoading ? (
            <View style={styles.aiLoadingRow}>
              <ActivityIndicator size="small" color="#6C63FF" />
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

      {/* Next / See Results */}
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

// Results screen

function ResultsScreen({ results }: { results: SessionResult[] }) {
  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const verdict =
    pct >= 86 ? 'Excellent work!' : pct >= 60 ? 'Good effort!' : 'Keep practising';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Score banner */}
      <View style={styles.scoreBanner}>
        <Text style={styles.scoreValue}>
          {correct} / {total}
        </Text>
        <Text style={styles.scorePct}>{pct}%</Text>
        <Text style={styles.scoreVerdict}>{verdict}</Text>
      </View>

      {/* Breakdown */}
      <Text style={styles.sectionLabel}>Question Breakdown</Text>
      <View style={styles.breakdownList}>
        {results.map(({ question, correct: isCorrect }, i) => (
          <View key={question.id} style={styles.breakdownRow}>
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
        onPress={() => router.replace('/(tabs)/home')}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// Styles

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F8F7FF' },
  content: { padding: 16, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 15 },

  // Progress bar
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  progressPct: { fontSize: 13, color: '#6C63FF', fontWeight: '700' },
  progressTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, marginBottom: 16, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#6C63FF', borderRadius: 3 },

  // Question
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#6C63FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  questionText: { fontSize: 17, fontWeight: '600', color: '#0F172A', lineHeight: 26 },

  // Options
  optionList: { gap: 10, marginBottom: 14 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
  },
  optionDefault: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  optionCorrect: { backgroundColor: '#51CF66', borderColor: '#51CF66' },
  optionWrong: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
  optionDimmed: { backgroundColor: '#F8FAFC', borderColor: '#F1F5F9' },

  badge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badgeDefault: { backgroundColor: '#6C63FF' },
  badgeCorrect: { backgroundColor: '#3DAF55' },
  badgeWrong: { backgroundColor: '#E84E4E' },
  badgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  optionText: { flex: 1, fontSize: 15, lineHeight: 22 },
  optionTextDefault: { color: '#1E293B' },
  optionTextCorrect: { color: '#FFFFFF', fontWeight: '600' },
  optionTextWrong: { color: '#FFFFFF', fontWeight: '600' },
  optionTextDimmed: { color: '#94A3B8' },

  // Explanation
  explanation: { borderRadius: 12, padding: 16, marginBottom: 14, borderLeftWidth: 4 },
  explanationGreen: { backgroundColor: '#E8FFF0', borderLeftColor: '#51CF66' },
  explanationRed: { backgroundColor: '#FFF0F0', borderLeftColor: '#FF6B6B' },
  explanationTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  explanationBody: { fontSize: 14, color: '#334155', lineHeight: 21 },

  // Buttons
  primaryButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Results
  scoreBanner: {
    backgroundColor: '#6C63FF',
    borderRadius: 20,
    paddingVertical: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreValue: { fontSize: 56, fontWeight: '800', color: '#FFFFFF', lineHeight: 62 },
  scorePct: { fontSize: 22, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginBottom: 6 },
  scoreVerdict: { fontSize: 17, color: '#FFFFFF', fontWeight: '600' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  breakdownList: { gap: 8, marginBottom: 24 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  breakdownDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  dotGreen: { backgroundColor: '#51CF66' },
  dotRed: { backgroundColor: '#FF6B6B' },
  dotText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  breakdownText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20 },

  // AI tutor
  explainButton: {
    backgroundColor: '#F8F7FF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#6C63FF',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  explainButtonText: {
    color: '#6C63FF',
    fontSize: 14,
    fontWeight: '700',
  },
  aiLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  aiLoadingText: {
    color: '#64748B',
    fontSize: 14,
  },
  aiCard: {
    backgroundColor: '#F0EEFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#6C63FF',
  },
  aiCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6C63FF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  aiCardBody: {
    fontSize: 14,
    color: '#1E3A5F',
    lineHeight: 22,
  },
});
