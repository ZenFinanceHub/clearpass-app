import React, { useEffect, useState } from 'react';
import {
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
  ACHIEVEMENTS,
  Achievement,
  MockTestResult,
  TopicCategory,
  UserProgress,
} from '@clearpass/core';
import { loadUserProgress } from '@/src/storage';
import { useTheme } from '@/src/theme';

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
  if (pct >= 80) return '#6366F1';
  if (pct >= 50) return '#F59E0B';
  return '#EF4444';
}

function getRank(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Test Ready!', color: '#F59E0B' };
  if (score >= 60) return { label: 'Advanced', color: '#6366F1' };
  if (score >= 40) return { label: 'Intermediate', color: '#0D9488' };
  if (score >= 20) return { label: 'Improving', color: '#3B82F6' };
  return { label: 'Learner', color: '#9CA3AF' };
}

const DISPLAY_ACHIEVEMENTS = ACHIEVEMENTS.filter((a) => !a.id.endsWith('_eligible'));

export default function ProgressScreen() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loaded, setLoaded] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    loadUserProgress().then((p) => {
      setProgress(p);
      setLoaded(true);
    });
  }, []);

  async function handleUpgrade() {
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

  if (!loaded) return null;

  const hasActivity = progress !== null && progress.totalQuestionsAnswered > 0;

  if (!hasActivity) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.emptyTitle, { fontSize: theme.fontSize(20), fontFamily: theme.fontFamily, color: theme.textColor }]}>No activity yet</Text>
        <Text style={[styles.emptyBody, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(22), color: theme.subTextColor }]}>
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

  const achievementPairs: [Achievement, Achievement | null][] = [];
  for (let i = 0; i < DISPLAY_ACHIEVEMENTS.length; i += 2) {
    achievementPairs.push([
      DISPLAY_ACHIEVEMENTS[i],
      DISPLAY_ACHIEVEMENTS[i + 1] ?? null,
    ]);
  }

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={[styles.content, { backgroundColor: theme.backgroundColor }]}>
      <Text style={[styles.screenTitle, { fontSize: theme.fontSize(26), fontFamily: theme.fontFamily, color: theme.textColor }]}>Your Progress</Text>

      {!(progress.isPro ?? false) && (
        <TouchableOpacity style={styles.proBanner} onPress={() => void handleUpgrade()} activeOpacity={0.85}>
          <View style={styles.proBannerContent}>
            <Text style={styles.proBannerTitle}>Go Pro for £4.99</Text>
            <Text style={styles.proBannerSub}>Unlock unlimited questions, AI tutor and more</Text>
          </View>
          <Text style={styles.proBannerArrow}>{'→'}</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.rankBadge, { borderColor: rank.color }]}>
        <Text style={[styles.rankText, { color: rank.color }]}>{rank.label}</Text>
      </View>

      <View style={styles.goalCard}>
        <Text style={styles.goalCardLabel}>YOUR GOAL</Text>
        <Text style={[styles.goalTarget, { fontSize: theme.fontSize(16), fontFamily: theme.fontFamily, color: theme.textColor }]}>Target: Pass by {goalDate()}</Text>
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
            { color: progress.readinessScore >= 80 ? '#0D9488' : '#6B7280' },
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
                <Text style={[styles.topicName, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, color: theme.textColor }]}>{TOPIC_LABELS[cat]}</Text>
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
  const theme = useTheme();
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
          { fontFamily: theme.fontFamily, fontSize: theme.fontSize(unlocked ? 15 : 13) },
        ]}
        numberOfLines={1}
      >
        {achievement.title}
      </Text>
      <Text
        style={[
          styles.achievementDesc,
          unlocked ? styles.achievementDescUnlocked : styles.achievementDescLocked,
          { fontFamily: theme.fontFamily, fontSize: theme.fontSize(11), letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(16) },
        ]}
        numberOfLines={2}
      >
        {achievement.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  emptyBody: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  emptyButton: {
    marginTop: 8,
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  screenTitle: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 12 },

  rankBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  rankText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  goalCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 6,
  },
  goalTarget: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  goalBarTrack: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  goalBarFill: { height: 8, backgroundColor: '#0D9488', borderRadius: 4 },
  goalStatus: { fontSize: 13, fontWeight: '600' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  statCard: {
    flex: 1,
    minWidth: '44%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderTopWidth: 3,
  },
  statQuestions: { borderTopColor: '#EF4444' },
  statMocks: { borderTopColor: '#6366F1' },
  statStreak: { borderTopColor: '#F59E0B' },
  statBest: { borderTopColor: '#10B981' },
  statEmoji: { fontSize: 24, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 4 },
  statValueSmall: { fontSize: 20 },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500', textAlign: 'center' },

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
    backgroundColor: '#FFFFFF',
    borderColor: '#6366F1',
  },
  achievementLocked: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  achievementCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  achievementLockedText: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1 },
  achievementXpBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
  },
  achievementXpBadgeUnlocked: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  achievementXpBadgeLocked: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  achievementXpText: { fontSize: 10, fontWeight: '700' },
  achievementXpTextUnlocked: { color: '#6366F1' },
  achievementXpTextLocked: { color: '#9CA3AF' },
  achievementTitle: { fontWeight: '700', marginBottom: 4 },
  achievementTitleUnlocked: { color: '#111827', fontSize: 15 },
  achievementTitleLocked: { color: '#9CA3AF', fontSize: 13 },
  achievementDesc: { fontSize: 11, lineHeight: 16 },
  achievementDescUnlocked: { color: '#6B7280' },
  achievementDescLocked: { color: '#E5E7EB' },

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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  topicName: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  topicPct: { fontSize: 13, fontWeight: '700', marginLeft: 8 },
  barTrack: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },

  sessionList: { gap: 10 },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionInfo: { flex: 1 },
  sessionDate: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  sessionDuration: { fontSize: 12, color: '#6B7280' },
  sessionRight: { alignItems: 'flex-end', gap: 6 },
  sessionScore: { fontSize: 18, fontWeight: '800', color: '#111827' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgePass: { backgroundColor: '#ECFDF5' },
  badgeFail: { backgroundColor: '#FEF2F2' },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  badgePassText: { color: '#0D9488' },
  badgeFailText: { color: '#EF4444' },

  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  proBannerContent: { flex: 1 },
  proBannerTitle: { fontSize: 15, fontWeight: '800', color: '#D97706', marginBottom: 2 },
  proBannerSub: { fontSize: 12, color: '#6B7280' },
  proBannerArrow: { fontSize: 18, color: '#D97706', fontWeight: '700', marginLeft: 8 },
});
