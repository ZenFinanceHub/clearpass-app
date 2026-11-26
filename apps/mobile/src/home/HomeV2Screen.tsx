import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, RefreshControl, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { calculateReadiness, generateDailyChallenge, type UserProgress } from '@clearpass/core';
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
import { useDesignTheme } from '@/src/design';
import { Card, Icon, Text } from '@/src/ui';
import { DailyCoachHome } from './DailyCoachHome';
import { TestDateModal } from './TestDateModal';
import { buildHomeViewModel, type HomePlatform } from './homeViewModel';

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
 * challenge invites, pull-to-refresh. Still to come (M1, see the PR's
 * placement plan): Question of the Day, tutor nudges, reminder offer,
 * scheduled mocks.
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
      if (fresh) setPassProbability((await computeAndSavePassProbability(fresh, sr, allQuestions)).probability);
    } catch {}
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
  });

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

  const invites = pendingChallenges > 0 ? (
    <Card onPress={() => router.push('/challenge' as never)} accessibilityLabel={`${pendingChallenges} challenge invites waiting`} padding={14}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="people" size={24} color={colors.text.brand} />
        <Text variant="bodyStrong" weight={700} style={{ flex: 1 }}>
          {pendingChallenges === 1 ? 'A friend challenged you' : `${pendingChallenges} friends challenged you`}
        </Text>
        <Icon name="chevron-forward" size={18} color={colors.text.secondary} />
      </View>
    </Card>
  ) : null;

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
        extraCards={invites}
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
