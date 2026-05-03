import React, { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  UserProgress,
  generateDailyChallenge,
  getXpLevel,
} from '@clearpass/core';
import {
  createFreshUserProgress,
  loadUserProgress,
  saveUserProgress,
  syncPendingUsername,
} from '@/src/storage';
import { supabase } from '@/src/supabase';

const DAILY_TIPS = [
  "Stopping distance at 70mph is 96 metres - that's 24 car lengths!",
  'Over 50% of learners fail their theory test first time. Practice daily to beat the odds.',
  'The hazard perception test has 14 clips. You need 44 out of 75 to pass.',
];

function parseDdMmYyyy(input: string): string | null {
  const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = parseInt(match[3], 10);
  const d = new Date(year, month, day);
  if (isNaN(d.getTime()) || d.getMonth() !== month) return null;
  return d.toISOString();
}

function getDaysRemaining(testDateIso: string): number {
  const now = new Date();
  const test = new Date(testDateIso);
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const testDay = new Date(test.getFullYear(), test.getMonth(), test.getDate());
  return Math.round((testDay.getTime() - nowDay.getTime()) / 86400000);
}

export default function HomeScreen() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    void (async () => {
      const raw = await loadUserProgress();
      const p = raw ?? createFreshUserProgress();

      const today = new Date().toISOString().split('T')[0];
      let updated = p;
      if (!p.dailyChallenge || p.dailyChallenge.date !== today) {
        const fresh = generateDailyChallenge(new Date());
        updated = { ...p, dailyChallenge: fresh };
        if (raw !== null) await saveUserProgress(updated);
      }
      setProgress(updated);
    })();

    void (async () => {
      await syncPendingUsername();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      if (profile?.username) setUsername(profile.username as string);
    })();
  }, []);

  function handleOpenModal() {
    const current = progress?.testDate;
    if (current) {
      const d = new Date(current);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = String(d.getFullYear());
      setDateInput(`${dd}/${mm}/${yyyy}`);
    } else {
      setDateInput('');
    }
    setDateError('');
    setShowDateModal(true);
  }

  async function handleSaveDate() {
    const parsed = parseDdMmYyyy(dateInput.trim());
    if (!parsed) {
      setDateError('Enter a valid date in DD/MM/YYYY format');
      return;
    }
    setDateError('');
    const updated = { ...(progress!), testDate: parsed };
    setProgress(updated);
    await saveUserProgress(updated);
    setShowDateModal(false);
  }

  const xp = progress?.xp ?? 0;
  const xpData = getXpLevel(xp);
  const streak = progress?.studyStreakDays ?? 0;
  const tip = DAILY_TIPS[new Date().getDay() % 3];

  const xpBadgeLabel =
    xpData.level === 5 ? 'TEST READY' : `LEVEL ${xpData.level}`;
  const xpMsg =
    xpData.level === 5
      ? "You're ready to book your test!"
      : `${xpData.xpForNext - xp} XP to Level ${xpData.level + 1} - ${xpData.label}`;

  const testDate = progress?.testDate ?? null;
  const daysLeft = testDate ? getDaysRemaining(testDate) : null;

  let countdownMsg = '';
  let countdownColor = '#34D399';
  if (daysLeft !== null) {
    if (daysLeft <= 0) {
      countdownMsg = 'Good luck on your test today!';
      countdownColor = '#A78BFA';
    } else if (daysLeft <= 7) {
      countdownMsg = 'Almost there! Make sure you are ready!';
      countdownColor = '#F87171';
    } else if (daysLeft <= 30) {
      countdownMsg = 'Keep practising hard!';
      countdownColor = '#FBBF24';
    } else {
      countdownMsg = 'You have got plenty of time - stay consistent!';
      countdownColor = '#34D399';
    }
  }

  const dc = progress?.dailyChallenge ?? null;
  const dcPct =
    dc && dc.targetCount > 0
      ? Math.min((dc.currentCount / dc.targetCount) * 100, 100)
      : 0;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          {'Hey, '}{username ? username + '!' : 'there!'}
        </Text>
      </View>

      {/* XP Card */}
      <View style={styles.xpCard}>
        <Text style={styles.xpDecorCar}>{'🚗'}</Text>
        <View style={styles.xpTopRow}>
          <View style={styles.xpBadge}>
            <Text style={styles.xpBadgeText}>{xpBadgeLabel}</Text>
          </View>
          <Text style={styles.xpScore}>{xp}</Text>
        </View>
        <View style={styles.xpBarTrack}>
          <View
            style={[
              styles.xpBarFill,
              { width: `${Math.round(xpData.pct * 100)}%` as any },
            ]}
          />
        </View>
        <Text style={styles.xpMsg}>{xpMsg}</Text>
      </View>

      {/* Streak Banner */}
      {streak > 0 && (
        <View style={styles.streakBanner}>
          <Text style={styles.streakLabel}>STREAK</Text>
          <Text style={styles.streakNum}>{streak}</Text>
          <Text style={styles.streakDays}>days</Text>
        </View>
      )}

      {/* Test Date Countdown */}
      {daysLeft !== null && daysLeft >= 0 && (
        <View style={styles.countdownCard}>
          <View style={styles.countdownTop}>
            <Text style={styles.countdownLabel}>YOUR TEST</Text>
            <TouchableOpacity onPress={handleOpenModal}>
              <Text style={styles.countdownChange}>Change date</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.countdownBody}>
            <Text style={styles.countdownDays}>{daysLeft}</Text>
            <Text style={styles.countdownDaysLabel}>days to go</Text>
          </View>
          <Text style={[styles.countdownMsg, { color: countdownColor }]}>
            {countdownMsg}
          </Text>
        </View>
      )}

      {/* Set test date link (when no date set) */}
      {!testDate && (
        <TouchableOpacity style={styles.setDateRow} onPress={handleOpenModal}>
          <Text style={styles.setDateText}>Set your test date</Text>
        </TouchableOpacity>
      )}

      {/* Action Grid */}
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

      {/* Daily Challenge Card */}
      {dc && (
        <View style={[styles.dcCard, dc.completed && styles.dcCardComplete]}>
          <View style={styles.dcTopRow}>
            <Text style={styles.dcLabel}>DAILY CHALLENGE</Text>
            {dc.completed && (
              <View style={styles.dcCompleteBadge}>
                <Text style={styles.dcCompleteText}>COMPLETE</Text>
              </View>
            )}
            <View style={styles.dcXpBadge}>
              <Text style={styles.dcXpText}>{'+'}{dc.xpReward}{' XP'}</Text>
            </View>
          </View>
          <Text style={[styles.dcDesc, dc.completed && styles.dcDescComplete]}>
            {dc.description}
          </Text>
          <View style={styles.dcBarTrack}>
            <View style={[styles.dcBarFill, { width: `${dcPct}%` as any }]} />
          </View>
          <Text style={styles.dcProgress}>
            {dc.currentCount}{' / '}{dc.targetCount}
          </Text>
        </View>
      )}

      {/* Tip Card */}
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>DID YOU KNOW?</Text>
        <Text style={styles.tipBody}>{tip}</Text>
      </View>

      {/* Test Date Modal */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set Test Date</Text>
            <Text style={styles.modalSub}>Enter your test date in DD/MM/YYYY format</Text>
            <TextInput
              style={styles.dateInput}
              value={dateInput}
              onChangeText={setDateInput}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#374151"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            {dateError.length > 0 && (
              <Text style={styles.dateError}>{dateError}</Text>
            )}
            <TouchableOpacity style={styles.modalSave} onPress={() => void handleSaveDate()} activeOpacity={0.85}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDateModal(false)} activeOpacity={0.85}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { flexGrow: 1, paddingBottom: 40 },

  // Greeting
  greeting: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  greetingText: { fontSize: 22, fontWeight: '800', color: '#F1F0FF' },

  // XP Card
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
  xpBarFill: { height: 6, backgroundColor: '#A78BFA', borderRadius: 3 },
  xpMsg: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  // Streak Banner
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
  streakLabel: { fontSize: 11, fontWeight: '700', color: '#FBBF24', letterSpacing: 1 },
  streakNum: { fontSize: 22, fontWeight: '900', color: '#F1F0FF' },
  streakDays: { fontSize: 12, color: '#6B7280' },

  // Countdown Card
  countdownCard: {
    backgroundColor: '#13131A',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    borderTopWidth: 3,
    borderTopColor: '#FBBF24',
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 16,
  },
  countdownTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  countdownLabel: { fontSize: 11, fontWeight: '700', color: '#FBBF24', letterSpacing: 1 },
  countdownChange: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  countdownBody: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  countdownDays: { fontSize: 48, fontWeight: '900', color: '#F1F0FF', lineHeight: 56 },
  countdownDaysLabel: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
  countdownMsg: { fontSize: 13, fontWeight: '600' },

  // Set date link
  setDateRow: {
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 8,
  },
  setDateText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  // Action Grid
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
  actionEmoji: { fontSize: 28, marginBottom: 8 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: '#F1F0FF', marginBottom: 2 },
  actionSub: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  // Daily Challenge Card
  dcCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#13131A',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    borderTopWidth: 3,
    borderTopColor: '#34D399',
    padding: 16,
  },
  dcCardComplete: { opacity: 0.6 },
  dcTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dcLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: 1,
    flex: 1,
  },
  dcCompleteBadge: {
    backgroundColor: '#064E3B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dcCompleteText: { fontSize: 10, fontWeight: '800', color: '#34D399', letterSpacing: 0.5 },
  dcXpBadge: {
    backgroundColor: '#1C1C27',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: '#34D399',
  },
  dcXpText: { fontSize: 11, fontWeight: '700', color: '#34D399' },
  dcDesc: { fontSize: 14, fontWeight: '600', color: '#F1F0FF', marginBottom: 10, lineHeight: 20 },
  dcDescComplete: { color: '#6B7280' },
  dcBarTrack: {
    height: 6,
    backgroundColor: '#1C1C27',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 6,
  },
  dcBarFill: { height: 6, backgroundColor: '#34D399', borderRadius: 3 },
  dcProgress: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  // Tip Card
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
  tipBody: { fontSize: 13, color: '#6B7280', lineHeight: 20 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#13131A',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F1F0FF',
    marginBottom: 6,
  },
  modalSub: { fontSize: 14, color: '#6B7280', marginBottom: 16, lineHeight: 20 },
  dateInput: {
    backgroundColor: '#1C1C27',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F1F2E',
    color: '#F1F0FF',
    fontSize: 18,
    fontWeight: '600',
    padding: 14,
    marginBottom: 8,
    letterSpacing: 2,
  },
  dateError: { fontSize: 13, color: '#F87171', marginBottom: 10 },
  modalSave: {
    backgroundColor: '#7B5EA7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  modalSaveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalCancel: {
    backgroundColor: '#13131A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F1F2E',
  },
  modalCancelText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
});
