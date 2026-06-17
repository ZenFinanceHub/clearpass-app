import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { allQuestions } from '@clearpass/content';
import { TopicCategory } from '@clearpass/core';
import type { UserProgress, MockTestResult } from '@clearpass/core';
import type { SessionHistoryEntry } from '@/src/storage';
import { Colors } from '@/src/constants/theme';

// ── Demo data ─────────────────────────────────────────────────────────────────

function makeDemoProgress(): UserProgress {
  const testDate = new Date(Date.now() + 21 * 86400000).toISOString();
  return {
    userId: 'local_user',
    topicScores: {
      [TopicCategory.Alertness]:               85,
      [TopicCategory.Attitude]:                62,
      [TopicCategory.SafetyAndYourVehicle]:    70,
      [TopicCategory.SafetyMargins]:           78,
      [TopicCategory.HazardAwareness]:         55,
      [TopicCategory.VulnerableRoadUsers]:     44,
      [TopicCategory.OtherTypes]:              38,
      [TopicCategory.VehicleHandling]:         69,
      [TopicCategory.MotorwayRules]:           82,
      [TopicCategory.RulesOfTheRoad]:          73,
      [TopicCategory.RoadAndTrafficSigns]:     88,
      [TopicCategory.DocumentsAndRegulations]: 51,
      [TopicCategory.AccidentsAndEmergencies]: 47,
      [TopicCategory.VehicleLoading]:          60,
    },
    totalQuestionsAnswered: 156,
    mockTestHistory: [
      { id: 'mock1', score: 38, passed: false, takenAt: new Date(Date.now() - 14 * 86400000).toISOString(), timeTakenSeconds: 2840 },
      { id: 'mock2', score: 43, passed: true,  takenAt: new Date(Date.now() - 7  * 86400000).toISOString(), timeTakenSeconds: 2640 },
      { id: 'mock3', score: 46, passed: true,  takenAt: new Date(Date.now() - 3  * 86400000).toISOString(), timeTakenSeconds: 2510 },
    ] as MockTestResult[],
    readinessScore: 73,
    lastStudied: new Date().toISOString(),
    studyStreakDays: 12,
    xp: 847,
    achievements: [],
    dailyChallenge: null,
    testDate,
    battleModeHistory: [],
    isPro: true,
    dailyQuestionsAnswered: 0,
    hazardPerceptionHistory: [],
  };
}

function makeDemoSessions(): SessionHistoryEntry[] {
  const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();
  // 3 Alertness + 2 Road Signs + 3 Motorway = 8 sessions, seeds 3 badges
  return [
    { date: d(0),  score: 9,  total: 10, topic: 'Road & Traffic Signs', durationSeconds: 480 },
    { date: d(1),  score: 8,  total: 10, topic: 'Alertness',            durationSeconds: 510 },
    { date: d(2),  score: 9,  total: 10, topic: 'Motorway Rules',       durationSeconds: 520 },
    { date: d(3),  score: 10, total: 10, topic: 'Road & Traffic Signs', durationSeconds: 440 },
    { date: d(5),  score: 9,  total: 10, topic: 'Alertness',            durationSeconds: 490 },
    { date: d(7),  score: 8,  total: 10, topic: 'Motorway Rules',       durationSeconds: 530 },
    { date: d(9),  score: 8,  total: 10, topic: 'Alertness',            durationSeconds: 480 },
    { date: d(11), score: 8,  total: 10, topic: 'Motorway Rules',       durationSeconds: 540 },
  ];
}

const KEYS_TO_CLEAR = [
  '@clearpass/user_progress',
  '@clearpass/question_states',
  '@clearpass/bookmarks',
  '@clearpass/session_history',
  '@clearpass/pending_username',
  '@clearpass/sync_pending',
  '@clearpass/wrong_counts',
  '@clearpass/free_questions_answered',
  '@clearpass/test_result',
  '@clearpass/has_submitted_result',
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ScreenshotModeScreen() {
  const [status, setStatus] = useState('');

  async function handleSeed() {
    try {
      setStatus('Seeding...');
      const progress = makeDemoProgress();
      const sessions = makeDemoSessions();

      // 3 bookmarked question IDs (first 3 in the bank)
      const bookmarks = allQuestions.slice(0, 3).map(q => q.id);

      await Promise.all([
        AsyncStorage.setItem('@clearpass/user_progress',  JSON.stringify(progress)),
        AsyncStorage.setItem('@clearpass/session_history', JSON.stringify(sessions)),
        AsyncStorage.setItem('@clearpass/bookmarks',       JSON.stringify(bookmarks)),
      ]);

      setStatus('Done -- navigate to Home, Practice, or Progress to see the data.');
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    }
  }

  async function handleClear() {
    Alert.alert('Clear all data?', 'Wipes all local ClearPass data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(KEYS_TO_CLEAR);
          setStatus('Cleared.');
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.warning}>
        <Text style={styles.warningText}>{'[!] SCREENSHOT MODE -- DEV ONLY [!]'}</Text>
        <Text style={styles.warningSubtext}>{'Never shipped to real users'}</Text>
      </View>

      <Text style={styles.heading}>{'Demo Data Seeder'}</Text>
      <Text style={styles.body}>
        {'Seeds the following to AsyncStorage:\n'}
        {'  - 12-day streak, 847 XP, readiness 73%\n'}
        {'  - 156 questions answered, 3 mock tests\n'}
        {'  - 8 recent sessions (3 badges: Alertness, Road Signs, Motorway)\n'}
        {'  - 3 bookmarked questions\n'}
        {'  - Test date: 3 weeks away\n'}
        {'  - isPro: true\n\n'}
        {'Navigate to the screen you want to screenshot after seeding.'}
      </Text>

      <TouchableOpacity style={styles.seedBtn} onPress={() => void handleSeed()} activeOpacity={0.85}>
        <Text style={styles.seedBtnText}>{'SEED DEMO DATA'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.clearBtn} onPress={() => void handleClear()} activeOpacity={0.85}>
        <Text style={styles.clearBtnText}>{'CLEAR ALL DATA'}</Text>
      </TouchableOpacity>

      {status.length > 0 && (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { padding: 24, paddingTop: 60, gap: 16 },

  warning: {
    backgroundColor: '#FBBF24',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  warningText:    { fontSize: 14, fontWeight: '900', color: '#92400E', letterSpacing: 1 },
  warningSubtext: { fontSize: 12, color: '#92400E', fontWeight: '600' },

  heading: { fontSize: 24, fontWeight: '800', color: '#111827' },
  body:     { fontSize: 14, color: '#6B7280', lineHeight: 22 },

  seedBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  seedBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 1 },

  clearBtn: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  clearBtnText: { color: '#EF4444', fontSize: 17, fontWeight: '700' },

  statusBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  statusText: { fontSize: 13, color: '#374151', lineHeight: 20 },
});
