import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, RefreshControl, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { awardXp, calculateReadiness, generateDailyChallenge, type UserProgress } from '@clearpass/core';
import { allQuestions } from '@clearpass/content';
import {
  createFreshUserProgress,
  loadUserProgress,
  popPendingTestDate,
  saveUserProgress,
  syncPendingUsername,
} from '@/src/storage';
import { loadSRState, getDueQuestions } from '@/src/spacedRepetition';
import { computeAndSavePassProbability } from '@/src/passProbability';
import { ensureReminderDefaults, rescheduleStudyNudges, scheduleTestCountdownNotifications } from '@/src/notifications';
import { supabase } from '@/src/supabase';
import { hasFreeMockLeft } from '@/src/conversion';
import { FREE_QUESTION_LIMIT } from '@/src/subscription';
import { checkAndTriggerCelebrations, type CelebrationEvent } from '@/src/celebrations';
import { hasStreakMilestone, maybeRequestReview, type ReviewTrigger } from '@/src/reviewPrompt';
import { checkStreakToast } from '@/src/streakToasts';
import { CelebrationModal } from '@/src/components/CelebrationModal';
import { StreakToast } from '@/src/components/StreakToast';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { ReminderOffer, useReminderOffer } from '@/src/components/ReminderOffer';
import { dismissNudge, refreshNudges, type TutorNudge } from '@/src/tutorNudges';
import { QOTD_XP, qotdDateKey, qotdIndex, qotdStorageKey } from '@/src/qotd';
import { SCHEDULED_TESTS_KEY, futureScheduledMocks, type ScheduledMockTest } from '@/src/scheduledMocks';
import { useDesignTheme } from '@/src/design';
import { DailyCoachHome } from './DailyCoachHome';
import { TestDateModal } from './TestDateModal';
import { buildHomeViewModel, type HomeNudge, type HomePlatform } from './homeViewModel';

/**
 * The real Daily Coach Home, rendered at /(tabs)/home ONLY when `uiV2` is on
 * (see app/(tabs)/home.tsx). Reads the same stored progress, readiness,
 * pass probability and spaced-repetition state as the current Home, and
 * writes nothing new.
 *
 * Kept from the current Home: daily-challenge refresh, pending onboarding
 * test date, pending username sync, reminder defaults, test-date editing
 * (same validation, save and notification reschedule), celebrations (and
 * the review prompt after a streak milestone), streak toasts, pending
 * challenge invites, pull-to-refresh, Question of the Day (same pick, key
 * and XP), tutor nudges (same generation and dismissals), the reminder offer
 * (the existing component) and scheduled mocks (same key and pruning).
 * Where each appears is decided by the view model (PR #115 placement plan).
 */
export function HomeV2Screen() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [passProbability, setPassProbability] = useState<number | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [resultSubmitted, setResultSubmitted] = useState(false);
  const [dateModal, setDateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingChallenges, setPendingChallenges] = useState(0);
  const [celebQueue, setCelebQueue] = useState<CelebrationEvent[]>([]);
  const [streakToastDays, setStreakToastDays] = useState<number | null>(null);
  const [nudges, setNudges] = useState<TutorNudge[]>([]);
  const [qotdLoaded, setQotdLoaded] = useState(false);
  const [qotdSelected, setQotdSelected] = useState<number | null>(null);
  const [scheduledMocks, setScheduledMocks] = useState<ScheduledMockTest[]>([]);
  const reminderOffer = useReminderOffer(!loading);
  const reviewTriggerRef = useRef<ReviewTrigger | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useDesignTheme();

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const raw = await loadUserProgress();
      let p = raw ?? createFreshUserProgress();
      const today = new Date().toISOString().split('T')[0];
      if (!p.dailyChallenge || p.dailyChallenge.date !== today) {
        p = { ...p, dailyChallenge: generateDailyChallenge(new Date()) };
        if (raw !== null) await saveUserProgress(p);
      }
      const pendingDate = await popPendingTestDate();
      if (pendingDate && !p.testDate) {
        p = { ...p, testDate: pendingDate };
        await saveUserProgress(p);
      }
      setProgress(p);
    } catch {
      setLoadError(true);
    }
    setLoading(false);
    // Scheduled mock tests, pruning past ones (as the current Home does).
    try {
      const storedRaw = await AsyncStorage.getItem(SCHEDULED_TESTS_KEY);
      const stored: ScheduledMockTest[] = storedRaw ? (JSON.parse(storedRaw) as ScheduledMockTest[]) : [];
      const future = futureScheduledMocks(stored);
      setScheduledMocks(future);
      if (future.length !== stored.length) await AsyncStorage.setItem(SCHEDULED_TESTS_KEY, JSON.stringify(future));
    } catch {}
  }, []);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  const refreshDerived = useCallback(async (withCelebrations: boolean) => {
    const fresh = await loadUserProgress();
    if (fresh) {
      setProgress(fresh);
      if (withCelebrations) {
        try {
          const events = await checkAndTriggerCelebrations(fresh);
          if (events.length > 0) {
            if (hasStreakMilestone(events)) reviewTriggerRef.current = 'streak_milestone';
            setCelebQueue(events);
          }
        } catch {}
        try {
          const toastDays = await checkStreakToast(fresh.studyStreakDays);
          if (toastDays !== null) setStreakToastDays(toastDays);
        } catch {}
      }
    }
    try {
      const [sr, due] = await Promise.all([loadSRState(), getDueQuestions(allQuestions.map((q) => q.id), 200)]);
      setDueCount(due.length);
      if (fresh) {
        setPassProbability((await computeAndSavePassProbability(fresh, sr, allQuestions)).probability);
        setNudges(await refreshNudges(fresh, sr, allQuestions));
      }
    } catch {}
    try {
      const raw = await AsyncStorage.getItem(qotdStorageKey(qotdDateKey(new Date())));
      setQotdSelected(raw !== null ? parseInt(raw, 10) : null);
    } catch {}
    setQotdLoaded(true);
    setResultSubmitted((await AsyncStorage.getItem('@clearpass/has_submitted_result')) === 'true');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
        const name = (profile?.username as string | null) ?? (await AsyncStorage.getItem('@clearpass/pending_username'));
        setUsername(name);
        const { count } = await supabase
          .from('challenges')
          .select('id', { count: 'exact', head: true })
          .eq('challenged_id', user.id)
          .eq('status', 'pending');
        setPendingChallenges(count ?? 0);
      } else {
        setUsername(await AsyncStorage.getItem('@clearpass/pending_username'));
      }
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await syncPendingUsername();
        void ensureReminderDefaults();
        await refreshDerived(true);
      })();
    }, [refreshDerived]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    try { await refreshDerived(false); } catch {}
    setRefreshing(false);
  }

  function handleCelebDismiss() {
    const rest = celebQueue.slice(1);
    setCelebQueue(rest);
    if (rest.length === 0) {
      const trigger = reviewTriggerRef.current;
      reviewTriggerRef.current = null;
      if (trigger) void maybeRequestReview(trigger);
    }
  }

  const now = useMemo(() => new Date(), [progress]);
  const qotdQuestion = allQuestions[qotdIndex(qotdDateKey(now), allQuestions.length)]!;
  const homeNudges = useMemo<HomeNudge[]>(
    () => nudges.map((n) => ({ id: n.id, type: n.type, title: n.title, topic: n.actionParams?.topic })),
    [nudges],
  );
  const vm = buildHomeViewModel({
    now,
    platform: Platform.OS as HomePlatform,
    loading,
    error: loadError,
    displayName: username,
    progress,
    readinessScore: progress ? calculateReadiness(progress).score : 0,
    passProbability,
    dueReviewCount: dueCount,
    freeMockAvailable: hasFreeMockLeft(progress),
    freeDailyQuestionLimit: FREE_QUESTION_LIMIT,
    testResultSubmitted: resultSubmitted,
    nudges: homeNudges,
    qotd: qotdLoaded ? { answered: qotdSelected !== null, correct: qotdSelected === null ? null : qotdSelected === qotdQuestion.correctIndex } : null,
    scheduledMocks,
    reminderOfferAvailable: reminderOffer.visible,
    pendingChallengeInvites: pendingChallenges,
  });

  // Same as the current Home: store the choice, award QOTD_XP once.
  async function handleQotdAnswer(optionIndex: number) {
    if (qotdSelected !== null) return;
    setQotdSelected(optionIndex);
    await AsyncStorage.setItem(qotdStorageKey(qotdDateKey(new Date())), String(optionIndex));
    if (progress) {
      const updated = awardXp(progress, QOTD_XP);
      setProgress(updated);
      await saveUserProgress(updated);
    }
  }

  async function handleDismissNudge(id: string) {
    await dismissNudge(id);
    setNudges((prev) => prev.filter((n) => n.id !== id));
  }

  async function saveDate(iso: string) {
    if (!progress) return;
    const updated = { ...progress, testDate: iso };
    setProgress(updated);
    await saveUserProgress(updated);
    void scheduleTestCountdownNotifications(new Date(iso));
    void rescheduleStudyNudges();
  }

  function navigate(route: string) {
    // Topic practice: a fresh nonce so practice.tsx starts one session per tap.
    const target = route.startsWith('/(tabs)/practice?topic=') ? `${route}&t=${Date.now()}` : route;
    router.push(target as never);
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg.canvas }}>
      <OfflineBanner />
      <DailyCoachHome
        vm={vm}
        progress={progress}
        onNavigate={navigate}
        onSetTestDate={() => setDateModal(true)}
        onRetry={() => { void loadInitial().then(() => refreshDerived(false)); }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void handleRefresh(); }} tintColor={colors.brand.primary} />}
        qotdQuestion={qotdQuestion}
        qotdSelected={qotdSelected}
        onQotdAnswer={(i) => { void handleQotdAnswer(i); }}
        onDismissNudge={(id) => { void handleDismissNudge(id); }}
        reminderOffer={<ReminderOffer context="home" onDone={reminderOffer.hide} style={{ maxWidth: '100%' }} />}
      />
      <TestDateModal
        visible={dateModal}
        initial={progress?.testDate ?? null}
        onClose={() => setDateModal(false)}
        onSave={async (iso) => { await saveDate(iso); setDateModal(false); }}
      />
      {celebQueue[0] && <CelebrationModal event={celebQueue[0]} onDismiss={handleCelebDismiss} />}
      {streakToastDays !== null && <StreakToast days={streakToastDays} onHide={() => setStreakToastDays(null)} />}
    </View>
  );
}
