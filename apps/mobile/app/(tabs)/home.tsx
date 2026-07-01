import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useClientDimensions } from '@/src/hooks/useClientDimensions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import {
  UserProgress,
  awardXp,
  calculateReadiness,
  generateDailyChallenge,
  getXpLevel,
} from '@clearpass/core';
import {
  createFreshUserProgress,
  loadUserProgress,
  popPendingTestDate,
  saveUserProgress,
  syncPendingUsername,
} from '@/src/storage';
import { getStudyPlan, loadStudyPlan, type SimpleStudyPlan, type StudyPlan } from '@/src/studyPlan';
import {
  requestNotificationPermissions,
  scheduleMockTestReminder,
  cancelMockTestReminder,
  scheduleStreakProtectionNotification,
  scheduleTestCountdownNotifications,
} from '@/src/notifications';
import { buildTodaySummary } from '../studyplan';
import { loadSRState, getDueQuestions } from '@/src/spacedRepetition';
import { computeAndSavePassProbability, PassProbabilityResult } from '@/src/passProbability';
import { generateNudges, saveNudges, loadNudges, dismissNudge, TutorNudge, NudgeType } from '@/src/tutorNudges';
import { checkAndTriggerCelebrations, CelebrationEvent } from '@/src/celebrations';
import { ScaleButton } from '@/src/components/ScaleButton';
import { SkeletonBox } from '@/src/components/SkeletonBox';
import { CelebrationModal } from '@/src/components/CelebrationModal';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { Pip, PipMood } from '@/src/components/Pip';
import RoadmapPath from '@/src/components/RoadmapPath';
import { allQuestions } from '@clearpass/content';
import { supabase } from '@/src/supabase';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';
import { useNetwork } from '@/src/NetworkContext';
import { isTrialActive, daysLeftInTrial } from '@/src/storage';

// ─── NudgesSection ────────────────────────────────────────────────────────────

const NUDGE_BORDER: Record<NudgeType, string> = {
  struggling_topic:   Colors.amber,
  mock_score_dropped: Colors.amber,
  streak_at_risk:     Colors.red,
  milestone_close:    Colors.indigo,
  ready_for_mock:     Colors.indigo,
  weak_area_detected: Colors.amber,
  inactivity:         Colors.amber,
};

const NUDGE_ACTION_BG: Record<NudgeType, string> = {
  struggling_topic:   Colors.amberBg,
  mock_score_dropped: Colors.amberBg,
  streak_at_risk:     Colors.redBg,
  milestone_close:    Colors.indigoBg,
  ready_for_mock:     Colors.indigoBg,
  weak_area_detected: Colors.amberBg,
  inactivity:         Colors.amberBg,
};

const NUDGE_EMOJI: Record<NudgeType, string> = {
  struggling_topic:   '🤖',
  mock_score_dropped: '⚠',
  streak_at_risk:     '🔥',
  milestone_close:    '🎯',
  ready_for_mock:     '🎯',
  weak_area_detected: '⚠',
  inactivity:         '📅',
};

function NudgesSection({
  nudges,
  onDismiss,
  screenWidth,
}: {
  nudges: TutorNudge[];
  onDismiss: (id: string) => void;
  screenWidth: number;
}) {
  if (nudges.length === 0) return null;
  const nudgeCardW = Math.min(Math.round(screenWidth * 0.72), 272);
  const visible = nudges.slice(0, 2);
  return (
    <View style={styles.nudgesSection}>
      <Text style={styles.nudgesLabel}>{'ASK PIP'}</Text>
      <View style={{ position: 'relative' }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nudgesScroll}>
        {visible.map(nudge => {
          const borderColor = NUDGE_BORDER[nudge.type];
          const actionBg    = NUDGE_ACTION_BG[nudge.type];
          const emoji       = NUDGE_EMOJI[nudge.type];
          return (
            <View key={nudge.id} style={[styles.nudgeCard, { borderLeftColor: borderColor, width: nudgeCardW }]}>
              <View style={styles.nudgeHeader}>
                <Text style={styles.nudgeEmoji}>{emoji}</Text>
                <View style={styles.nudgeTitleRow}>
                  <Text style={styles.nudgeTitle} numberOfLines={1}>{nudge.title}</Text>
                  <TouchableOpacity
                    onPress={() => onDismiss(nudge.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.nudgeDismiss}>{'x'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.nudgeBody} numberOfLines={3}>{nudge.body}</Text>
              <TouchableOpacity
                style={[styles.nudgeAction, { backgroundColor: actionBg }]}
                onPress={() => router.push({
                  pathname: nudge.actionRoute as any,
                  params: nudge.actionParams,
                })}
                activeOpacity={0.8}
              >
                <Text style={[styles.nudgeActionText, { color: borderColor }]}>{nudge.actionLabel}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
      {visible.length > 1 && (
        <LinearGradient
          colors={['rgba(247,248,250,0)', 'rgba(247,248,250,0.9)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.nudgeFade}
          pointerEvents="none"
        />
      )}
      </View>
    </View>
  );
}

// ─── Daily tips & helpers ─────────────────────────────────────────────────────

// ─── Scheduled Mock Test helpers ─────────────────────────────────────────────

type ScheduledMockTest = {
  id: string;
  dateTimeIso: string;
  label: string;
  notifId: string | null;
};

const SCHEDULED_TESTS_KEY = '@clearpass/scheduled_mock_tests';

function formatTestDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (isToday) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  return `${d.getDate()} ${months[d.getMonth()]} at ${time}`;
}

const DAILY_TIPS = [
  "Stopping distance at 70mph is 96 metres - that's 24 car lengths!",
  'Over 50% of learners fail their theory test first time. Practice daily to beat the odds.',
  'The hazard perception test has 14 clips. You need 44 out of 75 to pass.',
];

function parseDdMmYyyy(input: string): string | null {
  const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day   = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year  = parseInt(match[3], 10);
  const d = new Date(year, month, day);
  if (isNaN(d.getTime()) || d.getMonth() !== month) return null;
  return d.toISOString();
}

function getDaysRemaining(testDateIso: string): number {
  const now  = new Date();
  const test = new Date(testDateIso);
  const nowDay  = new Date(now.getFullYear(),  now.getMonth(),  now.getDate());
  const testDay = new Date(test.getFullYear(), test.getMonth(), test.getDate());
  return Math.round((testDay.getTime() - nowDay.getTime()) / 86400000);
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [progress, setProgress]       = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [username, setUsername]       = useState<string | null>(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateInput, setDateInput]     = useState('');
  const [dateError, setDateError]     = useState('');
  const [aiStudyPlan, setAiStudyPlan] = useState<StudyPlan | null>(null);
  const [passProb, setPassProb]       = useState<PassProbabilityResult | null>(null);
  const [nudges, setNudges]           = useState<TutorNudge[]>([]);
  const [celebQueue, setCelebQueue]   = useState<CelebrationEvent[]>([]);
  const [activeCelebration, setActiveCelebration] = useState<CelebrationEvent | null>(null);
  const [pendingChallenges, setPendingChallenges] = useState(0);
  const [homeDueCount, setHomeDueCount] = useState(0);
  const [showResultBanner, setShowResultBanner]   = useState(false);

  // Question of the Day
  const [qotdExpanded, setQotdExpanded]     = useState(false);
  const [qotdSelected, setQotdSelected]     = useState<number | null>(null);
  const [qotdDoneToday, setQotdDoneToday]   = useState(false);

  // Scheduled mock tests
  const [scheduledTests, setScheduledTests] = useState<ScheduledMockTest[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate]     = useState('');
  const [scheduleHour, setScheduleHour]     = useState(10);
  const [scheduleMinute, setScheduleMinute] = useState(0);
  const [scheduleLabel, setScheduleLabel]   = useState('Mock Test');
  const [scheduleError, setScheduleError]   = useState('');
  const theme = useTheme();
  const { isOffline } = useNetwork();
  const dims = useClientDimensions();
  const [studyPlan, setStudyPlan] = useState<SimpleStudyPlan | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const cardW: '30%' | '47%' = dims && dims.width >= 600 ? '30%' : '47%';

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const fresh = await loadUserProgress();
      if (fresh) {
        setProgress(fresh);
        const [srState, dueIds] = await Promise.all([loadSRState(), getDueQuestions(allQuestions.map(q => q.id), 200)]);
        setHomeDueCount(dueIds.length);
        const prob = await computeAndSavePassProbability(fresh, srState, allQuestions);
        setPassProb(prob);
        const generated = generateNudges(fresh, srState, allQuestions);
        const existing = await loadNudges();
        const dismissedIds = new Set(
          (existing?.nudges ?? []).filter(n => n.dismissed).map(n => n.id),
        );
        const withDismissals = generated.map(n =>
          dismissedIds.has(n.id) ? { ...n, dismissed: true } : n,
        );
        await saveNudges(withDismissals);
        setNudges(withDismissals.filter(n => !n.dismissed));
      }
      const plan = await loadStudyPlan();
      setAiStudyPlan(plan);
    } catch {}
    setRefreshing(false);
  }

  useEffect(() => {
    void (async () => {
      const raw = await loadUserProgress();
      const p   = raw ?? createFreshUserProgress();

      const today = new Date().toISOString().split('T')[0];
      let updated = p;
      if (!p.dailyChallenge || p.dailyChallenge.date !== today) {
        const fresh = generateDailyChallenge(new Date());
        updated = { ...p, dailyChallenge: fresh };
        if (raw !== null) await saveUserProgress(updated);
      }
      // Pick up test date set during onboarding
      const pendingDate = await popPendingTestDate();
      if (pendingDate && !updated.testDate) {
        const withDate = { ...updated, testDate: pendingDate };
        await saveUserProgress(withDate);
        updated = withDate;
      }
      setProgress(updated);
      setIsLoading(false);

      // Load scheduled mock tests, pruning past ones
      try {
        const storedRaw = await AsyncStorage.getItem(SCHEDULED_TESTS_KEY);
        const stored: ScheduledMockTest[] = storedRaw ? (JSON.parse(storedRaw) as ScheduledMockTest[]) : [];
        const future = stored.filter(t => new Date(t.dateTimeIso) > new Date());
        setScheduledTests(future);
        if (future.length !== stored.length) {
          await AsyncStorage.setItem(SCHEDULED_TESTS_KEY, JSON.stringify(future));
        }
      } catch {}
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await syncPendingUsername();

        const fresh = await loadUserProgress();
        if (fresh) {
          setProgress(fresh);
          try {
            const celebEvents = await checkAndTriggerCelebrations(fresh);
            if (celebEvents.length > 0) {
              setActiveCelebration(celebEvents[0]);
              setCelebQueue(celebEvents.slice(1));
            }
          } catch {}
        }

        // Check if test date has passed and result not yet submitted
        if (fresh) {
          const td = fresh.testDate;
          const passed = td !== null && getDaysRemaining(td) < 0;
          if (passed) {
            const submitted = await AsyncStorage.getItem('@clearpass/has_submitted_result');
            setShowResultBanner(submitted !== 'true');
          } else {
            setShowResultBanner(false);
          }
        }

        const plan = await loadStudyPlan();
        setAiStudyPlan(plan);

        try {
          const [srState, freshProg] = await Promise.all([loadSRState(), loadUserProgress()]);
          if (freshProg) {
            const prob = await computeAndSavePassProbability(freshProg, srState, allQuestions);
            setPassProb(prob);
            const generated = generateNudges(freshProg, srState, allQuestions);
            const existing = await loadNudges();
            const dismissedIds = new Set(
              (existing?.nudges ?? []).filter(n => n.dismissed).map(n => n.id),
            );
            const withDismissals = generated.map(n =>
              dismissedIds.has(n.id) ? { ...n, dismissed: true } : n,
            );
            await saveNudges(withDismissals);
            setNudges(withDismissals.filter(n => !n.dismissed));
          }
        } catch {}

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (user) {
          try {
            const { count } = await supabase
              .from('challenges')
              .select('id', { count: 'exact', head: true })
              .eq('challenged_id', user.id)
              .eq('status', 'pending');
            setPendingChallenges(count ?? 0);
          } catch {}
        }

        if (!user) {
          const pending = await AsyncStorage.getItem('@clearpass/pending_username');
          if (pending) setUsername(pending);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        const displayName = profile?.username as string | null;

        if (displayName) {
          setUsername(displayName);
        } else {
          const pending = await AsyncStorage.getItem('@clearpass/pending_username');
          if (pending) setUsername(pending);
        }

        // Study plan: compute today's task if test date is set
        if (fresh?.testDate) {
          const weakTopics = Object.entries(fresh.topicScores as Record<string, number>)
            .sort(([, a], [, b]) => a - b)
            .slice(0, 5)
            .map(([k]) => k);
          setStudyPlan(getStudyPlan(fresh.testDate, weakTopics));
        }

        // Streak protection: schedule for 20:00 today if streak at risk
        if (fresh && (fresh.studyStreakDays ?? 0) > 0) {
          const todayCheck = new Date().toISOString().split('T')[0];
          const lastDay = new Date(fresh.lastStudied).toISOString().split('T')[0];
          if (lastDay !== todayCheck) {
            void scheduleStreakProtectionNotification(fresh.studyStreakDays ?? 0);
          }
        }

        // QotD: check if already answered today
        const todayStr = new Date().toISOString().split('T')[0];
        const qotdRaw = await AsyncStorage.getItem(`@clearpass/qotd_${todayStr}`);
        if (qotdRaw !== null) {
          setQotdDoneToday(true);
          setQotdSelected(parseInt(qotdRaw, 10));
          setQotdExpanded(true);
        } else {
          setQotdDoneToday(false);
          setQotdSelected(null);
          setQotdExpanded(false);
        }
      })();
    }, []),
  );

  function handleOpenModal() {
    const current = progress?.testDate;
    if (current) {
      const d  = new Date(current);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      setDateInput(`${dd}/${mm}/${String(d.getFullYear())}`);
    } else {
      setDateInput('');
    }
    setDateError('');
    setShowDateModal(true);
  }

  async function handleScheduleTest() {
    const parsed = parseDdMmYyyy(scheduleDate.trim());
    if (!parsed) { setScheduleError('Enter a valid date (DD/MM/YYYY)'); return; }
    const dt = new Date(parsed);
    dt.setHours(scheduleHour, scheduleMinute, 0, 0);
    if (dt <= new Date()) { setScheduleError('Test must be in the future'); return; }

    let notifId: string | null = null;
    try {
      const granted = await requestNotificationPermissions();
      if (granted) notifId = await scheduleMockTestReminder(dt, scheduleLabel || 'Mock Test');
    } catch {}

    const newTest: ScheduledMockTest = {
      id: String(Date.now()),
      dateTimeIso: dt.toISOString(),
      label: scheduleLabel.trim() || 'Mock Test',
      notifId,
    };
    const updated = [...scheduledTests, newTest].sort(
      (a, b) => new Date(a.dateTimeIso).getTime() - new Date(b.dateTimeIso).getTime(),
    );
    setScheduledTests(updated);
    await AsyncStorage.setItem(SCHEDULED_TESTS_KEY, JSON.stringify(updated));
    setShowScheduleModal(false);
    setScheduleError('');
    setScheduleDate('');
    setScheduleLabel('Mock Test');
    setScheduleHour(10);
    setScheduleMinute(0);
  }

  async function handleCancelTest(test: ScheduledMockTest) {
    if (test.notifId) await cancelMockTestReminder(test.notifId);
    const updated = scheduledTests.filter(t => t.id !== test.id);
    setScheduledTests(updated);
    await AsyncStorage.setItem(SCHEDULED_TESTS_KEY, JSON.stringify(updated));
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
    void scheduleTestCountdownNotifications(new Date(parsed));
  }

  async function handleDismissNudge(id: string) {
    await dismissNudge(id);
    setNudges(prev => prev.filter(n => n.id !== id));
  }

  function handleCelebDismiss() {
    const [next, ...rest] = celebQueue;
    if (next) {
      setActiveCelebration(next);
      setCelebQueue(rest);
    } else {
      setActiveCelebration(null);
    }
  }

  const xp      = progress?.xp ?? 0;
  const xpData  = getXpLevel(xp);
  const streak  = progress?.studyStreakDays ?? 0;
  const freezeCount = (progress?.isPro ? progress.streakFreezeCount : 0) ?? 0;
  const trialActive = progress ? isTrialActive(progress) : false;
  const trialDaysLeft = progress ? daysLeftInTrial(progress) : 0;
  const trialExpired = !!(progress && !progress.isPro && progress.trialStartDate && !trialActive);
  const showTrialBanner = trialActive && trialDaysLeft <= 3;
  const tip     = DAILY_TIPS[new Date().getDay() % 3];
  const readinessPct = progress ? calculateReadiness(progress).score : 0;

  const xpBadgeLabel = xpData.level === 5 ? 'TEST READY' : `LEVEL ${xpData.level}`;
  const xpMsg =
    xpData.level === 5
      ? "You're ready to book your test!"
      : `${xpData.xpForNext - xp} XP to Level ${xpData.level + 1} - ${xpData.label}`;

  const testDate = progress?.testDate ?? null;
  const daysLeft = testDate ? getDaysRemaining(testDate) : null;

  let countdownMsg   = '';
  let countdownColor = Colors.indigo;
  if (daysLeft !== null) {
    if (daysLeft <= 0) {
      countdownMsg = 'Good luck on your test today!';
      countdownColor = Colors.violet;
    } else if (daysLeft <= 7) {
      countdownMsg = 'Almost there! Make sure you are ready!';
      countdownColor = Colors.red;
    } else if (daysLeft <= 30) {
      countdownMsg = 'Keep practising hard!';
      countdownColor = Colors.amber;
    } else {
      countdownMsg = 'You have got plenty of time - stay consistent!';
      countdownColor = Colors.indigo;
    }
  }

  // Question of the Day — deterministic daily pick
  const _qotdToday = new Date().toISOString().split('T')[0]!;
  const _qotdParts = _qotdToday.split('-').map(Number);
  const _qotdSeed  = _qotdParts[0]! * 10000 + _qotdParts[1]! * 100 + _qotdParts[2]!;
  const qotdQuestion = allQuestions[_qotdSeed % allQuestions.length]!;

  const prob = passProb ? passProb.probability : readinessPct;
  let pipMood: PipMood = 'wave';
  if (!progress || progress.totalQuestionsAnswered < 1) {
    pipMood = 'wave';
  } else if (streak >= 7 || prob > 85) {
    pipMood = 'celebrate';
  } else if (prob < 40 && progress.totalQuestionsAnswered > 10) {
    pipMood = 'sympathetic';
  } else if (streak > 0) {
    pipMood = 'happy';
  } else {
    pipMood = 'curious';
  }

  const pipMessage =
    pipMood === 'wave'        ? "Welcome! Let's start your theory journey." :
    pipMood === 'celebrate'   ? (streak >= 7 ? `${streak}-day streak — you're on fire!` : 'Looking great! Keep it up.') :
    pipMood === 'sympathetic' ? "Don't worry — consistent practice makes it click!" :
    pipMood === 'happy'       ? (streak > 0 ? `${streak}-day streak! Keep going.` : 'Good work! Keep going.') :
                                "You're making progress — keep exploring!";

  async function handleQotdAnswer(optionIndex: number) {
    if (qotdSelected !== null) return;
    setQotdSelected(optionIndex);
    setQotdExpanded(true);
    const todayStr = new Date().toISOString().split('T')[0]!;
    await AsyncStorage.setItem(`@clearpass/qotd_${todayStr}`, String(optionIndex));
    if (!qotdDoneToday) {
      setQotdDoneToday(true);
      const base = progress;
      if (base) {
        const updated = awardXp(base, 10);
        setProgress(updated);
        await saveUserProgress(updated);
      }
    }
  }

  const dc    = progress?.dailyChallenge ?? null;
  const dcPct = dc && dc.targetCount > 0
    ? Math.min((dc.currentCount / dc.targetCount) * 100, 100)
    : 0;

  return (
  <>
    <OfflineBanner />
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void handleRefresh(); }} tintColor={Colors.indigo} />}
    >
      {/* Pip Header Band */}
      <View style={styles.pipHeader}>
        <View style={styles.pipHeaderInner}>
          <Pip size={64} mood={isLoading ? 'wave' : pipMood} />
          <View style={styles.pipHeaderText}>
            <Text style={styles.pipGreeting}>
              {username ? `Hey, ${username}!` : 'Hey there!'}
            </Text>
            <Text style={styles.pipMessage} numberOfLines={2}>
              {isLoading ? 'Loading your progress…' : pipMessage}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Row — streak | XP | pass probability */}
      {!isLoading && (
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <Text style={styles.statusEmoji}>{'🔥'}</Text>
            <Text style={styles.statusValue}>{streak}</Text>
            <Text style={styles.statusLabel}>{'streak'}</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={styles.statusEmoji}>{'⭐'}</Text>
            <Text style={styles.statusValue}>{xp.toLocaleString()}</Text>
            <Text style={styles.statusLabel}>{'XP'}</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={styles.statusEmoji}>{prob >= 70 ? '✅' : prob >= 45 ? '📈' : '📚'}</Text>
            <Text style={styles.statusValue}>{prob}{'%'}</Text>
            <Text style={styles.statusLabel}>{'pass prob'}</Text>
          </View>
        </View>
      )}

      {/* Trial banner */}
      {!isLoading && (showTrialBanner || trialExpired) && (
        <TouchableOpacity
          style={[styles.trialBanner, trialExpired && styles.trialBannerExpired]}
          onPress={() => router.push('/paywall')}
          activeOpacity={0.85}
        >
          <View style={styles.trialBannerLeft}>
            <Text style={styles.trialBannerTitle}>
              {trialExpired
                ? 'Your free trial has ended'
                : trialDaysLeft === 1
                  ? 'Last day of your free trial!'
                  : `${trialDaysLeft} days left in your free trial`}
            </Text>
            <Text style={styles.trialBannerSub}>
              {trialExpired ? 'Subscribe to keep all Pro features' : 'Unlock Pro to keep your progress going'}
            </Text>
          </View>
          <Text style={styles.trialBannerCta}>{trialExpired ? 'Subscribe →' : 'Upgrade →'}</Text>
        </TouchableOpacity>
      )}

      {/* Today's Focus card */}
      {!isLoading && homeDueCount > 0 && (
        <TouchableOpacity
          style={styles.focusCard}
          onPress={() => router.push('/(tabs)/practice')}
          activeOpacity={0.85}
        >
          <View style={styles.focusCardLeft}>
            <Text style={styles.focusCardLabel}>{"TODAY'S FOCUS"}</Text>
            <Text style={styles.focusCardTitle}>{homeDueCount}{' question'}{homeDueCount === 1 ? '' : 's'}{' due'}</Text>
            <Text style={styles.focusCardSub}>{'~'}{Math.ceil(homeDueCount * 0.5)}{' min · Tap to start'}</Text>
          </View>
          <Text style={styles.focusCardChevron}>{'›'}</Text>
        </TouchableOpacity>
      )}

      {/* Urgent countdown hero — shown at top when test is within 14 days */}
      {!isLoading && daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && (
        <TouchableOpacity style={[styles.urgentCountdown, { borderTopColor: countdownColor }]} onPress={handleOpenModal} activeOpacity={0.9}>
          <View style={styles.urgentCountdownLeft}>
            <Text style={styles.urgentCountdownSub}>{'YOUR TEST'}</Text>
            <View style={styles.urgentCountdownRow}>
              <Text style={[styles.urgentCountdownDays, { color: countdownColor }]}>{daysLeft}</Text>
              <Text style={styles.urgentCountdownDaysLabel}>{'days to go'}</Text>
            </View>
            <Text style={[styles.urgentCountdownMsg, { color: countdownColor }]}>{countdownMsg}</Text>
          </View>
          <Text style={styles.urgentChevron}>{'›'}</Text>
        </TouchableOpacity>
      )}

      {/* Progress Roadmap */}
      {isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
          <SkeletonBox height={200} borderRadius={16} />
        </View>
      ) : (
        <View style={styles.roadmapSection}>
          <Text style={styles.roadmapTitle}>{'YOUR PROGRESS'}</Text>
          <RoadmapPath
            progress={progress}
            pipMood={pipMood}
            width={(dims?.width ?? 375) - 32}
          />
        </View>
      )}

      {/* Tutor Nudges */}
      {isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
          <SkeletonBox width={80} height={10} borderRadius={4} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <SkeletonBox width={240} height={90} borderRadius={14} />
            <SkeletonBox width={240} height={90} borderRadius={14} />
          </View>
        </View>
      ) : (
        <NudgesSection nudges={nudges} onDismiss={(id) => void handleDismissNudge(id)} screenWidth={dims?.width ?? 375} />
      )}


      {/* Test Date Countdown */}
      {daysLeft !== null && daysLeft > 14 && (
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
          <Text style={[styles.countdownMsg, { color: countdownColor }]}>{countdownMsg}</Text>
        </View>
      )}

      {/* Test date nudge — shown when no date is set and user has started practising */}
      {!testDate && (progress?.totalQuestionsAnswered ?? 0) >= 5 && (
        <TouchableOpacity style={styles.testDateNudge} onPress={handleOpenModal} activeOpacity={0.85}>
          <Text style={styles.testDateNudgeEmoji}>{'📅'}</Text>
          <View style={styles.testDateNudgeBody}>
            <Text style={styles.testDateNudgeTitle}>{'Set your test date'}</Text>
            <Text style={styles.testDateNudgeSub}>{'Get a personalised countdown and study plan tailored to when you want to pass.'}</Text>
          </View>
          <Text style={styles.testDateNudgeChevron}>{'›'}</Text>
        </TouchableOpacity>
      )}
      {/* Fallback: subtle link when user hasn't started yet */}
      {!testDate && (progress?.totalQuestionsAnswered ?? 0) < 5 && (
        <TouchableOpacity style={styles.setDateRow} onPress={handleOpenModal}>
          <Text style={styles.setDateText}>Set your test date</Text>
        </TouchableOpacity>
      )}

      {/* Schedule Mock Test Card — requires internet */}
      {!isOffline && <View style={[styles.scheduleMockCard, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
        <View style={styles.scheduleMockHeader}>
          <View>
            <Text style={styles.scheduleMockLabel}>{'SCHEDULE MOCK TEST'}</Text>
            <Text style={[styles.scheduleMockSub, { color: theme.subTextColor }]}>
              {'Get a reminder 30 min before it starts'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.scheduleMockAddBtn}
            onPress={() => setShowScheduleModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.scheduleMockAddText}>{'+ Schedule'}</Text>
          </TouchableOpacity>
        </View>
        {scheduledTests.length > 0 && (
          <View style={styles.scheduledList}>
            {scheduledTests.slice(0, 3).map(test => (
              <View key={test.id} style={[styles.scheduledItem, { borderTopColor: theme.borderColor }]}>
                <View style={styles.scheduledItemLeft}>
                  <Text style={[styles.scheduledItemLabel, { color: theme.textColor }]}>{test.label}</Text>
                  <Text style={[styles.scheduledItemTime, { color: theme.subTextColor }]}>
                    {formatTestDateTime(test.dateTimeIso)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => void handleCancelTest(test)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.scheduledItemCancel}>{'x'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>}

      {/* Test Day Banner */}
      {daysLeft !== null && daysLeft >= 0 && daysLeft <= 1 && (
        <TouchableOpacity
          style={styles.testDayBanner}
          onPress={() => router.push('/testday' as any)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[Colors.indigo, Colors.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.testDayGradient}
          >
            <Text style={styles.testDayEmoji}>{daysLeft === 0 ? '🎯' : '📅'}</Text>
            <View style={styles.testDayTextBlock}>
              <Text style={styles.testDayTitle}>
                {daysLeft === 0 ? 'Test Day Mode' : 'Test Tomorrow!'}
              </Text>
              <Text style={styles.testDaySub}>{'Tap to prepare'}</Text>
            </View>
            <Text style={styles.testDayChevron}>{'›'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Test Result Banner */}
      {showResultBanner && (
        <View style={styles.resultBannerWrap}>
          <LinearGradient
            colors={[Colors.indigo, Colors.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.resultBannerGradient}
          >
            <Text style={styles.resultBannerTitle}>{'[*] How did your test go?'}</Text>
            <View style={styles.resultBannerBtns}>
              <TouchableOpacity
                style={styles.resultBannerPassBtn}
                onPress={() => router.push('/ipassed?flow=passed' as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.resultBannerPassText}>{'I Passed!'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resultBannerResitBtn}
                onPress={() => router.push('/ipassed?flow=resit' as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.resultBannerResitText}>{'I need to resit'}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Action Grid */}
      <View style={styles.actionGrid}>
        <View style={styles.actionCards}>
          <ScaleButton style={[styles.actionCard, { width: cardW }]} onPress={() => router.push('/(tabs)/practice')} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'🎯'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>Practice</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>Random questions</Text>
          </ScaleButton>

          <ScaleButton style={[styles.actionCard, { width: cardW }]} onPress={() => router.push('/(tabs)/mock')} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'📋'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>Mock Test</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>57 minutes</Text>
          </ScaleButton>

          <ScaleButton style={[styles.actionCard, { width: cardW }]} onPress={() => router.push('/roadsigns' as any)} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'🚦'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>Road Signs</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>89 UK signs</Text>
          </ScaleButton>

          <ScaleButton style={[styles.actionCard, { width: cardW }]} onPress={() => router.push('/highwaycode' as any)} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'🛣️'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>Highway Code</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>Official rules</Text>
          </ScaleButton>

          <ScaleButton style={[styles.actionCard, { width: cardW }]} onPress={() => router.push('/hazard' as any)} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'⚠️'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>Hazard</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>14 clips</Text>
          </ScaleButton>

          <ScaleButton style={[styles.actionCard, { width: cardW }]} onPress={() => router.push('/(tabs)/learn')} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'📊'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>Progress & More</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>Stats, Leaderboard & More</Text>
          </ScaleButton>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionCard, styles.challengeCard]}
            onPress={() => router.push('/challenge' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.challengeCardInner}>
              <View style={styles.challengeCardLeft}>
                <Text style={styles.actionEmoji}>{'⚔'}</Text>
                <View>
                  <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>
                    {'Challenge'}
                  </Text>
                  <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>
                    {'Beat a friend'}
                  </Text>
                </View>
              </View>
              {pendingChallenges > 0 && (
                <View style={styles.challengeBadge}>
                  <Text style={styles.challengeBadgeText}>{pendingChallenges}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Today's Task from study plan */}
      {studyPlan && studyPlan.todayTask.type !== 'rest' && (
        <TouchableOpacity
          style={[styles.todayTaskCard, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}
          onPress={() => router.push('/study-plan' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.todayTaskLeft}>
            <Text style={styles.todayTaskLabel}>{'TODAY\'S TASK'}</Text>
            <Text style={[styles.todayTaskTitle, { color: theme.textColor }]}>
              {studyPlan.todayTask.type === 'questions' ? 'Practice Questions'
                : studyPlan.todayTask.type === 'mock' ? 'Full Mock Test'
                : studyPlan.todayTask.type === 'hazard' ? 'Hazard Perception'
                : studyPlan.todayTask.type}
            </Text>
            <Text style={[styles.todayTaskSub, { color: theme.subTextColor }]}>
              {studyPlan.todayTask.durationMins}{' min -- '}{studyPlan.daysLeft}{' days to go'}
            </Text>
          </View>
          <Text style={styles.todayTaskChevron}>{'>'}</Text>
        </TouchableOpacity>
      )}

      {/* I Passed button */}
      <TouchableOpacity
        style={styles.iPassedBtn}
        onPress={() => router.push('/ipassed' as any)}
        activeOpacity={0.85}
      >
        <Text style={styles.iPassedBtnText}>{'🎉 I Passed my Theory Test!'}</Text>
        <Text style={styles.iPassedBtnSub}>{'Celebrate and share your story'}</Text>
      </TouchableOpacity>

      {/* Study Plan Card */}
      <TouchableOpacity
        style={styles.studyPlanCard}
        onPress={() => router.push('/studyplan' as any)}
        activeOpacity={0.8}
      >
        <View style={styles.studyPlanLeft}>
          <Text style={styles.studyPlanEmoji}>{'📅'}</Text>
          <View style={styles.studyPlanTextBlock}>
            <Text style={styles.studyPlanLabel}>STUDY PLAN</Text>
            {aiStudyPlan ? (
              <Text style={[styles.studyPlanSummary, { fontSize: theme.fontSize(13), fontFamily: theme.fontFamily }]}>
                {buildTodaySummary(aiStudyPlan) || 'View your plan'}
              </Text>
            ) : (
              <Text style={[styles.studyPlanSummary, { fontSize: theme.fontSize(13), fontFamily: theme.fontFamily }]}>
                {'Create a personalised study plan'}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.studyPlanChevron}>
          <Text style={styles.studyPlanChevronText}>{'›'}</Text>
        </View>
      </TouchableOpacity>

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
          <Text style={[styles.dcDesc, dc.completed && styles.dcDescComplete, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(20), color: dc.completed ? undefined : theme.textColor }]}>
            {dc.description}
          </Text>
          <View style={styles.dcBarTrack}>
            <View style={[styles.dcBarFill, { width: `${dcPct}%` as any }]} />
          </View>
          <Text style={styles.dcProgress}>{dc.currentCount}{' / '}{dc.targetCount}</Text>
        </View>
      )}

      {/* Question of the Day */}
      <TouchableOpacity
        style={styles.qotdCard}
        onPress={() => { if (qotdSelected === null) setQotdExpanded((e) => !e); }}
        activeOpacity={qotdSelected !== null ? 1 : 0.85}
      >
        <View style={styles.qotdHeader}>
          <Text style={styles.qotdLabel}>QUESTION OF THE DAY</Text>
          <View style={styles.qotdXpBadge}>
            {qotdDoneToday
              ? <Text style={styles.qotdXpText}>{'✓ +10 XP'}</Text>
              : <Text style={styles.qotdXpText}>{'+10 XP'}</Text>
            }
          </View>
        </View>
        <Text style={[styles.qotdQuestion, { color: theme.textColor }]} numberOfLines={qotdExpanded ? undefined : 2}>
          {qotdQuestion.questionText}
        </Text>
        {!qotdExpanded && (
          <Text style={styles.qotdTap}>Tap to answer</Text>
        )}
        {qotdExpanded && (
          <View style={styles.qotdOptions}>
            {qotdQuestion.options.map((opt: string, idx: number) => {
              const isCorrect  = idx === qotdQuestion.correctIndex;
              const isSelected = idx === qotdSelected;
              let bg = theme.cardColor;
              let textCol = theme.textColor;
              if (qotdSelected !== null) {
                if (isCorrect)        { bg = '#D1FAE5'; textCol = '#065F46'; }
                else if (isSelected)  { bg = '#FEE2E2'; textCol = '#991B1B'; }
              }
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.qotdOption, { backgroundColor: bg }]}
                  onPress={() => void handleQotdAnswer(idx)}
                  activeOpacity={qotdSelected !== null ? 1 : 0.75}
                  disabled={qotdSelected !== null}
                >
                  <Text style={[styles.qotdOptionText, { color: textCol }]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
            {qotdSelected !== null && (
              <Text style={[styles.qotdExplanation, { color: theme.subTextColor }]}>
                {qotdQuestion.explanation}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Tip Card */}
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>DID YOU KNOW?</Text>
        <Text style={[styles.tipBody, { fontSize: theme.fontSize(13), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(20), color: theme.subTextColor }]}>
          {tip}
        </Text>
      </View>

      {/* Schedule Mock Test Modal */}
      <Modal visible={showScheduleModal} transparent animationType="fade" onRequestClose={() => setShowScheduleModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>Schedule Mock Test</Text>
            <Text style={[styles.modalSub, { color: theme.subTextColor }]}>Date (DD/MM/YYYY)</Text>
            <TextInput
              style={[styles.dateInput, { color: theme.textColor }]}
              value={scheduleDate}
              onChangeText={setScheduleDate}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#9CA3AF"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <Text style={[styles.modalSub, { color: theme.subTextColor }]}>Time</Text>
            <View style={styles.scheduleTimeRow}>
              <View style={styles.scheduleTimeUnit}>
                <TouchableOpacity style={styles.scheduleArrow} onPress={() => setScheduleHour(h => (h + 1) % 24)} activeOpacity={0.7}>
                  <Text style={styles.scheduleArrowText}>{'▲'}</Text>
                </TouchableOpacity>
                <Text style={[styles.scheduleTimeValue, { color: theme.textColor }]}>{String(scheduleHour).padStart(2, '0')}</Text>
                <TouchableOpacity style={styles.scheduleArrow} onPress={() => setScheduleHour(h => (h + 23) % 24)} activeOpacity={0.7}>
                  <Text style={styles.scheduleArrowText}>{'▼'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.scheduleTimeSep, { color: theme.textColor }]}>{':'}</Text>
              <View style={styles.scheduleTimeUnit}>
                <TouchableOpacity style={styles.scheduleArrow} onPress={() => setScheduleMinute(m => (m + 5) % 60)} activeOpacity={0.7}>
                  <Text style={styles.scheduleArrowText}>{'▲'}</Text>
                </TouchableOpacity>
                <Text style={[styles.scheduleTimeValue, { color: theme.textColor }]}>{String(scheduleMinute).padStart(2, '0')}</Text>
                <TouchableOpacity style={styles.scheduleArrow} onPress={() => setScheduleMinute(m => (m + 55) % 60)} activeOpacity={0.7}>
                  <Text style={styles.scheduleArrowText}>{'▼'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.modalSub, { color: theme.subTextColor }]}>Label (optional)</Text>
            <TextInput
              style={[styles.dateInput, { color: theme.textColor, letterSpacing: 0 }]}
              value={scheduleLabel}
              onChangeText={setScheduleLabel}
              placeholder="Mock Test"
              placeholderTextColor="#9CA3AF"
              maxLength={40}
            />
            {scheduleError.length > 0 && <Text style={styles.dateError}>{scheduleError}</Text>}
            <TouchableOpacity style={styles.modalSave} onPress={() => void handleScheduleTest()} activeOpacity={0.85}>
              <Text style={styles.modalSaveText}>Schedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowScheduleModal(false); setScheduleError(''); }} activeOpacity={0.85}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Test Date Modal */}
      <Modal visible={showDateModal} transparent animationType="fade" onRequestClose={() => setShowDateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { fontSize: theme.fontSize(20), fontFamily: theme.fontFamily, color: theme.textColor }]}>Set Test Date</Text>
            <Text style={[styles.modalSub, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(20), color: theme.subTextColor }]}>
              Enter your test date in DD/MM/YYYY format
            </Text>
            <TextInput
              style={styles.dateInput}
              value={dateInput}
              onChangeText={setDateInput}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#9CA3AF"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            {dateError.length > 0 && <Text style={styles.dateError}>{dateError}</Text>}
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
    {activeCelebration && (
      <CelebrationModal event={activeCelebration} onDismiss={handleCelebDismiss} />
    )}
  </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll:   { flex: 1 },
  content:  { flexGrow: 1, paddingBottom: 40 },

  // Pip Header Band
  pipHeader: {
    backgroundColor: Colors.indigo,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  pipHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pipHeaderText: {
    flex: 1,
  },
  pipGreeting: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  pipMessage: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },

  // ── Streak Card ──────────────────────────────────────────────────────────────
  // ── Status Bar (merged streak + XP + level) ──────────────────────────────────
  statusBar: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statusItem: { alignItems: 'center', flex: 1 },
  statusEmoji: { fontSize: 18, marginBottom: 2 },
  statusValue: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  statusLabel: { fontSize: 10, color: Colors.mutedText, fontWeight: '500', marginTop: 1 },
  statusDivider: { width: 0.5, height: 28, backgroundColor: Colors.border },

  // ── Nudges ───────────────────────────────────────────────────────────────────
  nudgesSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
  },
  nudgesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.mutedText,
    letterSpacing: 1,
    marginBottom: 8,
  },
  nudgesScroll: {
    gap: 12,
    paddingRight: 16,
  },
  nudgeFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
  },
  nudgeCard: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    padding: 14,
  },
  nudgeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  nudgeEmoji: { fontSize: 18, lineHeight: 22 },
  nudgeTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nudgeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  nudgeDismiss: { fontSize: 15, color: Colors.mutedText, lineHeight: 22, fontWeight: '600' },
  nudgeBody: { fontSize: 12, color: Colors.mutedText, lineHeight: 18, marginBottom: 10 },
  nudgeAction: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  nudgeActionText: { fontSize: 12, fontWeight: '700' },

  // ── Roadmap Section ──────────────────────────────────────────────────────────
  roadmapSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  roadmapTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.mutedText,
    letterSpacing: 1,
    marginBottom: 8,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  trialBannerExpired: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  trialBannerLeft: { flex: 1, gap: 2 },
  trialBannerTitle: { fontSize: 13, fontWeight: '700', color: '#1E40AF' },
  trialBannerSub: { fontSize: 11, color: '#3B82F6' },
  trialBannerCta: { fontSize: 13, fontWeight: '700', color: '#1D4ED8', flexShrink: 0 },

  focusCard: {
    backgroundColor: Colors.indigoBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.indigo,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  focusCardLeft: { flex: 1 },
  focusCardLabel: { fontSize: 10, fontWeight: '700', color: Colors.indigo, letterSpacing: 1, marginBottom: 3 },
  focusCardTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  focusCardSub: { fontSize: 12, color: Colors.mutedText, marginTop: 2 },
  focusCardChevron: { fontSize: 24, color: Colors.indigo, marginLeft: 8 },

  // ── Urgent countdown (top of screen, ≤14 days) ──────────────────────────────
  urgentCountdown: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderTopWidth: 4,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  urgentCountdownLeft: { flex: 1 },
  urgentCountdownSub: { fontSize: 10, fontWeight: '700', color: Colors.mutedText, letterSpacing: 1, marginBottom: 4 },
  urgentCountdownRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  urgentCountdownDays: { fontSize: 56, fontWeight: '900', lineHeight: 64 },
  urgentCountdownDaysLabel: { fontSize: 18, color: Colors.mutedText, fontWeight: '600' },
  urgentCountdownMsg: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  urgentChevron: { fontSize: 24, color: Colors.mutedText, marginLeft: 8 },

  countdownCard: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderTopWidth: 3,
    borderTopColor: Colors.amber,
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 16,
  },
  countdownTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  countdownLabel:    { fontSize: 11, fontWeight: '700', color: Colors.amber, letterSpacing: 1 },
  countdownChange:   { fontSize: 12, color: Colors.mutedText, fontWeight: '500' },
  countdownBody:     { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  countdownDays:     { fontSize: 48, fontWeight: '900', color: Colors.textPrimary, lineHeight: 56 },
  countdownDaysLabel: { fontSize: 16, color: Colors.mutedText, fontWeight: '500' },
  countdownMsg:      { fontSize: 13, fontWeight: '600' },

  setDateRow:  { marginHorizontal: 16, marginBottom: 4, paddingVertical: 8 },
  setDateText: { fontSize: 13, color: Colors.mutedText, fontWeight: '500' },
  testDateNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.indigoBg,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.indigo,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    gap: 12,
  },
  testDateNudgeEmoji: { fontSize: 28 },
  testDateNudgeBody: { flex: 1 },
  testDateNudgeTitle: { fontSize: 15, fontWeight: '700', color: Colors.indigo, marginBottom: 2 },
  testDateNudgeSub: { fontSize: 12, color: Colors.mutedText, lineHeight: 17 },
  testDateNudgeChevron: { fontSize: 22, fontWeight: '300', color: Colors.indigo },

  // ── Test Result Banner ────────────────────────────────────────────────────────
  resultBannerWrap: {
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  resultBannerGradient: {
    padding: 16,
    gap: 12,
  },
  resultBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  resultBannerBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  resultBannerPassBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resultBannerPassText: {
    color: Colors.indigo,
    fontSize: 14,
    fontWeight: '800',
  },
  resultBannerResitBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  resultBannerResitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Action Grid ───────────────────────────────────────────────────────────────
  actionGrid: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  actionCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: Colors.cardWhite,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  actionEmoji: { fontSize: 22, marginBottom: 4 },
  actionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 0 },
  actionSub:   { fontSize: 11, fontWeight: '500' },

  challengeCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.indigo,
    flex: 1,
  },
  challengeCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  challengeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  challengeBadge: {
    backgroundColor: Colors.red,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  challengeBadgeText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },

  // ── Study Plan Card ───────────────────────────────────────────────────────────
  studyPlanCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.cardWhite,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.indigo,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  studyPlanLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  studyPlanEmoji: { fontSize: 26 },
  studyPlanTextBlock: { flex: 1 },
  studyPlanLabel: { fontSize: 11, fontWeight: '700', color: Colors.indigo, letterSpacing: 1, marginBottom: 3 },
  studyPlanSummary: { fontSize: 13, fontWeight: '600', color: Colors.textDark },
  studyPlanChevron: { marginLeft: 8 },
  studyPlanChevronText: { fontSize: 22, color: Colors.mutedText, fontWeight: '400', lineHeight: 26 },

  // ── Daily Challenge Card ──────────────────────────────────────────────────────
  dcCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderTopWidth: 3,
    borderTopColor: Colors.indigo,
    padding: 16,
  },
  dcCardComplete: { opacity: 0.6 },
  dcTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dcLabel:  { fontSize: 11, fontWeight: '700', color: Colors.indigo, letterSpacing: 1, flex: 1 },
  dcCompleteBadge: { backgroundColor: Colors.emeraldBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  dcCompleteText:  { fontSize: 10, fontWeight: '800', color: Colors.emerald, letterSpacing: 0.5 },
  dcXpBadge: {
    backgroundColor: Colors.emeraldBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: Colors.emerald,
  },
  dcXpText:        { fontSize: 11, fontWeight: '700', color: Colors.emerald },
  dcDesc:          { fontSize: 14, fontWeight: '600', marginBottom: 10, lineHeight: 20 },
  dcDescComplete:  { color: Colors.mutedText },
  dcBarTrack: {
    height: 6,
    backgroundColor: Colors.surfaceGray,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 6,
  },
  dcBarFill:    { height: 6, backgroundColor: Colors.indigo, borderRadius: 3 },
  dcProgress:   { fontSize: 12, color: Colors.mutedText, fontWeight: '500' },

  // ── Tip Card ──────────────────────────────────────────────────────────────────
  tipCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.violet,
    padding: 16,
  },
  tipTitle: { fontSize: 11, fontWeight: '700', color: Colors.violet, letterSpacing: 1, marginBottom: 6 },
  tipBody:  { fontSize: 13, lineHeight: 20 },

  // ── Question of the Day ───────────────────────────────────────────────────────
  qotdCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.cardWhite,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.indigo,
    padding: 16,
  },
  qotdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  qotdLabel:   { fontSize: 11, fontWeight: '700', color: Colors.indigo, letterSpacing: 1 },
  qotdXpBadge: { backgroundColor: Colors.emeraldBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  qotdXpText:  { fontSize: 11, fontWeight: '700', color: Colors.emerald },
  qotdQuestion: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 8 },
  qotdTap:     { fontSize: 12, color: Colors.mutedText, fontWeight: '500' },
  qotdOptions: { gap: 8, marginTop: 4 },
  qotdOption:  { borderRadius: 8, padding: 10, borderWidth: 0.5, borderColor: Colors.border },
  qotdOptionText: { fontSize: 13, fontWeight: '500' },
  qotdExplanation: { fontSize: 12, lineHeight: 18, marginTop: 8, fontStyle: 'italic' },

  // ── Modal ─────────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  modalTitle:    { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  modalSub:      { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  dateInput: {
    backgroundColor: Colors.surfaceGray,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    padding: 14,
    marginBottom: 8,
    letterSpacing: 2,
  },
  dateError:      { fontSize: 13, color: Colors.red, marginBottom: 10 },
  modalSave: {
    backgroundColor: Colors.indigo,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  modalSaveText:  { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalCancel: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: { color: Colors.mutedText, fontSize: 15, fontWeight: '600' },

  // ── Schedule Mock Test Card ────────────────────────────────────────────────────
  scheduleMockCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 0.5,
    borderTopWidth: 3,
    borderTopColor: Colors.indigo,
    padding: 14,
  },
  scheduleMockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduleMockLabel: { fontSize: 11, fontWeight: '700', color: Colors.indigo, letterSpacing: 1, marginBottom: 2 },
  scheduleMockSub:   { fontSize: 12, fontWeight: '500' },
  scheduleMockAddBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scheduleMockAddText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  scheduledList: { marginTop: 10, gap: 0 },
  scheduledItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 0.5,
  },
  scheduledItemLeft: { flex: 1, gap: 1 },
  scheduledItemLabel: { fontSize: 13, fontWeight: '600' },
  scheduledItemTime:  { fontSize: 12, fontWeight: '500' },
  scheduledItemCancel: { fontSize: 18, color: Colors.mutedText, fontWeight: '600', paddingHorizontal: 4 },

  // ── Schedule Time Picker ───────────────────────────────────────────────────────
  scheduleTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  scheduleTimeUnit: { alignItems: 'center', gap: 4 },
  scheduleArrow: { padding: 8, borderRadius: 6, backgroundColor: Colors.surfaceGray, width: 44, alignItems: 'center' },
  scheduleArrowText: { fontSize: 12, color: Colors.textDark, fontWeight: '700' },
  scheduleTimeValue: { fontSize: 30, fontWeight: '800', lineHeight: 36, minWidth: 44, textAlign: 'center' },
  scheduleTimeSep:   { fontSize: 30, fontWeight: '800', lineHeight: 36 },

  // ── Today's Task Card ──────────────────────────────────────────────────────────
  todayTaskCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 0.5,
    borderTopWidth: 3,
    borderTopColor: Colors.indigo,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayTaskLeft: { flex: 1, gap: 2 },
  todayTaskLabel: { fontSize: 10, fontWeight: '700', color: Colors.indigo, letterSpacing: 1 },
  todayTaskTitle: { fontSize: 15, fontWeight: '700' },
  todayTaskSub:   { fontSize: 12, fontWeight: '500' },
  todayTaskChevron: { fontSize: 20, color: Colors.mutedText, fontWeight: '400', marginLeft: 8 },

  // ── I Passed Button ────────────────────────────────────────────────────────────
  iPassedBtn: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 3,
  },
  iPassedBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  iPassedBtnSub:  { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  // Test Day Banner
  testDayBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  testDayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  testDayEmoji:     { fontSize: 28 },
  testDayTextBlock: { flex: 1 },
  testDayTitle:     { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  testDaySub:       { fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 2 },
  testDayChevron:   { fontSize: 26, color: '#FFFFFF', fontWeight: '700', lineHeight: 30 },
});
