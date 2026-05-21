import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/src/supabase';
import { createFreshUserProgress } from '@/src/storage';
import {
  calculateReadiness,
  MockTestResult,
  TopicCategory,
  UserProgress,
} from '@clearpass/core';
import { useTheme } from '@/src/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type RelStatus = 'pending' | 'accepted' | 'rejected';

type Relationship = {
  id: string;
  instructor_id: string;
  learner_id: string | null;
  learner_email: string | null;
  learner_name: string | null;
  status: RelStatus;
  created_at: string;
  invite_code: string | null;
};

type LearnerEntry = {
  rel: Relationship;
  progress: UserProgress | null;
  username: string | null;
};

type EarningEntry = {
  id: string;
  learner_id: string;
  amount: number;
  status: string;
  created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPIC_LABELS: Record<TopicCategory, string> = {
  [TopicCategory.Alertness]: 'Alertness',
  [TopicCategory.Attitude]: 'Attitude',
  [TopicCategory.SafetyAndYourVehicle]: 'Safety & Vehicle',
  [TopicCategory.SafetyMargins]: 'Safety Margins',
  [TopicCategory.HazardAwareness]: 'Hazard Awareness',
  [TopicCategory.VulnerableRoadUsers]: 'Vulnerable Users',
  [TopicCategory.OtherTypes]: 'Other Vehicles',
  [TopicCategory.VehicleHandling]: 'Vehicle Handling',
  [TopicCategory.MotorwayRules]: 'Motorway Rules',
  [TopicCategory.RulesOfTheRoad]: 'Rules of the Road',
  [TopicCategory.RoadAndTrafficSigns]: 'Road Signs',
  [TopicCategory.DocumentsAndRegulations]: 'Documents',
  [TopicCategory.AccidentsAndEmergencies]: 'Accidents',
  [TopicCategory.VehicleLoading]: 'Vehicle Loading',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function probColor(pct: number): string {
  if (pct >= 70) return '#22C55E';
  if (pct >= 50) return '#F59E0B';
  return '#EF4444';
}

function barColor(pct: number): string {
  if (pct >= 80) return '#22C55E';
  if (pct >= 50) return '#F59E0B';
  return '#EF4444';
}

function bestMock(history: MockTestResult[]): number {
  if (!history.length) return 0;
  return Math.max(...history.map(r => r.score));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatLastActive(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'Active today';
  if (days === 1) return 'Active yesterday';
  return `Active ${days} days ago`;
}

function activityDots(progress: UserProgress): boolean[] {
  const now = new Date();
  const mockDates = new Set(progress.mockTestHistory.map(t => new Date(t.takenAt).toDateString()));
  const lastDate  = new Date(progress.lastStudied).toDateString();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    return ds === lastDate || mockDates.has(ds);
  });
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateReferralCode(username: string): string {
  const prefix = username.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  const digits = Math.floor(100 + Math.random() * 900).toString();
  return prefix + digits;
}

const PROXY_URL = __DEV__
  ? 'http://localhost:3001'
  : 'https://clearpass-app-production.up.railway.app';

// ─── LearnerCard ──────────────────────────────────────────────────────────────

function LearnerCard({ data, onPress }: { data: LearnerEntry; onPress: () => void }) {
  const theme    = useTheme();
  const { rel, progress, username } = data;
  const name     = username ?? rel.learner_name ?? rel.learner_email ?? 'Learner';
  const initials = getInitials(name);
  const readiness = progress?.readinessScore ?? 0;
  const color     = probColor(readiness);
  const streak    = progress?.studyStreakDays ?? 0;
  const totalQ    = progress?.totalQuestionsAnswered ?? 0;
  const best      = progress ? bestMock(progress.mockTestHistory) : 0;
  const weakTopics = progress ? calculateReadiness(progress).weakTopics.slice(0, 2) : [];
  const lastActive = progress ? formatLastActive(progress.lastStudied) : 'No activity yet';

  return (
    <TouchableOpacity
      style={[styles.learnerCard, { backgroundColor: theme.cardColor }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.learnerCardTop}>
        <View style={[styles.avatarCircle, { backgroundColor: '#0D9488' }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.learnerMeta}>
          <Text style={[styles.learnerName, { color: theme.textColor }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.learnerSub,  { color: theme.subTextColor }]}>{lastActive}</Text>
        </View>
        <View style={[styles.probBadge, { borderColor: color }]}>
          <Text style={[styles.probBadgeText, { color }]}>{readiness}{'%'}</Text>
        </View>
      </View>

      <View style={styles.learnerStats}>
        <Text style={[styles.statChip, { color: theme.subTextColor }]}>{'🔥 '}{streak}{'d'}</Text>
        <Text style={[styles.statChip, { color: theme.subTextColor }]}>{'📝 '}{totalQ}{' q'}</Text>
        {best > 0 && (
          <Text style={[styles.statChip, { color: theme.subTextColor }]}>{'🏆 '}{best}{'/50'}</Text>
        )}
      </View>

      {weakTopics.length > 0 && (
        <View style={styles.weakRow}>
          {weakTopics.map(cat => (
            <View key={cat} style={styles.weakBadge}>
              <Text style={styles.weakBadgeText}>{TOPIC_LABELS[cat]}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.learnerCardChevron}>{'View details  ›'}</Text>
    </TouchableOpacity>
  );
}

// ─── LearnerDetailView ────────────────────────────────────────────────────────

function LearnerDetailView({
  data,
  onBack,
  onEmailSummary,
}: {
  data: LearnerEntry;
  onBack: () => void;
  onEmailSummary: () => void;
}) {
  const theme    = useTheme();
  const { rel, progress, username } = data;
  const name     = username ?? rel.learner_name ?? rel.learner_email ?? 'Learner';
  const initials = getInitials(name);
  const readiness = progress?.readinessScore ?? 0;
  const color     = probColor(readiness);
  const streak    = progress?.studyStreakDays ?? 0;
  const totalQ    = progress?.totalQuestionsAnswered ?? 0;
  const mocks     = progress?.mockTestHistory ?? [];
  const best      = bestMock(mocks);
  const dots      = progress ? activityDots(progress) : Array(7).fill(false);
  const recentMocks = [...mocks].sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()).slice(0, 8);
  const topics    = Object.values(TopicCategory);
  const today     = new Date();

  function handleSendEncouragement() {
    Alert.alert(
      'Encouragement sent! 💪',
      `${name} will receive a motivational notification. (Push notifications to other devices require the full backend integration — coming soon.)`,
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.detailContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Back row */}
      <TouchableOpacity style={styles.backRow} onPress={onBack} activeOpacity={0.7}>
        <Text style={[styles.backArrow, { color: theme.textColor }]}>{'←'}</Text>
        <Text style={[styles.backLabel, { color: theme.subTextColor }]}>{'Your Learners'}</Text>
      </TouchableOpacity>

      {/* Learner header */}
      <View style={styles.detailHeader}>
        <View style={[styles.avatarCircleLg, { backgroundColor: '#0D9488' }]}>
          <Text style={styles.avatarTextLg}>{initials}</Text>
        </View>
        <Text style={[styles.detailName, { color: theme.textColor }]}>{name}</Text>
        <Text style={[styles.detailSub, { color: theme.subTextColor }]}>
          {progress ? formatLastActive(progress.lastStudied) : 'No activity recorded'}
        </Text>
      </View>

      {/* Pass probability */}
      <View style={[styles.probCard, { backgroundColor: theme.cardColor }]}>
        <Text style={styles.probCardLabel}>{'PASS PROBABILITY'}</Text>
        <View style={[styles.probCircle, { borderColor: color }]}>
          <Text style={[styles.probCircleValue, { color }]}>{readiness}{'%'}</Text>
          <Text style={[styles.probCircleSub, { color: theme.subTextColor }]}>
            {readiness >= 80 ? 'Test Ready' : readiness >= 50 ? 'Getting There' : 'Needs Work'}
          </Text>
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        {[
          { emoji: '📝', value: String(totalQ), label: 'Questions' },
          { emoji: '📋', value: String(mocks.length), label: 'Mocks Taken' },
          { emoji: '🏆', value: best > 0 ? `${best}/50` : '—', label: 'Best Score' },
          { emoji: '🔥', value: String(streak), label: 'Day Streak' },
        ].map(s => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: theme.cardColor }]}>
            <Text style={styles.statCardEmoji}>{s.emoji}</Text>
            <Text style={[styles.statCardValue, { color: theme.textColor }]}>{s.value}</Text>
            <Text style={[styles.statCardLabel, { color: theme.subTextColor }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Activity dots */}
      <View style={[styles.section, { backgroundColor: theme.cardColor }]}>
        <Text style={styles.sectionTitle}>{'LAST 7 DAYS'}</Text>
        <View style={styles.dotsRow}>
          {dots.map((active, i) => {
            const d = new Date(today);
            d.setDate(d.getDate() - (6 - i));
            return (
              <View key={i} style={styles.dotCol}>
                <View style={[styles.dot, active ? styles.dotActive : styles.dotInactive]} />
                <Text style={[styles.dotLabel, { color: theme.subTextColor }]}>
                  {['S','M','T','W','T','F','S'][d.getDay()]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Topic breakdown */}
      <View style={[styles.section, { backgroundColor: theme.cardColor }]}>
        <Text style={styles.sectionTitle}>{'TOPIC MASTERY'}</Text>
        {topics.map(cat => {
          const pct   = progress?.topicScores[cat] ?? 0;
          const color = barColor(pct);
          return (
            <View key={cat} style={styles.topicRow}>
              <View style={styles.topicLabelRow}>
                <Text style={[styles.topicName, { color: theme.textColor }]}>{TOPIC_LABELS[cat]}</Text>
                <Text style={[styles.topicPct, { color }]}>{pct}{'%'}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
              </View>
            </View>
          );
        })}
      </View>

      {/* Mock test history */}
      {recentMocks.length > 0 && (
        <View style={[styles.section, { backgroundColor: theme.cardColor }]}>
          <Text style={styles.sectionTitle}>{'MOCK TEST HISTORY'}</Text>
          {recentMocks.map(r => (
            <View key={r.id} style={styles.mockRow}>
              <View style={styles.mockRowLeft}>
                <Text style={[styles.mockDate, { color: theme.textColor }]}>{formatDate(r.takenAt)}</Text>
                <Text style={[styles.mockScore, { color: theme.subTextColor }]}>{r.score}{' / 50'}</Text>
              </View>
              <View style={[styles.mockBadge, { backgroundColor: r.passed ? '#F0FDF4' : '#FEF2F2', borderColor: r.passed ? '#22C55E' : '#EF4444' }]}>
                <Text style={[styles.mockBadgeText, { color: r.passed ? '#22C55E' : '#EF4444' }]}>
                  {r.passed ? 'PASS' : 'FAIL'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <TouchableOpacity style={styles.encourageBtn} onPress={handleSendEncouragement} activeOpacity={0.85}>
        <Text style={styles.encourageBtnText}>{'Send Encouragement 💪'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.emailSummaryBtn} onPress={onEmailSummary} activeOpacity={0.85}>
        <Text style={styles.emailSummaryBtnText}>{'Email Summary 📊'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── AddLearnerModal ──────────────────────────────────────────────────────────

function AddLearnerModal({
  visible,
  instructorCode,
  onClose,
  onAdded,
}: {
  visible: boolean;
  instructorCode: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const theme   = useTheme();
  const [tab, setTab]       = useState<'code' | 'email'>('code');
  const [email, setEmail]   = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAddByEmail() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('instructor_relationships').insert({
        instructor_id: user.id,
        learner_email: trimmed,
        status: 'pending',
        invite_code: instructorCode,
      });
      Alert.alert(
        'Invite created',
        `Ask ${trimmed} to open ClearPass, go to Settings → Linked Instructors, and enter your code: ${instructorCode ?? ''}`,
      );
      setEmail('');
      onAdded();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not create invite. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardColor }]}>
          <Text style={[styles.modalTitle, { color: theme.textColor }]}>{'Add Learner'}</Text>

          {/* Tab toggle */}
          <View style={styles.modalTabRow}>
            <TouchableOpacity
              style={[styles.modalTab, tab === 'code' && styles.modalTabActive]}
              onPress={() => setTab('code')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalTabText, tab === 'code' && styles.modalTabTextActive]}>{'Your Code'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalTab, tab === 'email' && styles.modalTabActive]}
              onPress={() => setTab('email')}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalTabText, tab === 'email' && styles.modalTabTextActive]}>{'By Email'}</Text>
            </TouchableOpacity>
          </View>

          {tab === 'code' ? (
            <View style={styles.codeDisplay}>
              <Text style={[styles.codeLabel, { color: theme.subTextColor }]}>
                {'Share this code with your learner'}
              </Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{instructorCode ?? '——————'}</Text>
              </View>
              <Text style={[styles.codeHint, { color: theme.subTextColor }]}>
                {'They enter it in Settings → Linked Instructors → Enter Code'}
              </Text>
            </View>
          ) : (
            <View style={styles.emailEntry}>
              <Text style={[styles.emailLabel, { color: theme.subTextColor }]}>
                {"Enter the learner's email address"}
              </Text>
              <TextInput
                style={[styles.emailInput, { color: theme.textColor, borderColor: email.includes('@') ? '#0D9488' : '#E5E7EB' }]}
                value={email}
                onChangeText={setEmail}
                placeholder="learner@example.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!saving}
              />
              <TouchableOpacity
                style={[styles.addEmailBtn, (!email.includes('@') || saving) && styles.btnDisabled]}
                onPress={() => void handleAddByEmail()}
                activeOpacity={0.85}
                disabled={!email.includes('@') || saving}
              >
                <Text style={styles.addEmailBtnText}>{saving ? 'Saving...' : 'Send Invite'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.modalCancelText}>{'Close'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── EmailSummaryModal ────────────────────────────────────────────────────────

function EmailSummaryModal({
  visible,
  data,
  onClose,
}: {
  visible: boolean;
  data: LearnerEntry | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  if (!data) return null;
  const name     = data.username ?? data.rel.learner_name ?? 'Learner';
  const readiness = data.progress?.readinessScore ?? 0;
  const streak    = data.progress?.studyStreakDays ?? 0;
  const totalQ    = data.progress?.totalQuestionsAnswered ?? 0;
  const best      = data.progress ? bestMock(data.progress.mockTestHistory) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardColor }]}>
          <Text style={[styles.modalTitle, { color: theme.textColor }]}>{'Weekly Summary Preview'}</Text>
          <Text style={[styles.summaryMeta, { color: theme.subTextColor }]}>
            {'This is what the email would contain:'}
          </Text>

          <View style={styles.summaryBody}>
            <Text style={[styles.summaryLearnerName, { color: theme.textColor }]}>{name}</Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryKey, { color: theme.subTextColor }]}>{'Pass probability'}</Text>
              <Text style={[styles.summaryVal, { color: probColor(readiness) }]}>{readiness}{'%'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryKey, { color: theme.subTextColor }]}>{'Study streak'}</Text>
              <Text style={[styles.summaryVal, { color: theme.textColor }]}>{streak}{' days'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryKey, { color: theme.subTextColor }]}>{'Questions answered'}</Text>
              <Text style={[styles.summaryVal, { color: theme.textColor }]}>{totalQ}</Text>
            </View>
            {best > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryKey, { color: theme.subTextColor }]}>{'Best mock score'}</Text>
                <Text style={[styles.summaryVal, { color: theme.textColor }]}>{best}{'/50'}</Text>
              </View>
            )}
            <View style={[styles.summaryEncourage, { backgroundColor: '#F0FDFA' }]}>
              <Text style={styles.summaryEncourageText}>
                {`Keep it up, ${name.split(' ')[0]}! You're making great progress on your theory test prep. Consistent daily practice is the key to success. You've got this! 💪`}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.sendSummaryBtn}
            onPress={() => Alert.alert('Coming soon', 'Email reports will be available in the full release.')}
            activeOpacity={0.85}
          >
            <Text style={styles.sendSummaryBtnText}>{'Send Summary'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.modalCancelText}>{'Close'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── ReferralSection ─────────────────────────────────────────────────────────

function ReferralSection({
  referralCode,
  onCopy,
  onShare,
}: {
  referralCode: string;
  onCopy: () => void;
  onShare: () => void;
}) {
  const theme = useTheme();
  const link = `getclearpass.co.uk?ref=${referralCode}`;
  return (
    <View style={[styles.refSection, { backgroundColor: theme.cardColor }]}>
      <Text style={[styles.refSectionTitle, { color: theme.textColor }]}>{'Share Your Referral Link'}</Text>
      <Text style={[styles.refSectionSub, { color: theme.subTextColor }]}>
        {'Earn £2.50 for every pupil who subscribes to Premium'}
      </Text>
      <View style={styles.refLinkBox}>
        <Text style={styles.refLinkText}>{link}</Text>
      </View>
      <View style={styles.refBtnRow}>
        <TouchableOpacity style={styles.refCopyBtn} onPress={onCopy} activeOpacity={0.85}>
          <Text style={styles.refCopyBtnText}>{'Copy Link'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.refShareBtn} onPress={onShare} activeOpacity={0.85}>
          <Text style={styles.refShareBtnText}>{'Share'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── EarningsSection ──────────────────────────────────────────────────────────

function EarningsSection({
  earnings,
  instructorName,
  instructorEmail,
}: {
  earnings: EarningEntry[];
  instructorName: string;
  instructorEmail: string;
}) {
  const theme = useTheme();
  const [requesting, setRequesting] = useState(false);

  const total   = earnings.reduce((s, e) => s + Number(e.amount), 0);
  const pending = earnings.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount), 0);

  async function handlePayout() {
    if (pending < 10) {
      Alert.alert('Not enough yet', 'Minimum payout is £10 — keep referring to unlock your payout!');
      return;
    }
    setRequesting(true);
    try {
      const res = await fetch(`${PROXY_URL}/api/payout-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorName, instructorEmail, amount: pending, conversions: earnings.length }),
      });
      if (res.ok) {
        Alert.alert('Request sent!', `Your payout request for £${pending.toFixed(2)} has been submitted.`);
      } else {
        Alert.alert('Error', 'Could not send payout request. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Could not send payout request. Please try again.');
    } finally {
      setRequesting(false);
    }
  }

  return (
    <View style={[styles.earningsSection, { backgroundColor: theme.cardColor }]}>
      <Text style={[styles.earningsSectionTitle, { color: theme.textColor }]}>{'Your Earnings'}</Text>
      <View style={styles.earningsStatsRow}>
        <View style={styles.earningStat}>
          <Text style={[styles.earningStatVal, { color: theme.textColor }]}>{`£${total.toFixed(2)}`}</Text>
          <Text style={[styles.earningStatLabel, { color: theme.subTextColor }]}>{'Total earned'}</Text>
        </View>
        <View style={styles.earningStat}>
          <Text style={[styles.earningStatVal, { color: theme.textColor }]}>{`£${pending.toFixed(2)}`}</Text>
          <Text style={[styles.earningStatLabel, { color: theme.subTextColor }]}>{'Pending payout'}</Text>
        </View>
        <View style={styles.earningStat}>
          <Text style={[styles.earningStatVal, { color: theme.textColor }]}>{String(earnings.length)}</Text>
          <Text style={[styles.earningStatLabel, { color: theme.subTextColor }]}>{'Converted'}</Text>
        </View>
      </View>
      {earnings.length === 0 ? (
        <Text style={[styles.earningsEmptyText, { color: theme.subTextColor }]}>
          {'No conversions yet — share your referral link to start earning'}
        </Text>
      ) : (
        earnings.map((e, idx) => (
          <View key={e.id} style={styles.earningRow}>
            <View>
              <Text style={[styles.earningDate, { color: theme.textColor }]}>{formatDate(e.created_at)}</Text>
              <Text style={[styles.earningDesc, { color: theme.subTextColor }]}>{`Learner ${idx + 1} converted to Premium`}</Text>
            </View>
            <Text style={styles.earningAmount}>{'£2.50'}</Text>
          </View>
        ))
      )}
      <TouchableOpacity
        style={[styles.payoutBtn, requesting && styles.btnDisabled]}
        onPress={() => void handlePayout()}
        activeOpacity={0.85}
        disabled={requesting}
      >
        <Text style={styles.payoutBtnText}>{requesting ? 'Sending...' : 'Request Payout'}</Text>
      </TouchableOpacity>
      {pending < 10 && (
        <Text style={[styles.payoutMinText, { color: theme.subTextColor }]}>{'Minimum payout is £10'}</Text>
      )}
    </View>
  );
}

// ─── InstructorDashboard ──────────────────────────────────────────────────────

function InstructorDashboard({
  learners,
  instructorCode,
  referralCode,
  earnings,
  instructorEmail,
  instructorUsername,
  loading,
  onRefresh,
}: {
  learners: LearnerEntry[];
  instructorCode: string | null;
  referralCode: string | null;
  earnings: EarningEntry[];
  instructorEmail: string;
  instructorUsername: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const [selectedLearner, setSelectedLearner] = useState<LearnerEntry | null>(null);
  const [showAdd, setShowAdd]                 = useState(false);
  const [showSummary, setShowSummary]         = useState(false);
  const [summaryTarget, setSummaryTarget]     = useState<LearnerEntry | null>(null);

  async function handleCopyLink() {
    if (!referralCode) return;
    await Clipboard.setStringAsync(`https://getclearpass.co.uk?ref=${referralCode}`);
    Alert.alert('Copied!', 'Referral link copied to clipboard.');
  }

  async function handleShareLink() {
    if (!referralCode) return;
    await Share.share({
      message: `I recommend ClearPass for your theory test revision. Use my link for the UK's smartest theory test app: getclearpass.co.uk?ref=${referralCode}`,
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={[styles.loadingText, { color: theme.subTextColor }]}>{'Loading...'}</Text>
      </View>
    );
  }

  if (selectedLearner) {
    return (
      <>
        <LearnerDetailView
          data={selectedLearner}
          onBack={() => setSelectedLearner(null)}
          onEmailSummary={() => {
            setSummaryTarget(selectedLearner);
            setShowSummary(true);
          }}
        />
        <EmailSummaryModal
          visible={showSummary}
          data={summaryTarget}
          onClose={() => setShowSummary(false)}
        />
      </>
    );
  }

  if (learners.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.emptyState}>
        <Text style={styles.emptyEmoji}>{'👨‍🏫'}</Text>
        <Text style={[styles.emptyTitle, { color: theme.textColor }]}>{'No learners yet'}</Text>
        <Text style={[styles.emptySub, { color: theme.subTextColor }]}>
          {'Share your instructor code with a learner to get started.'}
        </Text>
        {instructorCode && (
          <View style={styles.codeCardLarge}>
            <Text style={[styles.codeCardLabel, { color: theme.subTextColor }]}>{'YOUR CODE'}</Text>
            <Text style={styles.codeCardValue}>{instructorCode}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.addLearnerBtn}
          onPress={() => setShowAdd(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.addLearnerBtnText}>{'Add Learner by Email'}</Text>
        </TouchableOpacity>
        {referralCode && (
          <ReferralSection
            referralCode={referralCode}
            onCopy={() => void handleCopyLink()}
            onShare={() => void handleShareLink()}
          />
        )}
        <EarningsSection
          earnings={earnings}
          instructorName={instructorUsername}
          instructorEmail={instructorEmail}
        />
        <AddLearnerModal
          visible={showAdd}
          instructorCode={instructorCode}
          onClose={() => setShowAdd(false)}
          onAdded={onRefresh}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.dashHeader}>
        <Text style={[styles.dashTitle, { color: theme.textColor }]}>{'Your Learners'}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAdd(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.addBtnText}>{'+ Add'}</Text>
        </TouchableOpacity>
      </View>

      {learners.map(entry => (
        <LearnerCard key={entry.rel.id} data={entry} onPress={() => setSelectedLearner(entry)} />
      ))}

      {referralCode && (
        <ReferralSection
          referralCode={referralCode}
          onCopy={() => void handleCopyLink()}
          onShare={() => void handleShareLink()}
        />
      )}
      <EarningsSection
        earnings={earnings}
        instructorName={instructorUsername}
        instructorEmail={instructorEmail}
      />

      <AddLearnerModal
        visible={showAdd}
        instructorCode={instructorCode}
        onClose={() => setShowAdd(false)}
        onAdded={onRefresh}
      />
    </ScrollView>
  );
}

// ─── LearnerModeView ──────────────────────────────────────────────────────────

function LearnerModeView({
  instructors,
  loading,
  onRefresh,
}: {
  instructors: Relationship[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [enteredCode, setEnteredCode]     = useState('');
  const [linking, setLinking]             = useState(false);

  async function handleEnterCode() {
    const code = enteredCode.trim().toUpperCase();
    if (code.length !== 6 || linking) return;
    setLinking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: instructorProfile, error } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('instructor_code', code)
        .single();

      if (error || !instructorProfile) {
        Alert.alert('Code not found', 'Please check the code and try again.');
        return;
      }

      if (instructorProfile.id === user.id) {
        Alert.alert('That\'s your own code', 'You cannot link to yourself.');
        return;
      }

      const { data: existing } = await supabase
        .from('instructor_relationships')
        .select('id')
        .eq('instructor_id', instructorProfile.id)
        .eq('learner_id', user.id)
        .maybeSingle();

      if (existing) {
        Alert.alert('Already linked', 'You are already linked to this instructor.');
        return;
      }

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      await supabase.from('instructor_relationships').insert({
        instructor_id: instructorProfile.id,
        learner_id: user.id,
        learner_name: (myProfile as { username?: string } | null)?.username ?? null,
        status: 'accepted',
        invite_code: code,
      });

      const iname = (instructorProfile as { username?: string }).username ?? 'your instructor';
      Alert.alert('Linked!', `You are now linked to ${iname}.`);
      setEnteredCode('');
      setShowCodeModal(false);
      onRefresh();
    } catch {
      Alert.alert('Error', 'Could not link. Please try again.');
    } finally {
      setLinking(false);
    }
  }

  async function handleRemove(relId: string, instructorName: string) {
    Alert.alert(
      'Remove access',
      `${instructorName} will no longer be able to view your progress.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await supabase.from('instructor_relationships').delete().eq('id', relId);
              onRefresh();
            })();
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={[styles.loadingText, { color: theme.subTextColor }]}>{'Loading...'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.dashTitle, { color: theme.textColor }]}>{'Linked Instructors'}</Text>
      <Text style={[styles.learnerModeSub, { color: theme.subTextColor }]}>
        {'These people can view your progress on ClearPass.'}
      </Text>

      {instructors.length === 0 ? (
        <View style={[styles.instructorEmpty, { backgroundColor: theme.cardColor }]}>
          <Text style={styles.instructorEmptyEmoji}>{'👁️'}</Text>
          <Text style={[styles.instructorEmptyTitle, { color: theme.textColor }]}>
            {'No one is monitoring you yet'}
          </Text>
          <Text style={[styles.instructorEmptySub, { color: theme.subTextColor }]}>
            {'Enter an instructor code to allow a parent or instructor to follow your progress.'}
          </Text>
        </View>
      ) : (
        instructors.map(rel => (
          <View key={rel.id} style={[styles.instructorCard, { backgroundColor: theme.cardColor }]}>
            <View style={[styles.avatarCircle, { backgroundColor: '#6366F1' }]}>
              <Text style={styles.avatarText}>
                {getInitials(rel.learner_name ?? rel.learner_email ?? 'IN')}
              </Text>
            </View>
            <View style={styles.learnerMeta}>
              <Text style={[styles.learnerName, { color: theme.textColor }]}>
                {rel.learner_name ?? rel.learner_email ?? 'Instructor'}
              </Text>
              <Text style={[styles.learnerSub, { color: theme.subTextColor }]}>
                {'Linked '}{formatDate(rel.created_at)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => void handleRemove(rel.id, rel.learner_name ?? rel.learner_email ?? 'Instructor')}
              activeOpacity={0.75}
            >
              <Text style={styles.removeBtnText}>{'Remove'}</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <TouchableOpacity
        style={styles.enterCodeBtn}
        onPress={() => setShowCodeModal(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.enterCodeBtnText}>{'Enter Instructor Code'}</Text>
      </TouchableOpacity>

      {/* Enter code modal */}
      <Modal visible={showCodeModal} transparent animationType="fade" onRequestClose={() => setShowCodeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>{'Enter Instructor Code'}</Text>
            <Text style={[styles.codeLabel, { color: theme.subTextColor }]}>
              {'Ask your instructor or parent for their 6-character code.'}
            </Text>
            <TextInput
              style={[styles.codeInput, { color: theme.textColor }]}
              value={enteredCode}
              onChangeText={v => setEnteredCode(v.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.addEmailBtn, (enteredCode.length < 6 || linking) && styles.btnDisabled]}
              onPress={() => void handleEnterCode()}
              activeOpacity={0.85}
              disabled={enteredCode.length < 6 || linking}
            >
              <Text style={styles.addEmailBtnText}>{linking ? 'Linking...' : 'Link Account'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => { setEnteredCode(''); setShowCodeModal(false); }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>{'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── InstructorScreen ─────────────────────────────────────────────────────────

export default function InstructorScreen() {
  const params  = useLocalSearchParams<{ mode?: string }>();
  const mode    = params.mode === 'learner' ? 'learner' : 'instructor';
  const theme   = useTheme();

  const [learners,           setLearners]           = useState<LearnerEntry[]>([]);
  const [instructors,        setInstructors]        = useState<Relationship[]>([]);
  const [instructorCode,     setInstructorCode]     = useState<string | null>(null);
  const [referralCode,       setReferralCode]       = useState<string | null>(null);
  const [earnings,           setEarnings]           = useState<EarningEntry[]>([]);
  const [instructorEmail,    setInstructorEmail]    = useState('');
  const [instructorUsername, setInstructorUsername] = useState('');
  const [loading,            setLoading]            = useState(true);

  useEffect(() => { void loadData(); }, [mode]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      setInstructorEmail(user.email ?? '');

      // Ensure instructor code and referral code exist
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, instructor_code, referral_code, username')
        .eq('id', user.id)
        .single();

      let code = (profile as { instructor_code?: string } | null)?.instructor_code ?? null;
      if (!code) {
        code = generateCode();
        await supabase.from('profiles').upsert({ id: user.id, instructor_code: code });
      }
      setInstructorCode(code);

      const uname = (profile as { username?: string } | null)?.username ?? '';
      setInstructorUsername(uname);

      let refCode = (profile as { referral_code?: string } | null)?.referral_code ?? null;
      if (!refCode && uname) {
        refCode = generateReferralCode(uname);
        await supabase.from('profiles').update({ referral_code: refCode }).eq('id', user.id);
      }
      setReferralCode(refCode);

      // Load earnings
      const { data: earningsData } = await supabase
        .from('instructor_earnings')
        .select('*')
        .eq('instructor_id', user.id)
        .order('created_at', { ascending: false });
      setEarnings((earningsData as EarningEntry[] | null) ?? []);

      if (mode === 'instructor') {
        const { data: rels } = await supabase
          .from('instructor_relationships')
          .select('*')
          .eq('instructor_id', user.id)
          .neq('status', 'rejected');

        const accepted = (rels as Relationship[] | null)?.filter(r => r.status === 'accepted' && r.learner_id) ?? [];

        if (accepted.length > 0) {
          const learnerIds = accepted.map(r => r.learner_id!);

          const [{ data: progressRows }, { data: profileRows }] = await Promise.all([
            supabase.from('user_progress').select('id, progress').in('id', learnerIds),
            supabase.from('profiles').select('id, username').in('id', learnerIds),
          ]);

          const entries: LearnerEntry[] = accepted.map(rel => {
            const pd  = (progressRows as { id: string; progress: unknown }[] | null)?.find(p => p.id === rel.learner_id);
            const pf  = (profileRows  as { id: string; username: string }[] | null)?.find(p => p.id === rel.learner_id);
            const raw = pd?.progress as Partial<UserProgress> | undefined;
            const progress = raw ? ({ ...createFreshUserProgress(), ...raw } as UserProgress) : null;
            return { rel, progress, username: pf?.username ?? null };
          });
          setLearners(entries);
        } else {
          setLearners([]);
        }
      } else {
        const { data: rels } = await supabase
          .from('instructor_relationships')
          .select('*')
          .eq('learner_id', user.id)
          .neq('status', 'rejected');
        setInstructors((rels as Relationship[] | null) ?? []);
      }
    } catch {
      // Table likely doesn't exist yet — show empty state
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardColor, borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack} activeOpacity={0.7}>
          <Text style={[styles.headerBackArrow, { color: theme.textColor }]}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>
          {mode === 'instructor' ? 'Instructor Dashboard' : 'Linked Instructors'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {mode === 'instructor' ? (
        <InstructorDashboard
          learners={learners}
          instructorCode={instructorCode}
          referralCode={referralCode}
          earnings={earnings}
          instructorEmail={instructorEmail}
          instructorUsername={instructorUsername}
          loading={loading}
          onRefresh={() => void loadData()}
        />
      ) : (
        <LearnerModeView
          instructors={instructors}
          loading={loading}
          onRefresh={() => void loadData()}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  headerBack:      { padding: 4, marginRight: 8 },
  headerBackArrow: { fontSize: 22, fontWeight: '600', lineHeight: 26 },
  headerTitle:     { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  headerSpacer:    { width: 34 },

  // Shared layout
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15 },
  listContent: { padding: 16, paddingBottom: 48, gap: 12 },
  detailContent: { padding: 20, paddingBottom: 60, gap: 16 },

  // Learner card
  learnerCard: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  learnerCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  learnerMeta: { flex: 1, gap: 2 },
  learnerName: { fontSize: 15, fontWeight: '700' },
  learnerSub:  { fontSize: 12 },
  probBadge: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  probBadgeText: { fontSize: 15, fontWeight: '800' },
  learnerStats: { flexDirection: 'row', gap: 16 },
  statChip: { fontSize: 13, fontWeight: '600' },
  weakRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  weakBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  weakBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  learnerCardChevron: { fontSize: 12, color: '#0D9488', fontWeight: '700', textAlign: 'right' },

  // Detail view
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  backArrow: { fontSize: 20, fontWeight: '600' },
  backLabel: { fontSize: 14, fontWeight: '500' },
  detailHeader: { alignItems: 'center', gap: 6 },
  avatarCircleLg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextLg: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  detailName: { fontSize: 22, fontWeight: '800' },
  detailSub:  { fontSize: 13 },

  // Pass probability circle
  probCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  probCardLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.5 },
  probCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  probCircleValue: { fontSize: 36, fontWeight: '900' },
  probCircleSub:   { fontSize: 12, fontWeight: '600' },

  // Stats grid
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  statCardEmoji: { fontSize: 22 },
  statCardValue: { fontSize: 18, fontWeight: '800' },
  statCardLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Activity dots
  section: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.5 },
  dotsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dotCol:  { alignItems: 'center', gap: 4 },
  dot: { width: 28, height: 28, borderRadius: 14 },
  dotActive:   { backgroundColor: '#0D9488' },
  dotInactive: { backgroundColor: '#E5E7EB' },
  dotLabel: { fontSize: 11, fontWeight: '600' },

  // Topic bars
  topicRow: { gap: 4 },
  topicLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  topicName: { fontSize: 13, fontWeight: '500', flex: 1 },
  topicPct:  { fontSize: 13, fontWeight: '700' },
  barTrack: { height: 5, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: 5, borderRadius: 3 },

  // Mock history
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  mockRowLeft: { gap: 2 },
  mockDate:    { fontSize: 14, fontWeight: '600' },
  mockScore:   { fontSize: 12 },
  mockBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  mockBadgeText: { fontSize: 11, fontWeight: '800' },

  // Action buttons
  encourageBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  encourageBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  emailSummaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0D9488',
  },
  emailSummaryBtnText: { color: '#0D9488', fontSize: 16, fontWeight: '700' },

  // Empty state (instructor)
  emptyState: { alignItems: 'center', padding: 32, gap: 12 },
  emptyEmoji: { fontSize: 72, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptySub:   { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  codeCardLarge: {
    backgroundColor: '#F0FDFA',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0D9488',
    marginTop: 8,
    width: '100%',
  },
  codeCardLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  codeCardValue: { fontSize: 40, fontWeight: '900', color: '#0D9488', letterSpacing: 8 },
  addLearnerBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  addLearnerBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Dashboard header
  dashHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dashTitle:  { fontSize: 22, fontWeight: '800' },
  addBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Learner mode
  learnerModeSub: { fontSize: 14, lineHeight: 20, marginTop: -4 },
  instructorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  instructorEmpty: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  instructorEmptyEmoji: { fontSize: 40 },
  instructorEmptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  instructorEmptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  removeBtn: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  removeBtnText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  enterCodeBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0D9488',
    marginTop: 4,
  },
  enterCodeBtnText: { color: '#0D9488', fontSize: 16, fontWeight: '700' },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    gap: 14,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalTabRow: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  modalTab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#F9FAFB' },
  modalTabActive: { backgroundColor: '#0D9488' },
  modalTabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  modalTabTextActive: { color: '#FFFFFF' },
  codeDisplay: { alignItems: 'center', gap: 10 },
  codeLabel: { fontSize: 13, textAlign: 'center' },
  codeBox: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#0D9488',
  },
  codeText: { fontSize: 32, fontWeight: '900', color: '#0D9488', letterSpacing: 6 },
  codeHint: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  emailEntry: { gap: 10 },
  emailLabel: { fontSize: 13 },
  emailInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1.5,
    fontSize: 15,
    fontWeight: '500',
    padding: 13,
  },
  codeInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    fontSize: 28,
    fontWeight: '800',
    padding: 14,
    textAlign: 'center',
    letterSpacing: 6,
  },
  addEmailBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addEmailBtnText:  { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.45 },
  modalCancelBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },

  // Referral section
  refSection: {
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  refSectionTitle: { fontSize: 16, fontWeight: '800' },
  refSectionSub:   { fontSize: 13 },
  refLinkBox: {
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#0D9488',
  },
  refLinkText: { fontSize: 14, fontWeight: '700', color: '#0D9488' },
  refBtnRow: { flexDirection: 'row', gap: 10 },
  refCopyBtn: {
    flex: 1,
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  refCopyBtnText:  { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  refShareBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0D9488',
  },
  refShareBtnText: { color: '#0D9488', fontSize: 14, fontWeight: '700' },

  // Earnings section
  earningsSection: {
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  earningsSectionTitle: { fontSize: 16, fontWeight: '800' },
  earningsStatsRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  earningStat:          { alignItems: 'center', flex: 1 },
  earningStatVal:       { fontSize: 20, fontWeight: '900' },
  earningStatLabel:     { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  earningsEmptyText:    { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  earningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  earningDate:   { fontSize: 13, fontWeight: '600' },
  earningDesc:   { fontSize: 12, marginTop: 2 },
  earningAmount: { fontSize: 15, fontWeight: '800', color: '#0D9488' },
  payoutBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  payoutBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  payoutMinText: { fontSize: 12, textAlign: 'center' },

  // Email summary modal
  summaryMeta: { fontSize: 13 },
  summaryBody: { gap: 10 },
  summaryLearnerName: { fontSize: 17, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryKey: { fontSize: 14 },
  summaryVal: { fontSize: 14, fontWeight: '700' },
  summaryEncourage: { borderRadius: 10, padding: 14, marginTop: 4 },
  summaryEncourageText: { fontSize: 14, lineHeight: 22, color: '#0D9488', fontStyle: 'italic' },
  sendSummaryBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendSummaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
