import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MockTestResult, TopicCategory, UserProgress } from '@clearpass/core';
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

function barColor(pct: number): string {
  if (pct >= 80) return '#16A34A';
  if (pct >= 50) return '#F59E0B';
  return '#DC2626';
}

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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Your Progress</Text>

      {/* 2x2 stat grid */}
      <View style={styles.statGrid}>
        <View style={[styles.statCard, styles.statBlue]}>
          <Text style={styles.statValue}>{progress.totalQuestionsAnswered}</Text>
          <Text style={styles.statLabel}>Questions{'\n'}Answered</Text>
        </View>
        <View style={[styles.statCard, styles.statGreen]}>
          <Text style={styles.statValue}>{progress.mockTestHistory.length}</Text>
          <Text style={styles.statLabel}>Mock Tests{'\n'}Taken</Text>
        </View>
        <View style={[styles.statCard, styles.statAmber]}>
          <Text style={styles.statValue}>{progress.studyStreakDays}</Text>
          <Text style={styles.statLabel}>Day{'\n'}Streak</Text>
        </View>
        <View style={[styles.statCard, styles.statNavy]}>
          <Text style={[styles.statValue, styles.statValueLight]}>
            {bestScore(progress.mockTestHistory)}
          </Text>
          <Text style={[styles.statLabel, styles.statLabelLight]}>
            Best Mock{'\n'}Score
          </Text>
        </View>
      </View>

      {/* Topic mastery */}
      <Text style={styles.sectionLabel}>Topic Mastery</Text>
      <View style={styles.topicList}>
        {topics.map((cat) => {
          const pct = progress.topicScores[cat] ?? 0;
          const color = barColor(pct);
          return (
            <View key={cat} style={styles.topicRow}>
              <View style={styles.topicHeader}>
                <Text style={styles.topicName}>{TOPIC_LABELS[cat]}</Text>
                <Text style={[styles.topicPct, { color }]}>{pct}%</Text>
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

      {/* Recent mock tests */}
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
                    <Text style={styles.sessionScore}>{test.score} / 50</Text>
                    <View
                      style={[
                        styles.badge,
                        test.passed ? styles.badgePass : styles.badgeFail,
                      ]}
                    >
                      <Text style={styles.badgeText}>
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

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#F5F5F5',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyBody: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: 8,
    backgroundColor: '#012169',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Header
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 20,
  },

  // Stat grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statBlue: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  statGreen: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statAmber: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  statNavy: {
    backgroundColor: '#012169',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  statValueLight: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  statLabelLight: {
    color: '#A5B4CC',
  },

  // Section heading
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Topic mastery
  topicList: {
    gap: 10,
    marginBottom: 28,
  },
  topicRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  topicName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  topicPct: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  barTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },

  // Recent mock tests
  sessionList: {
    gap: 10,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  sessionDuration: {
    fontSize: 12,
    color: '#94A3B8',
  },
  sessionRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  sessionScore: {
    fontSize: 18,
    fontWeight: '800',
    color: '#012169',
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgePass: {
    backgroundColor: '#DCFCE7',
  },
  badgeFail: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 0.5,
  },
});
