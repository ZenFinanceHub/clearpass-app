import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { UserProgress } from '@clearpass/core';
import { loadUserProgress } from '@/src/storage';

export default function HomeScreen() {
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    loadUserProgress().then(setProgress);
  }, []);

  const score = progress?.readinessScore ?? 0;
  const hasActivity = score > 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* Greeting */}
      <View style={styles.greetingRow}>
        <Text style={styles.greeting}>Hey there!</Text>
      </View>

      {/* Score banner */}
      <View style={styles.scoreSection}>
        <Text style={styles.scoreSectionLabel}>Your Readiness Score</Text>
        <View style={styles.scoreCircle}>
          <Text style={styles.scoreNumber}>{score}</Text>
          <Text style={styles.scoreOutOf}>/ 100</Text>
        </View>
        <Text style={styles.scoreHint}>
          {hasActivity
            ? score >= 80
              ? "You're ready to book!"
              : "Keep practising - you're almost ready!"
            : 'Answer some questions to see your score'}
        </Text>
      </View>

      {/* Quick actions */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity
          style={[styles.actionCard, styles.actionCardPrimary]}
          onPress={() => router.push('/(tabs)/practice')}
          activeOpacity={0.85}
        >
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Start Practice</Text>
            <Text style={[styles.actionSub, styles.actionSubLight]}>Random questions from all topics</Text>
          </View>
          <Text style={styles.actionChevron}>{'>'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.actionCardSecondary]}
          onPress={() => router.push('/(tabs)/mock')}
          activeOpacity={0.85}
        >
          <View style={styles.actionText}>
            <Text style={[styles.actionTitle, styles.actionTitleDark]}>Take Mock Test</Text>
            <Text style={styles.actionSub}>50 questions - 57 minutes</Text>
          </View>
          <Text style={[styles.actionChevron, styles.actionChevronDark]}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row (only once user has answered questions) */}
      {progress && progress.totalQuestionsAnswered > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{progress.totalQuestionsAnswered}</Text>
            <Text style={styles.statLabel}>Questions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{progress.studyStreakDays}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{progress.mockTestHistory.length}</Text>
            <Text style={styles.statLabel}>Mock tests</Text>
          </View>
        </View>
      )}
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
  greetingRow: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6C63FF',
  },
  scoreSection: {
    backgroundColor: '#012169',
    paddingTop: 28,
    paddingBottom: 44,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  scoreSectionLabel: {
    color: '#A5B4CC',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  scoreCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 6,
    borderColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 60,
  },
  scoreOutOf: {
    fontSize: 16,
    color: '#A5B4CC',
    fontWeight: '500',
  },
  scoreHint: {
    color: '#A5B4CC',
    fontSize: 14,
    textAlign: 'center',
  },
  actionsSection: {
    padding: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 18,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  actionCardPrimary: {
    backgroundColor: '#6C63FF',
  },
  actionCardSecondary: {
    backgroundColor: '#FFFFFF',
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  actionTitleDark: {
    color: '#1E293B',
  },
  actionSub: {
    fontSize: 13,
    color: '#94A3B8',
  },
  actionSubLight: {
    color: 'rgba(255,255,255,0.7)',
  },
  actionChevron: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  actionChevronDark: {
    color: '#CBD5E1',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#6C63FF',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 2,
  },
});
