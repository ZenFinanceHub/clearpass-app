import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from './CrossPlatformAlert';
import { loadUserProgress } from './storage';
import { buildNudgePlan, reminderDefaultsToApply, type ReminderAskState } from './studyNudges';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationSettings = {
  studyReminder:    boolean;
  streakProtection: boolean;
  testCountdown:    boolean;
  reminderHour:     number;
  reminderMinute:   number;
};

// Study reminder and test countdown are on by default (Nov 2026): learners
// can switch them off in Settings. See ensureReminderDefaults.
// Web has no push notifications, so they stay off there.
export const DEFAULT_NOTIF_SETTINGS: NotificationSettings = {
  studyReminder:    Platform.OS !== 'web',
  streakProtection: false,
  testCountdown:    Platform.OS !== 'web',
  reminderHour:     19,
  reminderMinute:   0,
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_SETTINGS          = '@clearpass/notification_settings';
const KEY_STUDY_REMINDER    = '@clearpass/notif_study_reminder';
const KEY_STREAK            = '@clearpass/notif_streak_protection';
const KEY_STREAK_TODAY      = '@clearpass/notif_streak_today';
const KEY_TEST_COUNTDOWN    = '@clearpass/notif_test_countdown';
const KEY_TEST_COUNTDOWN_V2 = '@clearpass/notif_test_countdown_v2';
const KEY_WEEKLY            = '@clearpass/notif_weekly_progress';
const KEY_STUDY_NUDGES      = '@clearpass/notif_study_nudges';
const KEY_REMINDER_ASK      = '@clearpass/reminder_ask';
const KEY_REMINDER_DEFAULT  = '@clearpass/reminder_default_v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isWeb(): boolean {
  return Platform.OS === 'web';
}

export function showWebAlert(): void {
  Alert.alert(
    'Mobile app required',
    'Push notifications require the ClearPass mobile app. Download it on iOS or Android.',
  );
}

export function showPermissionDeniedAlert(): void {
  Alert.alert(
    'Notifications blocked',
    'Please enable notifications for ClearPass in your device settings to use this feature.',
  );
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (isWeb()) return false;

  if (!Device.isDevice) {
    // Simulators support local notifications in modern Expo SDK
    return true;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Settings persistence ─────────────────────────────────────────────────────

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const stored = await AsyncStorage.getItem(KEY_SETTINGS);
    if (stored) return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(stored) as NotificationSettings };
  } catch {}
  return { ...DEFAULT_NOTIF_SETTINGS };
}

export async function saveNotificationSettings(s: NotificationSettings): Promise<void> {
  await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
}

// ─── Daily study reminder (rolling nudges) ───────────────────────────────────
//
// The study reminder is a rolling set of one-off notifications built by
// buildNudgePlan (src/studyNudges.ts), rebuilt whenever the app opens or a
// session finishes: today's is skipped once the learner has studied, the
// text varies (test-date countdown, streak), and it tapers off and stops if
// they stop opening the app. KEY_STUDY_REMINDER held the old single DAILY
// trigger; it is still cancelled so upgraded installs don't get both.

export type NotificationPermission = {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  /** iOS "deliver quietly": allowed without a prompt, shown in Notification
   *  Centre only (no banner or sound). Expo reports it as 'undetermined', so
   *  the in-app offer still asks for full alerts. */
  provisional: boolean;
};

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (isWeb()) return { status: 'denied', canAskAgain: false, provisional: false };
  try {
    const p = await Notifications.getPermissionsAsync();
    return {
      status: p.status as NotificationPermission['status'],
      canAskAgain: p.canAskAgain ?? true,
      provisional: p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
    };
  } catch {
    return { status: 'undetermined', canAskAgain: true, provisional: false };
  }
}

/** Notifications will be delivered: fully allowed, or iOS quiet delivery. */
export function canDeliver(p: NotificationPermission): boolean {
  return p.status === 'granted' || p.provisional;
}

async function cancelStudyNudges(): Promise<void> {
  const stored = await AsyncStorage.getItem(KEY_STUDY_NUDGES);
  if (stored) {
    let ids: string[] = [];
    try { ids = JSON.parse(stored) as string[]; } catch {}
    await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
    await AsyncStorage.removeItem(KEY_STUDY_NUDGES);
  }
  const legacy = await AsyncStorage.getItem(KEY_STUDY_REMINDER);
  if (legacy) {
    try { await Notifications.cancelScheduledNotificationAsync(legacy); } catch {}
    await AsyncStorage.removeItem(KEY_STUDY_REMINDER);
  }
}

/** Rebuilds the study nudges from saved settings and progress. Safe to call
 *  often (app open, end of a session); does nothing unless the learner has
 *  turned the study reminder on and notifications are allowed. */
// Serialised: home focus and the end of a session can both trigger this, and
// two overlapping runs would each cancel, then each schedule a full set.
let nudgeQueue: Promise<void> = Promise.resolve();

export function rescheduleStudyNudges(override?: { hour: number; minute: number }): Promise<void> {
  if (isWeb()) return Promise.resolve();
  nudgeQueue = nudgeQueue.then(() => doRescheduleStudyNudges(override), () => doRescheduleStudyNudges(override));
  return nudgeQueue;
}

async function doRescheduleStudyNudges(override?: { hour: number; minute: number }): Promise<void> {
  try {
    const settings = await loadNotificationSettings();
    if (!override && !settings.studyReminder) { await cancelStudyNudges(); return; }
    if (!canDeliver(await getNotificationPermission())) return;

    const progress = await loadUserProgress();
    const plan = buildNudgePlan({
      now: new Date(),
      hour: override?.hour ?? settings.reminderHour,
      minute: override?.minute ?? settings.reminderMinute,
      lastStudiedIso: progress?.lastStudied ?? null,
      testDateIso: progress?.testDate ?? null,
      streakDays: progress?.studyStreakDays ?? 0,
      isPro: progress?.isPro ?? false,
    });

    await cancelStudyNudges();
    const ids: string[] = [];
    for (const n of plan) {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: n.title, body: n.body, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.date },
        });
        ids.push(id);
      } catch {}
    }
    await AsyncStorage.setItem(KEY_STUDY_NUDGES, JSON.stringify(ids));
  } catch {}
}

export async function scheduleStudyReminder(hour: number, minute: number): Promise<void> {
  if (isWeb()) return;
  await rescheduleStudyNudges({ hour, minute });
}

export async function cancelStudyReminder(): Promise<void> {
  if (isWeb()) return;
  await cancelStudyNudges();
}

/** One-tap opt-in from the in-app reminder offer: asks the OS, then turns on
 *  the daily study nudges (and the test countdown if a test date is set).
 *  Returns false if the learner declined the OS prompt. */
export async function enableStudyReminders(hour = 19, minute = 0): Promise<boolean> {
  if (isWeb()) return false;
  const granted = await requestNotificationPermissions();
  if (!granted) return false;
  const progress = await loadUserProgress();
  const settings = await loadNotificationSettings();
  const testDateIso = progress?.testDate ?? null;
  const hasFutureTest = !!testDateIso && new Date(testDateIso) > new Date();
  await saveNotificationSettings({
    ...settings,
    studyReminder: true,
    reminderHour: hour,
    reminderMinute: minute,
    testCountdown: settings.testCountdown || hasFutureTest,
  });
  await rescheduleStudyNudges();
  if (hasFutureTest && !settings.testCountdown) {
    try { await scheduleTestCountdown(testDateIso!, progress?.readinessScore ?? 0); } catch {}
  }
  return true;
}

/**
 * Reminders on by default. Called on every home-screen focus; cheap after the
 * first run. Steps:
 *  1. Once per install, switch the study reminder (and the test countdown, if
 *     a future test date is set) on. After that the Settings toggle wins.
 *  2. On iOS, if the learner hasn't been asked yet, take "deliver quietly"
 *     (provisional) permission. It needs no prompt, so reminders start
 *     straight away in Notification Centre; the in-app offer and the
 *     onboarding prompt can still upgrade them to banners with sound.
 *     Android 13+ has no equivalent, so there it waits for the prompt.
 *  3. Rebuild the rolling nudges, and the test countdown if it's on.
 */
export async function ensureReminderDefaults(): Promise<void> {
  if (isWeb()) return;
  try {
    const progress = await loadUserProgress();
    let settings = await loadNotificationSettings();
    const applied = (await AsyncStorage.getItem(KEY_REMINDER_DEFAULT)) === '1';
    const defaults = reminderDefaultsToApply({
      alreadyApplied: applied,
      settings,
      testDateIso: progress?.testDate ?? null,
      now: new Date(),
    });
    if (defaults) {
      settings = { ...settings, ...defaults };
      await saveNotificationSettings(settings);
      await AsyncStorage.setItem(KEY_REMINDER_DEFAULT, '1');
    }
    if (!settings.studyReminder && !settings.testCountdown) return;

    let perm = await getNotificationPermission();
    if (Platform.OS === 'ios' && perm.status === 'undetermined' && !perm.provisional) {
      try {
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true, allowProvisional: true },
        });
      } catch {}
      perm = await getNotificationPermission();
    }
    if (!canDeliver(perm)) return;

    await rescheduleStudyNudges();
    const testDateIso = progress?.testDate ?? null;
    if (settings.testCountdown && testDateIso && new Date(testDateIso) > new Date()
        && !(await AsyncStorage.getItem(KEY_TEST_COUNTDOWN))) {
      try { await scheduleTestCountdown(testDateIso, progress?.readinessScore ?? 0); } catch {}
    }
  } catch {}
}

/** The full permission prompt (banners and sound) with reminders on, from
 *  the post-onboarding screen. Returns false if the learner declined, in
 *  which case the OS allows nothing and the Settings toggle explains how to
 *  turn notifications back on. */
export async function askForFullReminders(): Promise<boolean> {
  if (isWeb()) return false;
  await AsyncStorage.setItem(KEY_REMINDER_DEFAULT, '1');
  return enableStudyReminders(19, 0).catch(() => false);
}

// ─── Reminder offer bookkeeping ───────────────────────────────────────────────

export async function loadReminderAskState(): Promise<ReminderAskState> {
  try {
    const raw = await AsyncStorage.getItem(KEY_REMINDER_ASK);
    if (raw) return { times: 0, lastIso: null, ...(JSON.parse(raw) as Partial<ReminderAskState>) };
  } catch {}
  return { times: 0, lastIso: null };
}

export async function recordReminderAsk(): Promise<void> {
  const s = await loadReminderAskState();
  await AsyncStorage.setItem(KEY_REMINDER_ASK, JSON.stringify({ times: s.times + 1, lastIso: new Date().toISOString() }));
}

// ─── Streak protection ────────────────────────────────────────────────────────

export async function scheduleStreakProtection(streakDays: number): Promise<void> {
  if (isWeb()) return;
  await cancelStreakProtection();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: streakDays > 0
        ? `Your ${streakDays}-day streak ends tonight! 🔥`
        : "Don't break your streak! 🔥",
      body: "Quick 5-minute practice session to keep it alive?",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });

  await AsyncStorage.setItem(KEY_STREAK, id);
}

export async function cancelStreakProtection(): Promise<void> {
  if (isWeb()) return;
  const id = await AsyncStorage.getItem(KEY_STREAK);
  if (id) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    await AsyncStorage.removeItem(KEY_STREAK);
  }
}

// ─── Test countdown ───────────────────────────────────────────────────────────

export async function scheduleTestCountdown(
  testDateIso: string,
  readinessPct: number,
): Promise<void> {
  if (isWeb()) return;
  await cancelTestCountdown();

  const testDate = new Date(testDateIso);
  const now      = new Date();
  const ids: string[] = [];

  const OFFSETS = [
    { days: 7, label: '7 days'    },
    { days: 3, label: '3 days'    },
    { days: 1, label: 'tomorrow!' },
  ];

  for (const { days, label } of OFFSETS) {
    const fireDate = new Date(
      testDate.getFullYear(),
      testDate.getMonth(),
      testDate.getDate() - days,
      9, 0, 0,
    );
    if (fireDate <= now) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Theory test in ${label} 🚗`,
        body: `You're ${readinessPct}% ready — keep going, you've got this!`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });
    ids.push(id);
  }

  await AsyncStorage.setItem(KEY_TEST_COUNTDOWN, JSON.stringify(ids));
}

export async function cancelTestCountdown(): Promise<void> {
  if (isWeb()) return;
  const stored = await AsyncStorage.getItem(KEY_TEST_COUNTDOWN);
  if (stored) {
    const ids: string[] = JSON.parse(stored);
    await Promise.all(ids.map(id => {
      try { return Notifications.cancelScheduledNotificationAsync(id); } catch { return Promise.resolve(); }
    }));
    await AsyncStorage.removeItem(KEY_TEST_COUNTDOWN);
  }
}

// ─── Weekly progress ──────────────────────────────────────────────────────────

export async function scheduleWeeklyProgress(): Promise<void> {
  if (isWeb()) return;
  await cancelWeeklyProgress();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Weekly progress 📊',
      body: "Open ClearPass to see how far you've come this week!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday
      hour: 10,
      minute: 0,
    },
  });

  await AsyncStorage.setItem(KEY_WEEKLY, id);
}

export async function cancelWeeklyProgress(): Promise<void> {
  if (isWeb()) return;
  const id = await AsyncStorage.getItem(KEY_WEEKLY);
  if (id) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    await AsyncStorage.removeItem(KEY_WEEKLY);
  }
}

// ─── Streak protection (one-shot, today) ─────────────────────────────────────

export async function scheduleStreakProtectionNotification(streakCount: number): Promise<void> {
  if (isWeb()) return;
  await cancelStreakProtectionNotification();

  const now = new Date();
  const fireAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0);
  if (now >= fireAt) return; // already past 20:00 today

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: streakCount > 0
          ? `Don't lose your ${streakCount}-day streak!`
          : "Don't break your streak!",
        body: "You haven't studied today -- open ClearPass to keep your streak alive.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
    await AsyncStorage.setItem(KEY_STREAK_TODAY, id);
  } catch {}
}

export async function cancelStreakProtectionNotification(): Promise<void> {
  if (isWeb()) return;
  const id = await AsyncStorage.getItem(KEY_STREAK_TODAY);
  if (id) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    await AsyncStorage.removeItem(KEY_STREAK_TODAY);
  }
}

// ─── Test date countdown notifications ───────────────────────────────────────

export async function scheduleTestCountdownNotifications(testDate: Date): Promise<void> {
  if (isWeb()) return;
  await cancelTestCountdownNotifications();

  const now = new Date();
  const reminders = [
    {
      daysOffset: -7,
      title: 'One week until your theory test!',
      body: "How's your preparation going? Keep up the practice -- you've got this.",
    },
    {
      daysOffset: -1,
      title: 'Your theory test is TOMORROW.',
      body: "Get a good night's sleep -- you've prepared well. You've got this!",
    },
    {
      daysOffset: 0,
      title: "Today's the day!",
      body: 'Good luck on your theory test.',
    },
  ];

  const ids: string[] = [];
  for (const r of reminders) {
    const fireDate = new Date(
      testDate.getFullYear(),
      testDate.getMonth(),
      testDate.getDate() + r.daysOffset,
      9, 0, 0,
    );
    if (fireDate <= now) continue;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
      });
      ids.push(id);
    } catch {}
  }

  if (ids.length > 0) {
    await AsyncStorage.setItem(KEY_TEST_COUNTDOWN_V2, JSON.stringify(ids));
  }
}

export async function cancelTestCountdownNotifications(): Promise<void> {
  if (isWeb()) return;
  const stored = await AsyncStorage.getItem(KEY_TEST_COUNTDOWN_V2);
  if (stored) {
    const ids: string[] = JSON.parse(stored) as string[];
    await Promise.all(
      ids.map(id => { try { return Notifications.cancelScheduledNotificationAsync(id); } catch { return Promise.resolve(); } }),
    );
    await AsyncStorage.removeItem(KEY_TEST_COUNTDOWN_V2);
  }
}

// ─── Mock test reminder ───────────────────────────────────────────────────────

export async function scheduleMockTestReminder(testDateTime: Date, label: string): Promise<string | null> {
  if (isWeb()) return null;
  const fireDate = new Date(testDateTime.getTime() - 30 * 60 * 1000);
  if (fireDate <= new Date()) return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Mock test starting soon',
        body: `Your scheduled mock test "${label}" starts in 30 minutes. Good luck!`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });
    return id;
  } catch { return null; }
}

export async function cancelMockTestReminder(identifier: string): Promise<void> {
  if (isWeb()) return;
  try { await Notifications.cancelScheduledNotificationAsync(identifier); } catch {}
}

// ─── Cancel all ───────────────────────────────────────────────────────────────

export async function cancelAllNotifications(): Promise<void> {
  if (isWeb()) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.multiRemove([
    KEY_STUDY_REMINDER,
    KEY_STUDY_NUDGES,
    KEY_STREAK,
    KEY_TEST_COUNTDOWN,
    KEY_WEEKLY,
  ]);
}

// ─── Foreground handler (call once at app start) ──────────────────────────────

export function configureNotificationHandler(): void {
  if (isWeb()) return;
  // Android 8+ shows nothing without a channel, and on Android 13+ the
  // permission prompt needs one to exist.
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('default', {
      name: 'Study reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => undefined);
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  true,
      shouldSetBadge:   false,
    }),
  });
}
