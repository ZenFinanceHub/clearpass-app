import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { UserProgress } from '@clearpass/core';
import { loadUserProgress } from '@/src/storage';

const DAILY_TIPS = [
  "Stopping distance at 70mph is 96 metres - that's 24 car lengths!",
  'Over 50% of learners fail their theory test first time. Practice daily to beat the odds.',
  'The hazard perception test has 14 clips. You need 44 out of 75 to pass.',
];

function getXpLevel(score: number): { label: string; pct: number; msg: string } {
  if (score <= 20) return { label: 'LEVEL 1', pct: score / 20, msg: `${20 - score} more points to Level 2` };
  if (score <= 40) return { label: 'LEVEL 2', pct: (score - 20) / 20, msg: `${40 - score} more points to Level 3` };
  if (score <= 60) return { label: 'LEVEL 3', pct: (score - 40) / 20, msg: `${60 - score} more points to Level 4` };
  if (score <= 80) return { label: 'LEVEL 4', pct: (score - 60) / 20, msg: `${80 - score} more points to Test Ready!` };
  return { label: 'TEST READY!', pct: 1, msg: "You're ready to book your test!" };
}

export default function HomeScreen() {
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    loadUserProgress().then(setProgress);
  }, []);

  const score = progress?.readinessScore ?? 0;
  const streak = progress?.studyStreakDays ?? 0;
  const xp = getXpLevel(score);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Road emoji banner */}
      <View style={styles.emojiBanner}>
        <Text style={styles.emojiRow}>{'🚗  🛣  🚦  🛑  🚧'}</Text>
      </View>

      {/* XP level card */}
      <View style={styles.xpCard}>
        <Text style={styles.xpLevelLabel}>{xp.label}</Text>
        <Text style={styles.xpScore}>{score}</Text>
        <View style={styles.xpBarTrack}>
          <View style={[styles.xpBarFill, { width: `${Math.round(xp.pct * 100)}%` as any }]} />
        </View>
        <Text style={styles.xpMsg}>{xp.msg}</Text>
      </View>

      {/* Streak banner */}
      {streak > 0 && (
        <View style={styles.streakBanner}>
          <Text style={styles.streakText}>{'🔥  '}{streak}{' day streak - keep it up!'}</Text>
        </View>
      )}

      {/* 2x2 action grid */}
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={[styles.actionCard, styles.actionPractice]}
          onPress={() => router.push('/(tabs)/practice')}
          activeOpacity={0.85}
        >
          <Text style={styles.actionEmoji}>{'📝'}</Text>
          <Text style={styles.actionTitle}>Practice</Text>
          <Text style={styles.actionSub}>Random questions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.actionMock]}
          onPress={() => router.push('/(tabs)/mock')}
          activeOpacity={0.85}
        >
          <Text style={styles.actionEmoji}>{'⏱'}</Text>
          <Text style={styles.actionTitle}>Mock Test</Text>
          <Text style={styles.actionSub}>50 questions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.actionLearn]}
          onPress={() => router.push('/(tabs)/learn')}
          activeOpacity={0.85}
        >
          <Text style={styles.actionEmoji}>{'📖'}</Text>
          <Text style={[styles.actionTitle, styles.actionTitleDark]}>Learn</Text>
          <Text style={[styles.actionSub, styles.actionSubDark]}>Theory guides</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.actionHazard]}
          onPress={() => router.push('/(tabs)/hazard')}
          activeOpacity={0.85}
        >
          <Text style={styles.actionEmoji}>{'⚠'}</Text>
          <Text style={[styles.actionTitle, styles.actionTitleDark]}>Hazard</Text>
          <Text style={[styles.actionSub, styles.actionSubDark]}>Video clips</Text>
        </TouchableOpacity>
      </View>

      {/* Tip card */}
      <View style={styles.tipCard}>
        <Text style={styles.tipCardTitle}>Did you know?</Text>
        <Text style={styles.tipCardBody}>{DAILY_TIPS[new Date().getDay() % 3]}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F8F7FF',
  },
  content: {
    flexGrow: 1,
    backgroundColor: '#F8F7FF',
    paddingBottom: 32,
  },

  // Road emoji banner
  emojiBanner: {
    backgroundColor: '#6C63FF',
    paddingVertical: 18,
    alignItems: 'center',
  },
  emojiRow: {
    fontSize: 28,
    letterSpacing: 2,
  },

  // XP level card
  xpCard: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    alignItems: 'center',
  },
  xpLevelLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  xpScore: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 72,
    marginBottom: 12,
  },
  xpBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  xpBarFill: {
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  xpMsg: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },

  // Streak banner
  streakBanner: {
    backgroundColor: '#FF9500',
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  streakText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // 2x2 action grid
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
  },
  actionCard: {
    flex: 1,
    minWidth: '44%',
    minHeight: 110,
    borderRadius: 20,
    padding: 18,
    justifyContent: 'flex-end',
  },
  actionPractice: { backgroundColor: '#FF6B6B' },
  actionMock: { backgroundColor: '#6C63FF' },
  actionLearn: { backgroundColor: '#51CF66' },
  actionHazard: { backgroundColor: '#FFD43B' },
  actionEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  actionTitleDark: {
    color: '#1E293B',
  },
  actionSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  actionSubDark: {
    color: 'rgba(0,0,0,0.5)',
  },

  // Tip card
  tipCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#FFF9DB',
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD43B',
  },
  tipCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 6,
  },
  tipCardBody: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 21,
  },
});
