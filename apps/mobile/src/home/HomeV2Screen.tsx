import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, TextInput, View } from 'react-native';
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
import { homeProBannerSub } from '@/src/paywallCopy';
import { testDateError } from '@/src/testDateRules';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { useDesignTheme } from '@/src/design';
import { Button, Text } from '@/src/ui';
import { DailyCoachHome } from './DailyCoachHome';
import { buildHomeViewModel, type HomePlatform } from './homeViewModel';

/**
 * The real Daily Coach Home, rendered at /(tabs)/home ONLY when `uiV2` is on
 * (see app/(tabs)/home.tsx). Reads the same stored progress, readiness,
 * pass probability and spaced-repetition state as the current Home, and
 * writes nothing new. Kept from the current Home: daily-challenge refresh,
 * pending onboarding test date, pending username sync, reminder defaults,
 * test-date editing (same validation, save and notification reschedule).
 *
 * Not yet carried over (M1): celebrations, streak toasts, Question of the
 * Day, tutor nudges, reminder offer, scheduled mocks, challenge invites,
 * pull-to-refresh.
 */
export function HomeV2Screen() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [passProbability, setPassProbability] = useState<number | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [resultSubmitted, setResultSubmitted] = useState(false);
  const [dateModal, setDateModal] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors } = useDesignTheme();

  useEffect(() => {
    void (async () => {
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
      setLoading(false);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await syncPendingUsername();
        void ensureReminderDefaults();
        const fresh = await loadUserProgress();
        if (fresh) setProgress(fresh);
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
          } else {
            setUsername(await AsyncStorage.getItem('@clearpass/pending_username'));
          }
        } catch {}
      })();
    }, []),
  );

  const now = useMemo(() => new Date(), [progress]);
  const vm = buildHomeViewModel({
    now,
    platform: Platform.OS as HomePlatform,
    loading,
    displayName: username,
    progress,
    readinessScore: progress ? calculateReadiness(progress).score : 0,
    passProbability,
    dueReviewCount: dueCount,
    freeMockAvailable: hasFreeMockLeft(progress),
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

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg.canvas }}>
      <OfflineBanner />
      <DailyCoachHome
        vm={vm}
        progress={progress}
        onNavigate={(route) => router.push(route as never)}
        onSetTestDate={() => setDateModal(true)}
        upgradeBody={homeProBannerSub(progress, now)}
      />
      <TestDateModal
        visible={dateModal}
        initial={progress?.testDate ?? null}
        onClose={() => setDateModal(false)}
        onSave={async (iso) => { await saveDate(iso); setDateModal(false); }}
      />
    </View>
  );
}

function parseDdMmYyyy(input: string): string | null {
  const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1]!, 10);
  const month = parseInt(m[2]!, 10) - 1;
  const year = parseInt(m[3]!, 10);
  const d = new Date(year, month, day);
  if (isNaN(d.getTime()) || d.getMonth() !== month) return null;
  return d.toISOString();
}

function TestDateModal({ visible, initial, onClose, onSave }: {
  visible: boolean; initial: string | null; onClose: () => void; onSave: (iso: string) => Promise<void>;
}) {
  const { colors, radii, textStyle } = useDesignTheme();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    if (initial) {
      const d = new Date(initial);
      setValue(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
    } else setValue('');
    setError('');
  }, [visible, initial]);

  async function submit() {
    const iso = parseDdMmYyyy(value.trim());
    if (!iso) { setError('Enter a valid date in DD/MM/YYYY format'); return; }
    const rangeError = testDateError(iso, new Date());
    if (rangeError) { setError(rangeError); return; }
    await onSave(iso);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={{ backgroundColor: colors.bg.card, borderRadius: radii.card, padding: 20, gap: 12, maxWidth: 420, width: '100%', alignSelf: 'center' }} onPress={() => {}}>
          <Text variant="title">{'Your test date'}</Text>
          <Text variant="bodySmall" color="secondary">{'Optional. Add it for a countdown and a plan that fits.'}</Text>
          <Text variant="label" nativeID="testDateLabel">{'Date (DD/MM/YYYY)'}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.text.secondary}
            accessibilityLabel="Test date, DD/MM/YYYY"
            accessibilityLabelledBy="testDateLabel"
            keyboardType="numbers-and-punctuation"
            style={[textStyle('body'), {
              color: colors.text.primary, borderWidth: 1.5, borderColor: error ? colors.status.error : colors.border.strong,
              borderRadius: radii.control, paddingHorizontal: 14, minHeight: 48,
            }]}
          />
          {error ? <Text variant="bodySmall" color="error" accessibilityLiveRegion="polite">{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
            <Button label="Cancel" variant="ghost" onPress={onClose} />
            <Button label="Save" onPress={() => void submit()} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
