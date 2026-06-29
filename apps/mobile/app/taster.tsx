import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Pip } from '@/src/components/Pip';
import { Question, TopicCategory } from '@clearpass/core';
import { allQuestions, questionsByTopic } from '@clearpass/content';
import * as Haptics from 'expo-haptics';

const TASTER_COUNT = 5;
const LABELS = ['A', 'B', 'C', 'D'];

// Pick one question from each of 5 varied topics for a representative sample
const SAMPLE_TOPICS: TopicCategory[] = [
  TopicCategory.RoadAndTrafficSigns,
  TopicCategory.SafetyMargins,
  TopicCategory.HazardAwareness,
  TopicCategory.RulesOfTheRoad,
  TopicCategory.Alertness,
];

function buildTasterQuestions(): Question[] {
  const selected: Question[] = [];
  for (const topic of SAMPLE_TOPICS) {
    const pool = questionsByTopic[topic];
    if (pool && pool.length > 0) {
      selected.push(pool[Math.floor(Math.random() * pool.length)]);
    }
  }
  // Fallback: top up from allQuestions if any topic was empty
  if (selected.length < TASTER_COUNT) {
    const ids = new Set(selected.map((q) => q.id));
    const extra = allQuestions.filter((q) => !ids.has(q.id));
    for (let i = selected.length; i < TASTER_COUNT && extra.length > 0; i++) {
      const idx = Math.floor(Math.random() * extra.length);
      selected.push(extra.splice(idx, 1)[0]!);
    }
  }
  return selected.slice(0, TASTER_COUNT);
}

type Phase = 'quiz' | 'results';

export default function TasterScreen() {
  const questions = useMemo(() => buildTasterQuestions(), []);
  const [phase, setPhase] = useState<Phase>('quiz');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(TASTER_COUNT).fill(null));

  const question = questions[index];
  const answered = selected !== null;
  const correctCount = answers.filter((a, i) => a === questions[i]?.correctIndex).length;

  function handleSelect(optionIndex: number) {
    if (answered) return;
    setSelected(optionIndex);
    const next = [...answers];
    next[index] = optionIndex;
    setAnswers(next);
    if (optionIndex === question?.correctIndex) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  function handleNext() {
    if (index + 1 >= TASTER_COUNT) {
      setPhase('results');
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
    }
  }

  if (phase === 'results') {
    const pct = Math.round((correctCount / TASTER_COUNT) * 100);
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.resultsCard}>
          <Pip size={90} mood={correctCount >= 4 ? 'celebrate' : correctCount >= 3 ? 'happy' : 'curious'} />
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreNum}>{correctCount}</Text>
            <Text style={styles.scoreOf}>{'/ 5'}</Text>
          </View>
          <Text style={styles.resultsHeading}>
            {correctCount >= 4 ? 'Impressive start!' : correctCount >= 3 ? 'Good start!' : 'Plenty to learn!'}
          </Text>
          <Text style={styles.resultsSub}>
            {`You got ${correctCount} of 5 right (${pct}%). In the real DVSA test you need 43 of 50. ClearPass gets you there.`}
          </Text>
        </View>

        <View style={styles.upsellCard}>
          <Text style={styles.upsellTitle}>{'Create a free account to:'}</Text>
          <Text style={styles.upsellItem}>{'✓  Track your progress with spaced repetition'}</Text>
          <Text style={styles.upsellItem}>{'✓  Get AI explanations on every question'}</Text>
          <Text style={styles.upsellItem}>{'✓  Full mock tests in DVSA format'}</Text>
          <Text style={styles.upsellItem}>{'✓  Pass probability score updated daily'}</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/auth/signup')} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>{'Create Free Account'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/auth/signin')} activeOpacity={0.8}>
          <Text style={styles.secondaryBtnText}>{'I already have an account'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/')} activeOpacity={0.7}>
          <Text style={styles.skipLink}>{'Maybe later'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (!question) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')} activeOpacity={0.7}>
          <Text style={styles.exitText}>{'✕ Exit'}</Text>
        </TouchableOpacity>
        <Text style={styles.progressText}>{index + 1}{' of '}{TASTER_COUNT}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((index + (answered ? 1 : 0)) / TASTER_COUNT) * 100}%` as `${number}%` }]} />
      </View>

      <Text style={styles.trialBadge}>{'✦ Free trial — no account needed'}</Text>

      {/* Question */}
      <Text style={styles.questionText}>{question.questionText}</Text>

      {/* Options */}
      <View style={styles.optionsGap}>
        {question.options.map((option, i) => {
          const isCorrect = i === question.correctIndex;
          const isSelected = i === selected;
          let bg = '#1C1C27';
          let border = '#2D2D3F';
          let textCol = '#E5E7EB';
          if (answered) {
            if (isCorrect) { bg = '#064E3B'; border = '#10B981'; textCol = '#6EE7B7'; }
            else if (isSelected) { bg = '#450A0A'; border = '#EF4444'; textCol = '#FCA5A5'; }
          }
          return (
            <TouchableOpacity
              key={i}
              style={[styles.option, { backgroundColor: bg, borderColor: border }]}
              onPress={() => handleSelect(i)}
              activeOpacity={answered ? 1 : 0.8}
            >
              <View style={[styles.optionBadge, answered && { backgroundColor: border }]}>
                <Text style={styles.optionBadgeText}>{LABELS[i]}</Text>
              </View>
              <Text style={[styles.optionText, { color: textCol }]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Explanation after answering */}
      {answered && question.explanation ? (
        <View style={styles.explanationCard}>
          <Text style={styles.explanationLabel}>{'EXPLANATION'}</Text>
          <Text style={styles.explanationText}>{question.explanation}</Text>
        </View>
      ) : null}

      {answered && (
        <TouchableOpacity style={styles.primaryBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>
            {index + 1 >= TASTER_COUNT ? 'See my score' : 'Next question'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const INDIGO = '#7B5EA7';
const INDIGO_BRIGHT = '#A78BFA';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 20, paddingBottom: 48 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  exitText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  progressText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },

  progressBar: { height: 4, backgroundColor: '#1C1C27', borderRadius: 2, marginBottom: 20, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: INDIGO_BRIGHT, borderRadius: 2 },

  trialBadge: { fontSize: 11, color: INDIGO_BRIGHT, fontWeight: '700', letterSpacing: 0.5, marginBottom: 20, textAlign: 'center' },

  questionText: { fontSize: 18, fontWeight: '700', color: '#F1F0FF', lineHeight: 26, marginBottom: 20 },

  optionsGap: { gap: 10, marginBottom: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 14,
  },
  optionBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2D2D3F', flexShrink: 0,
  },
  optionBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  optionText: { fontSize: 14, lineHeight: 20, flex: 1 },

  explanationCard: {
    backgroundColor: '#13131A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D3F',
  },
  explanationLabel: { fontSize: 10, fontWeight: '800', color: INDIGO_BRIGHT, letterSpacing: 1, marginBottom: 6 },
  explanationText: { fontSize: 13, color: '#D1D5DB', lineHeight: 20 },

  primaryBtn: { backgroundColor: INDIGO, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { borderRadius: 14, borderWidth: 1, borderColor: '#3D3D52', paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  secondaryBtnText: { color: '#A78BFA', fontSize: 14, fontWeight: '600' },
  skipLink: { color: '#4B5563', fontSize: 13, textAlign: 'center' },

  // Results
  resultsCard: { alignItems: 'center', gap: 12, marginBottom: 24, paddingVertical: 8 },
  scoreCircle: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  scoreNum: { fontSize: 64, fontWeight: '900', color: '#F1F0FF', lineHeight: 72 },
  scoreOf: { fontSize: 24, fontWeight: '700', color: '#6B7280', paddingBottom: 10 },
  resultsHeading: { fontSize: 24, fontWeight: '800', color: '#F1F0FF', textAlign: 'center' },
  resultsSub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },

  upsellCard: {
    backgroundColor: '#13131A',
    borderRadius: 16,
    padding: 18,
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D2D3F',
  },
  upsellTitle: { fontSize: 14, fontWeight: '700', color: '#F1F0FF', marginBottom: 4 },
  upsellItem: { fontSize: 13, color: '#9CA3AF', lineHeight: 20 },
});
