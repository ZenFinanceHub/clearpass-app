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
  const tip = DAILY_TIPS[new Date().getDay() % 3];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      <View style={styles.xpCard}>
        <Text style={styles.xpDecorCar}>{'🚗'}</Text>
        <View style={styles.xpTopRow}>
          <View style={styles.xpBadge}>
            <Text style={styles.xpBadgeText}>{xp.label}</Text>
          </View>
          <Text style={styles.xpScore}>{score}</Text>
        </View>
        <View style={styles.xpBarTrack}>
          <View style={[styles.xpBarFill, { width: `${Math.round(xp.pct * 100)}%` as any }]} />
        </View>
        <Text style={styles.xpMsg}>{xp.msg}</Text>
      </View>

      {streak > 0 && (
        <View style={styles.streakBanner}>
          <Text style={styles.streakLabel}>STREAK</Text>
          <Text style={styles.streakNum}>{streak}</Text>
          <Text style={styles.streakDays}>days</Text>
        </View>
      )}

      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={[styles.actionCard, styles.accPractice]}
          onPress={() => router.push('/(tabs)/practice')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionEmoji}>{'🎯'}</Text>
          <Text style={styles.actionTitle}>Practice</Text>
          <Text style={styles.actionSub}>Random questions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.accMock]}
          onPress={() => router.push('/(tabs)/mock')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionEmoji}>{'📋'}</Text>
          <Text style={styles.actionTitle}>Mock Test</Text>
          <Text style={styles.actionSub}>57 minutes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.accLearn]}
          onPress={() => router.push('/(tabs)/learn')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionEmoji}>{'📚'}</Text>
          <Text style={styles.actionTitle}>Learn</Text>
          <Text style={styles.actionSub}>Highway Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.accHazard]}
          onPress={() => router.push('/(tabs)/hazard')}
          activeOpacity={0.8}
        >
          <Text style={styles.actionEmoji}>{'⚠'}</Text>
          <Text style={styles.actionTitle}>Hazard</Text>
          <Text style={styles.actionSub}>14 clips</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>DID YOU KNOW?</Text>
        <Text style={styles.tipBody}>{tip}</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  content: {
    flexGrow: 1,
    paddingBottom: 40,
  },

  xpCard: {
    backgroundColor: '#13131A',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    margin: 16,
    padding: 24,
    overflow: 'hidden',
  },
  xpDecorCar: {
    position: 'absolute',
    top: 12,
    right: 16,
    fontSize: 40,
    opacity: 0.06,
  },
  xpTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  xpBadge: {
    backgroundColor: '#1C1C27',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: '#A78BFA',
  },
  xpBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A78BFA',
    letterSpacing: 1,
  },
  xpScore: {
    fontSize: 48,
    fontWeight: '900',
    color: '#F1F0FF',
    lineHeight: 56,
  },
  xpBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#1C1C27',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  xpBarFill: {
    height: 6,
    backgroundColor: '#A78BFA',
    borderRadius: 3,
  },
  xpMsg: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  streakBanner: {
    backgroundColor: '#13131A',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    borderTopWidth: 3,
    borderTopColor: '#FBBF24',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FBBF24',
    letterSpacing: 1,
  },
  streakNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F1F0FF',
  },
  streakDays: {
    fontSize: 12,
    color: '#6B7280',
  },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '44%',
    minHeight: 110,
    borderRadius: 16,
    padding: 18,
    justifyContent: 'flex-end',
    backgroundColor: '#13131A',
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    borderTopWidth: 3,
  },
  accPractice: { borderTopColor: '#F87171' },
  accMock: { borderTopColor: '#A78BFA' },
  accLearn: { borderTopColor: '#34D399' },
  accHazard: { borderTopColor: '#FBBF24' },
  actionEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F0FF',
    marginBottom: 2,
  },
  actionSub: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  tipCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: '#13131A',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    borderLeftWidth: 3,
    borderLeftColor: '#A78BFA',
    padding: 16,
  },
  tipTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A78BFA',
    letterSpacing: 1,
    marginBottom: 6,
  },
  tipBody: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
});
