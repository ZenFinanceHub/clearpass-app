import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  ACHIEVEMENTS,
  Achievement,
  MockTestResult,
  TopicCategory,
  UserProgress,
} from '@clearpass/core';
import { loadUserProgress } from '@/src/storage';

const TOPIC_LABELS: Record<TopicCategory, string> = {
  [TopicCategory.Alertness]: 'Alertness',
  [TopicCategory.Attitude]: 'Attitude',
  [TopicCategory.SafetyAndYourVehicle]: 'Safety and Your Vehicle',
  [TopicCategory.SafetyMargins]: 'Safety Margins',
  [TopicCategory.HazardAwareness]: 'Hazard Awareness',
  [TopicCategory.VulnerableRoadUsers]: 'Vulnerable Road Users',
  [TopicCategory.OtherTypes]: 'Other Types of Vehicle',
  [TopicCategory.VehicleHandling]: 'Vehicle Handling',
  [TopicCategory.MotorwayRules]: 'Motorway Rules',
  [TopicCategory.RulesOfTheRoad]: 'Rules of the Road',
  [TopicCategory.RoadAndTrafficSigns]: 'Road and Traffic Signs',
  [TopicCategory.DocumentsAndRegulations]: 'Documents and Regulations',
  [TopicCategory.AccidentsAndEmergencies]: 'Accidents and Emergencies',
  [TopicCategory.VehicleLoading]: 'Vehicle Loading',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function bestScore(history: MockTestResult[]): string {
  if (history.length === 0) return '-';
  return `${Math.max(...history.map((r) => r.score))} / 50`;
}

function goalDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 56);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function barColor(pct: number): string {
  if (pct >= 80) return '#A78BFA';
  if (pct >= 50) return '#FBBF24';
  return '#F87171';
}

function getRank(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Test Ready!', color: '#FBBF24' };
  if (score >= 60) return { label: 'Advanced', color: '#A78BFA' };
  if (score >= 40) return { label: 'Intermediate', color: '#34D399' };
  if (score >= 20) return { label: 'Improving', color: '#378ADD' };
  return { label: 'Learner', color: '#6B7280' };
}

// Filter out internal eligibility flags from the display list
const DISPLAY_ACHIEVEMENTS = ACHIEVEMENTS.filter((a) => !a.id.endsWith('_eligible'));

export default function ProgressScreen() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadUserProgress().then((p) => {
      setProgress(p);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return null;

  const hasActivity = progress !== null && progress.totalQuestionsAnswered > 0;

  if (!hasActivity) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No activity yet</Text>
        <Text style={styles.emptyBody}>
          Start practising to see your progress here
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => router.push('/(tabs)/practice')}
          activeOpacity={0.85}
        >
          <Text style={styles.emptyButtonText}>Start Practising</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const recentTests = [...progress.mockTestHistory]
    .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())
    .slice(0, 5);

  const topics = Object.values(TopicCategory);
  const rank = getRank(progress.readinessScore);

  const unlockedIds = new Set(progress.achievements ?? []);
  const unlockedCount = DISPLAY_ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id)).length;

  // Pair achievements into rows of 2
  const achievementPairs: [Achievement, Achievement | null][] = [];
  for (let i = 0; i < DISPLAY_ACHIEVEMENTS.length; i += 2) {
    achievementPairs.push([
      DISPLAY_ACHIEVEMENTS[i],
      DISPLAY_ACHIEVEMENTS[i + 1] ?? null,
    ]);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Your Progress</Text>

      <View style={[styles.rankBadge, { borderColor: rank.color }]}>
        <Text style={[styles.rankText, { color: rank.color }]}>{rank.label}</Text>
      </View>

      <View style={styles.goalCard}>
        <Text style={styles.goalCardLabel}>YOUR GOAL</Text>
        <Text style={styles.goalTarget}>Target: Pass by {goalDate()}</Text>
        <View style={styles.goalBarTrack}>
          <View
            style={[
              styles.goalBarFill,
              { width: `${Math.min(progress.readinessScore, 100)}%` as any },
            ]}
          />
        </View>
        <Text
          style={[
            styles.goalStatus,
            { color: progress.readinessScore >= 80 ? '#34D399' : '#6B7280' },
          ]}
        >
          {progress.readinessScore >= 80
            ? "You're ready to book your test!"
            : "Keep practising - you're getting there!"}
        </Text>
      </View>

      <View style={styles.statGrid}>
        <View style={[styles.statCard, styles.statQuestions]}>
          <Text style={styles.statEmoji}>{'📝'}</Text>
          <Text style={styles.statValue}>{progress.totalQuestionsAnswered}</Text>
          <Text style={styles.statLabel}>{'Questions\nAnswered'}</Text>
        </View>
        <View style={[styles.statCard, styles.statMocks]}>
          <Text style={styles.statEmoji}>{'📋'}</Text>
          <Text style={styles.statValue}>{progress.mockTestHistory.length}</Text>
          <Text style={styles.statLabel}>{'Mock Tests\nTaken'}</Text>
        </View>
        <View style={[styles.statCard, styles.statStreak]}>
          <Text style={styles.statEmoji}>{'🔥'}</Text>
          <Text style={styles.statValue}>{progress.studyStreakDays}</Text>
          <Text style={styles.statLabel}>{'Day\nStreak'}</Text>
        </View>
        <View style={[styles.statCard, styles.statBest]}>
          <Text style={styles.statEmoji}>{'🏆'}</Text>
          <Text style={[styles.statValue, styles.statValueSmall]}>
            {bestScore(progress.mockTestHistory)}
          </Text>
          <Text style={styles.statLabel}>{'Best Mock\nScore'}</Text>
        </View>
      </View>

      {/* Achievements */}
      <View style={styles.achievementsHeader}>
        <Text style={styles.sectionLabel}>ACHIEVEMENTS</Text>
        <Text style={styles.achievementsCount}>
          {unlockedCount}{' / '}{DISPLAY_ACHIEVEMENTS.length}{' unlocked'}
        </Text>
      </View>

      <View style={styles.achievementGrid}>
        {achievementPairs.map(([a, b], rowIdx) => (
          <View key={rowIdx} style={styles.achievementRow}>
            <AchievementCard achievement={a} unlocked={unlockedIds.has(a.id)} />
            {b ? (
              <AchievementCard achievement={b} unlocked={unlockedIds.has(b.id)} />
            ) : (
              <View style={styles.achievementCardPlaceholder} />
            )}
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Topic Mastery</Text>
      <View style={styles.topicList}>
        {topics.map((cat) => {
          const pct = progress.topicScores[cat] ?? 0;
          const color = barColor(pct);
          return (
            <View key={cat} style={styles.topicRow}>
              <View style={styles.topicHeader}>
                <Text style={styles.topicName}>{TOPIC_LABELS[cat]}</Text>
                <Text style={[styles.topicPct, { color }]}>{pct}{'%'}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct}%` as any, backgroundColor: color },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {recentTests.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Recent Mock Tests</Text>
          <View style={styles.sessionList}>
            {recentTests.map((test) => (
              <View key={test.id} style={styles.sessionCard}>
                <View style={styles.sessionRow}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionDate}>{formatDate(test.takenAt)}</Text>
                    <Text style={styles.sessionDuration}>
                      {formatDuration(test.timeTakenSeconds)}
                    </Text>
                  </View>
                  <View style={styles.sessionRight}>
                    <Text style={styles.sessionScore}>{test.score}{' / 50'}</Text>
                    <View
                      style={[
                        styles.badge,
                        test.passed ? styles.badgePass : styles.badgeFail,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          test.passed ? styles.badgePassText : styles.badgeFailText,
                        ]}
                      >
                        {test.passed ? 'PASS' : 'FAIL'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function AchievementCard({
  achievement,
  unlocked,
}: {
  achievement: Achievement;
  unlocked: boolean;
}) {
  return (
    <View style={[styles.achievementCard, unlocked ? styles.achievementUnlocked : styles.achievementLocked]}>
      <View style={styles.achievementCardTop}>
        {unlocked ? (
          <View />
        ) : (
          <Text style={styles.achievementLockedText}>LOCKED</Text>
        )}
        <View style={[styles.achievementXpBadge, unlocked ? styles.achievementXpBadgeUnlocked : styles.achievementXpBadgeLocked]}>
          <Text style={[styles.achievementXpText, unlocked ? styles.achievementXpTextUnlocked : styles.achievementXpTextLocked]}>
            {'+' + achievement.xpReward + ' XP'}
          </Text>
        </View>
      </View>
      <Text
        style={[
          styles.achievementTitle,
          unlocked ? styles.achievementTitleUnlocked : styles.achievementTitleLocked,
        ]}
        numberOfLines={1}
      >
        {achievement.title}
      </Text>
      <Text
        style={[
          styles.achievementDesc,
          unlocked ? styles.achievementDescUnlocked : styles.achievementDescLocked,
        ]}
        numberOfLines={2}
      >
        {achievement.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0A0A0F' },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#0A0A0F',
  },

  emptyContainer: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#F1F0FF' },
  emptyBody: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  emptyButton: {
    marginTop: 8,
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  screenTitle: { fontSize: 26, fontWeight: '800', color: '#F1F0FF', marginBottom: 12 },

  rankBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
    backgroundColor: '#13131A',
  },
  rankText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  goalCard: {
    backgroundColor: '#13131A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    borderLeftWidth: 3,
    borderLeftColor: '#A78BFA',
  },
  goalCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 6,
  },
  goalTarget: { fontSize: 16, fontWeight: '700', color: '#F1F0FF', marginBottom: 12 },
  goalBarTrack: {
    height: 8,
    backgroundColor: '#1C1C27',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  goalBarFill: { height: 8, backgroundColor: '#A78BFA', borderRadius: 4 },
  goalStatus: { fontSize: 13, fontWeight: '600' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  statCard: {
    flex: 1,
    minWidth: '44%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#13131A',
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    borderTopWidth: 3,
  },
  statQuestions: { borderTopColor: '#F87171' },
  statMocks: { borderTopColor: '#A78BFA' },
  statStreak: { borderTopColor: '#FBBF24' },
  statBest: { borderTopColor: '#34D399' },
  statEmoji: { fontSize: 24, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#F1F0FF', marginBottom: 4 },
  statValueSmall: { fontSize: 20 },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500', textAlign: 'center' },

  // Achievements
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  achievementsCount: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  achievementGrid: { gap: 10, marginBottom: 28 },
  achievementRow: { flexDirection: 'row', gap: 10 },
  achievementCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  achievementCardPlaceholder: { flex: 1 },
  achievementUnlocked: {
    backgroundColor: '#13131A',
    borderColor: '#A78BFA',
    borderWidth: 1,
  },
  achievementLocked: {
    backgroundColor: '#0D0D12',
    borderColor: '#1F1F2E',
  },
  achievementCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  achievementLockedText: { fontSize: 10, fontWeight: '700', color: '#374151', letterSpacing: 1 },
  achievementXpBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
  },
  achievementXpBadgeUnlocked: { backgroundColor: '#1C1C27', borderColor: '#7B5EA7' },
  achievementXpBadgeLocked: { backgroundColor: '#0D0D12', borderColor: '#1F1F2E' },
  achievementXpText: { fontSize: 10, fontWeight: '700' },
  achievementXpTextUnlocked: { color: '#A78BFA' },
  achievementXpTextLocked: { color: '#374151' },
  achievementTitle: { fontWeight: '700', marginBottom: 4 },
  achievementTitleUnlocked: { color: '#F1F0FF', fontSize: 15 },
  achievementTitleLocked: { color: '#374151', fontSize: 13 },
  achievementDesc: { fontSize: 11, lineHeight: 16 },
  achievementDescUnlocked: { color: '#6B7280' },
  achievementDescLocked: { color: '#1F1F2E' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  topicList: { gap: 10, marginBottom: 28 },
  topicRow: {
    backgroundColor: '#13131A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  topicName: { fontSize: 14, fontWeight: '600', color: '#F1F0FF', flex: 1 },
  topicPct: { fontSize: 13, fontWeight: '700', marginLeft: 8 },
  barTrack: { height: 6, backgroundColor: '#1C1C27', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },

  sessionList: { gap: 10 },
  sessionCard: {
    backgroundColor: '#13131A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
  },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionInfo: { flex: 1 },
  sessionDate: { fontSize: 15, fontWeight: '700', color: '#6B7280', marginBottom: 2 },
  sessionDuration: { fontSize: 12, color: '#374151' },
  sessionRight: { alignItems: 'flex-end', gap: 6 },
  sessionScore: { fontSize: 18, fontWeight: '800', color: '#F1F0FF' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgePass: { backgroundColor: '#064E3B' },
  badgeFail: { backgroundColor: '#450A0A' },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  badgePassText: { color: '#34D399' },
  badgeFailText: { color: '#F87171' },
});
