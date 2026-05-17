import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationSettings = {
  studyReminder:    boolean;
  streakProtection: boolean;
  testCountdown:    boolean;
  reminderHour:     number;
  reminderMinute:   number;
};

export const DEFAULT_NOTIF_SETTINGS: NotificationSettings = {
  studyReminder:    false,
  streakProtection: false,
  testCountdown:    false,
  reminderHour:     19,
  reminderMinute:   0,
};

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_SETTINGS       = '@clearpass/notification_settings';
const KEY_STUDY_REMINDER = '@clearpass/notif_study_reminder';
const KEY_STREAK         = '@clearpass/notif_streak_protection';
const KEY_TEST_COUNTDOWN = '@clearpass/notif_test_countdown';
const KEY_WEEKLY         = '@clearpass/notif_weekly_progress';

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

// ─── Daily study reminder ─────────────────────────────────────────────────────

export async function scheduleStudyReminder(hour: number, minute: number): Promise<void> {
  if (isWeb()) return;
  await cancelStudyReminder();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to practise! 📚',
      body: "Your daily theory session is waiting. Keep that streak going!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(KEY_STUDY_REMINDER, id);
}

export async function cancelStudyReminder(): Promise<void> {
  if (isWeb()) return;
  const id = await AsyncStorage.getItem(KEY_STUDY_REMINDER);
  if (id) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    await AsyncStorage.removeItem(KEY_STUDY_REMINDER);
  }
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

// ─── Cancel all ───────────────────────────────────────────────────────────────

export async function cancelAllNotifications(): Promise<void> {
  if (isWeb()) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.multiRemove([
    KEY_STUDY_REMINDER,
    KEY_STREAK,
    KEY_TEST_COUNTDOWN,
    KEY_WEEKLY,
  ]);
}

// ─── Foreground handler (call once at app start) ──────────────────────────────

export function configureNotificationHandler(): void {
  if (isWeb()) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  true,
      shouldSetBadge:   false,
    }),
  });
}
