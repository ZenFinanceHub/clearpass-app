import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/supabase';
import { useAccessibility } from '@/src/AccessibilityContext';
import type { AccessibilitySettings } from '@/src/AccessibilityContext';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';
import { calculateReadiness } from '@clearpass/core';
import { allQuestions, highwayCodeChapters, roadSigns } from '@clearpass/content';
import { loadUserProgress, getMasteredTopics } from '@/src/storage';
import { getProxyUrl } from '@/src/proxyUrl';
import { TOPIC_BADGES } from '@/src/badges';
import {
  getCacheStatus,
  cacheQuestions,
  cacheHighwayCode,
  cacheRoadSigns,
  type CacheStatus,
} from '@/src/offlineCache';
import { getTestResult, type TestResult } from '../ipassed';
import { isPremium } from '@/src/subscription';
import {
  NotificationSettings,
  DEFAULT_NOTIF_SETTINGS,
  loadNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermissions,
  scheduleStudyReminder,
  cancelStudyReminder,
  scheduleStreakProtection,
  cancelStreakProtection,
  scheduleTestCountdown,
  cancelTestCountdown,
  showWebAlert,
  showPermissionDeniedAlert,
} from '@/src/notifications';

// ─── Accessibility config ─────────────────────────────────────────────────────

type SettingKey = keyof AccessibilitySettings;

interface SettingConfig {
  key: SettingKey;
  label: string;
  description: string;
  icon: string;
}

const SETTINGS: SettingConfig[] = [
  {
    key: 'darkMode',
    label: 'Dark Mode',
    description: 'Switch to a dark background theme for comfortable night-time studying.',
    icon: '🌙',
  },
  {
    key: 'soundEffects',
    label: 'Sound Effects',
    description: 'Play a chime on correct answers and a low tone on incorrect ones.',
    icon: '🔊',
  },
  {
    key: 'dyslexiaFont',
    label: 'Dyslexia-Friendly Font',
    description: 'Switches to OpenDyslexic font throughout the app to improve readability.',
    icon: '[ Aa ]',
  },
  {
    key: 'largeText',
    label: 'Large Text',
    description: 'Increases the base font size by 20% across all screens.',
    icon: '[ T+ ]',
  },
  {
    key: 'highContrast',
    label: 'High Contrast',
    description: 'Switches to a high contrast colour scheme for improved visibility.',
    icon: '[ HC ]',
  },
  {
    key: 'textToSpeech',
    label: 'Text to Speech',
    description: 'Reads questions aloud automatically when you start a practice session.',
    icon: '[ >> ]',
  },
  {
    key: 'wordSpacing',
    label: 'Increased Spacing',
    description: 'Adds extra letter and word spacing to make text easier to read.',
    icon: '[ sp ]',
  },
  {
    key: 'creamBackground',
    label: 'Cream Background',
    description: 'Replaces the light background with a warm cream tone, easier on the eyes.',
    icon: '[ bg ]',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatTime(hour: number, minute: number): string {
  const h    = hour % 12 || 12;
  const m    = String(minute).padStart(2, '0');
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `Daily at ${h}:${m} ${ampm}`;
}

// ─── SettingsScreen ───────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { settings, setSetting } = useAccessibility();
  const theme = useTheme();

  // Profile state
  const [username, setUsername]           = useState<string | null>(null);
  const [email, setEmail]                 = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName]           = useState('');
  const [saving, setSaving]               = useState(false);
  const [successMsg, setSuccessMsg]       = useState('');

  // Toast
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showSavedToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    toastTimer.current = setTimeout(() => { toastOpacity.setValue(0); }, 2000);
  }

  // Instructor state
  const [linkedInstructorCount, setLinkedInstructorCount] = useState(0);

  // Badge state
  const [earnedBadgeCount, setEarnedBadgeCount] = useState(0);

  // Referral code state
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);

  // Parent email state
  const [parentEmail, setParentEmail]         = useState<string | null>(null);
  const [parentEmailInput, setParentEmailInput] = useState('');
  const [savingParent, setSavingParent]       = useState(false);
  const [parentMsg, setParentMsg]             = useState('');

  // Cache state
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [refreshingCache, setRefreshingCache] = useState(false);

  // Test result state
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [isPro, setIsPro] = useState(false);
  const [freezeCount, setFreezeCount] = useState(0);

  // Notification state
  const [notifSettings, setNotifSettings]   = useState<NotificationSettings>(DEFAULT_NOTIF_SETTINGS);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour, setPickerHour]         = useState(19);
  const [pickerMinute, setPickerMinute]     = useState(0);
  const [userTestDate, setUserTestDate]     = useState<string | null>(null);
  const [userReadiness, setUserReadiness]   = useState(0);
  const [userStreak, setUserStreak]         = useState(0);

  useEffect(() => {
    void (async () => {
      // Load profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email ?? null);
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, referral_code')
          .eq('id', user.id)
          .single();
        if (profile?.username) setUsername(profile.username as string);

        let code = (profile as { referral_code?: string | null } | null)?.referral_code ?? null;
        if (!code && profile?.username) {
          // Generate: first 4 chars of username + 4 random digits
          const prefix = (profile.username as string).replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4).padEnd(4, 'X');
          const digits = String(Math.floor(1000 + Math.random() * 9000));
          code = prefix + digits;
          await supabase.from('profiles').update({ referral_code: code }).eq('id', user.id);
        }
        setMyReferralCode(code);
      }
      if (!username) {
        const pending = await AsyncStorage.getItem('@clearpass/pending_username');
        if (pending) setUsername(pending);
      }

      // Load linked instructor count
      if (user) {
        try {
          const { count } = await supabase
            .from('instructor_relationships')
            .select('id', { count: 'exact', head: true })
            .eq('learner_id', user.id)
            .eq('status', 'accepted');
          setLinkedInstructorCount(count ?? 0);
        } catch {}
      }

      // Load notification settings
      const ns = await loadNotificationSettings();
      setNotifSettings(ns);
      setPickerHour(ns.reminderHour);
      setPickerMinute(ns.reminderMinute);

      // Load progress for scheduling context
      const progress = await loadUserProgress();
      if (progress) {
        setUserTestDate(progress.testDate ?? null);
        setUserReadiness(calculateReadiness(progress).score);
        setUserStreak(progress.studyStreakDays ?? 0);
        setFreezeCount(progress.streakFreezeCount ?? 0);
      }

      // Load badge count
      try {
        const mastered = await getMasteredTopics();
        setEarnedBadgeCount(mastered.length);
      } catch {}

      // Load parent email subscription
      if (user) {
        try {
          const { data: sub } = await supabase
            .from('parent_email_subscriptions')
            .select('parent_email')
            .eq('learner_id', user.id)
            .limit(1)
            .maybeSingle();
          if (sub?.parent_email) setParentEmail(sub.parent_email as string);
        } catch {}
      }

      // Load cache status
      const cs = await getCacheStatus();
      setCacheStatus(cs);

      // Load test result
      const tr = await getTestResult();
      setTestResult(tr);

      // Load subscription status
      const pro = await isPremium();
      setIsPro(pro);
    })();
  }, []);

  // ─── Profile handlers ────────────────────────────────────────────────────

  async function handleSaveProfile() {
    const trimmed = editName.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ username: trimmed }).eq('id', user.id);
      }
      await AsyncStorage.setItem('@clearpass/pending_username', trimmed);
      setUsername(trimmed);
      setSuccessMsg('Profile updated!');
      setTimeout(() => {
        setSuccessMsg('');
        setShowEditModal(false);
        setSaving(false);
      }, 1200);
    } catch {
      setSaving(false);
      Alert.alert('Error', 'Could not update profile. Please try again.');
    }
  }

  async function handleChangePassword() {
    if (!email) {
      Alert.alert('No email', 'No email address found for your account.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Email sent', `Password reset instructions sent to ${email}`);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Everything', style: 'destructive', onPress: () => void doDeleteAccount() },
      ],
    );
  }

  async function doDeleteAccount() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Wipe local storage
      await AsyncStorage.multiRemove([
        '@clearpass/user_progress',
        '@clearpass/question_states',
        '@clearpass/bookmarks',
        '@clearpass/session_history',
        '@clearpass/pending_username',
        '@clearpass/sync_pending',
        '@clearpass/wrong_counts',
        '@clearpass/notification_settings',
        '@clearpass/hasSeenOnboarding',
        '@clearpass/has_submitted_result',
        '@clearpass/test_result',
        '@clearpass/scheduled_mock_tests',
        '@clearpass/free_questions_answered',
      ]);

      if (token) {
        await fetch(`${getProxyUrl()}/api/delete-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userToken: token }),
        });
      }

      await supabase.auth.signOut();
      router.replace('/landing');
    } catch {
      Alert.alert('Error', 'Could not delete account. Please contact privacy@clearpass.app.');
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/onboarding');
  }

  async function handleShareReferralCode() {
    if (!myReferralCode) return;
    await Share.share({
      message: `Use my code ${myReferralCode} on ClearPass to get started with your UK driving theory test prep! Download: getclearpass.co.uk`,
    });
  }

  async function handleCopyReferralCode() {
    if (!myReferralCode) return;
    await Clipboard.setStringAsync(myReferralCode);
    Alert.alert('Copied!', `Code ${myReferralCode} copied to clipboard.`);
  }

  async function handleSaveParentEmail() {
    const trimmed = parentEmailInput.trim().toLowerCase();
    if (!trimmed.includes('@') || savingParent) return;
    setSavingParent(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: sub, error } = await supabase
        .from('parent_email_subscriptions')
        .insert({ learner_id: user.id, parent_email: trimmed })
        .select('confirmation_token')
        .single();
      if (error) throw error;
      await fetch(`${getProxyUrl()}/api/send-parent-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learner_id: user.id, parent_email: trimmed, confirmation_token: (sub as { confirmation_token: string }).confirmation_token }),
      });
      setParentEmail(trimmed);
      setParentEmailInput('');
      setParentMsg('Confirmation email sent!');
      setTimeout(() => setParentMsg(''), 3500);
    } catch {
      Alert.alert('Error', 'Could not save. This email may already be linked to your account.');
    } finally {
      setSavingParent(false);
    }
  }

  async function handleRemoveParentEmail() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('parent_email_subscriptions').delete().eq('learner_id', user.id);
      setParentEmail(null);
      setParentEmailInput('');
    } catch {
      Alert.alert('Error', 'Could not remove parent email.');
    }
  }

  async function handleRefreshCache() {
    if (refreshingCache) return;
    setRefreshingCache(true);
    try {
      await Promise.all([cacheQuestions(), cacheHighwayCode(), cacheRoadSigns()]);
      const cs = await getCacheStatus();
      setCacheStatus(cs);
    } finally {
      setRefreshingCache(false);
    }
  }

  // ─── Notification handlers ───────────────────────────────────────────────

  async function ensurePermission(): Promise<boolean> {
    if (Platform.OS === 'web') { showWebAlert(); return false; }
    const granted = await requestNotificationPermissions();
    if (!granted) { showPermissionDeniedAlert(); return false; }
    return true;
  }

  async function handleToggleStudyReminder(val: boolean) {
    if (val) {
      const ok = await ensurePermission();
      if (!ok) return;
      setPickerHour(notifSettings.reminderHour);
      setPickerMinute(notifSettings.reminderMinute);
      setShowTimePicker(true);
    } else {
      await cancelStudyReminder();
      const updated = { ...notifSettings, studyReminder: false };
      setNotifSettings(updated);
      await saveNotificationSettings(updated);
      showSavedToast();
    }
  }

  async function handleConfirmTimePicker() {
    setShowTimePicker(false);
    await scheduleStudyReminder(pickerHour, pickerMinute);
    const updated: NotificationSettings = {
      ...notifSettings,
      studyReminder:  true,
      reminderHour:   pickerHour,
      reminderMinute: pickerMinute,
    };
    setNotifSettings(updated);
    await saveNotificationSettings(updated);
    showSavedToast();
  }

  function handleCancelTimePicker() {
    setShowTimePicker(false);
  }

  async function handleToggleStreakProtection(val: boolean) {
    if (val) {
      const ok = await ensurePermission();
      if (!ok) return;
      await scheduleStreakProtection(userStreak);
      const updated = { ...notifSettings, streakProtection: true };
      setNotifSettings(updated);
      await saveNotificationSettings(updated);
      showSavedToast();
    } else {
      await cancelStreakProtection();
      const updated = { ...notifSettings, streakProtection: false };
      setNotifSettings(updated);
      await saveNotificationSettings(updated);
      showSavedToast();
    }
  }

  async function handleToggleTestCountdown(val: boolean) {
    if (val) {
      if (!userTestDate) {
        Alert.alert('No test date set', 'Please set your test date on the home screen first.');
        return;
      }
      const ok = await ensurePermission();
      if (!ok) return;
      await scheduleTestCountdown(userTestDate, userReadiness);
      const updated = { ...notifSettings, testCountdown: true };
      setNotifSettings(updated);
      await saveNotificationSettings(updated);
      showSavedToast();
    } else {
      await cancelTestCountdown();
      const updated = { ...notifSettings, testCountdown: false };
      setNotifSettings(updated);
      await saveNotificationSettings(updated);
      showSavedToast();
    }
  }

  // ─── Cache display helpers ────────────────────────────────────────────────

  function formatLastCached(iso: string | undefined): string {
    if (!iso) return 'Not yet cached';
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  }

  // ─── Derived display ─────────────────────────────────────────────────────

  const displayInitials = username ? getInitials(username) : '?';

  const displayHour = pickerHour % 12 || 12;
  const displayAmPm = pickerHour >= 12 ? 'PM' : 'AM';

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.content}
    >
      {/* ══ YOUR ACCOUNT ════════════════════════════════════════════════════════ */}
      <Text style={[styles.sectionHeader, { fontSize: theme.fontSize(13), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>
        {'YOUR ACCOUNT'}
      </Text>

      {/* Subscription status — always at the top of account */}
      <TouchableOpacity
        style={[styles.subscriptionCard, { backgroundColor: isPro ? Colors.indigo : theme.cardColor, borderColor: isPro ? Colors.indigo : Colors.border }]}
        onPress={() => router.push('/paywall')}
        activeOpacity={0.85}
      >
        <View style={styles.subscriptionCardLeft}>
          <Text style={[styles.subscriptionBadge, { color: isPro ? '#FFFFFF' : Colors.indigo }]}>
            {isPro ? '★ ClearPass Pro' : 'Free Plan'}
          </Text>
          <Text style={[styles.subscriptionDetail, { color: isPro ? 'rgba(255,255,255,0.8)' : theme.subTextColor }]}>
            {isPro
              ? 'Unlimited questions · Ask Pip · All mock tests'
              : '10 questions/day · Upgrade for full access'}
          </Text>
        </View>
        <View style={[styles.subscriptionBtn, { backgroundColor: isPro ? 'rgba(255,255,255,0.2)' : Colors.indigo }]}>
          <Text style={styles.subscriptionBtnText}>{isPro ? 'Manage' : 'Upgrade'}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Streak Freeze (Pro only) ────────────────────────────────────────── */}
      {isPro && (
        <View style={[styles.freezeCard, { backgroundColor: theme.cardColor }]}>
          <View style={styles.freezeCardLeft}>
            <Text style={styles.freezeCardTitle}>{'❄️  Streak Freeze'}</Text>
            <Text style={[styles.freezeCardSub, { color: theme.subTextColor }]}>
              {freezeCount > 0
                ? `${freezeCount} freeze${freezeCount === 1 ? '' : 's'} available — automatically used if you miss a day`
                : 'No freezes left — replenishes weekly (up to 2)'}
            </Text>
          </View>
          <View style={[styles.freezeCountBadge, { backgroundColor: freezeCount > 0 ? '#DBEAFE' : Colors.border }]}>
            <Text style={[styles.freezeCountText, { color: freezeCount > 0 ? '#1D4ED8' : Colors.mutedText }]}>{freezeCount}</Text>
          </View>
        </View>
      )}

      {/* ── Profile Section ─────────────────────────────────────────────────── */}
      <Text style={[styles.sectionHeader, { fontSize: theme.fontSize(22), fontFamily: theme.fontFamily, color: theme.textColor }]}>
        {'Profile'}
      </Text>

      <View style={[styles.profileCard, { backgroundColor: theme.cardColor }]}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayInitials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { fontSize: theme.fontSize(16), color: theme.textColor }]} numberOfLines={1}>
              {username ?? 'User'}
            </Text>
            {email ? (
              <Text style={[styles.profileEmail, { fontSize: theme.fontSize(13), color: theme.subTextColor }]} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => {
              setEditName(username ?? '');
              setSuccessMsg('');
              setShowEditModal(true);
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.editProfileBtnText}>{'Edit Profile'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.profileBadgeRow}>
          <Text style={[styles.profileBadgeText, { color: theme.subTextColor }]}>
            {'[*] '}{earnedBadgeCount}{' / '}{TOPIC_BADGES.length}{' topics mastered'}
          </Text>
        </View>
        {myReferralCode && (
          <View style={styles.referralRow}>
            <View style={styles.referralLeft}>
              <Text style={[styles.referralLabel, { color: theme.subTextColor }]}>{'Your code'}</Text>
              <Text style={[styles.referralCode, { color: theme.textColor }]}>{myReferralCode}</Text>
            </View>
            <View style={styles.referralBtns}>
              <TouchableOpacity style={styles.referralCopyBtn} onPress={() => void handleCopyReferralCode()} activeOpacity={0.75}>
                <Text style={styles.referralCopyText}>{'Copy'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.referralShareBtn} onPress={() => void handleShareReferralCode()} activeOpacity={0.75}>
                <Text style={styles.referralShareText}>{'Share'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Account rows ─────────────────────────────────────────────────────── */}
      <View style={[styles.group, { backgroundColor: theme.cardColor }]}>
        <TouchableOpacity
          style={[styles.row, styles.rowBorder]}
          onPress={() => router.push('/ipassed' as any)}
          activeOpacity={0.75}
        >
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>
              {'My Test Result'}
            </Text>
            <Text style={[styles.description, {
              fontSize: theme.fontSize(12),
              color: testResult?.passed ? Colors.indigo : testResult ? '#B45309' : theme.subTextColor,
            }]}>
              {testResult?.passed
                ? 'Passed [V]' + (testResult.score ? ' - Score: ' + String(testResult.score) + '/50' : '')
                : testResult
                  ? 'Resit booked'
                  : 'Record your test result ->'}
            </Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.row, styles.rowBorder]}
          onPress={() => router.push('/instructor?mode=learner' as any)}
          activeOpacity={0.75}
        >
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Linked Instructors'}</Text>
            <Text style={[styles.description, { fontSize: theme.fontSize(12), color: theme.subTextColor }]}>
              {linkedInstructorCount > 0
                ? `${linkedInstructorCount} instructor${linkedInstructorCount === 1 ? '' : 's'} monitoring your progress`
                : 'No instructors linked yet'}
            </Text>
          </View>
          <Text style={styles.chevron}>{'›'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.row, styles.rowBorder]}
          onPress={() => void handleChangePassword()}
          activeOpacity={0.75}
        >
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Change Password'}</Text>
          </View>
          <Text style={styles.chevron}>{'›'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.row, styles.rowBorder]}
          onPress={() => router.push('/tutor' as any)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Ask Pip"
        >
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'🦔 Ask Pip'}</Text>
            <Text style={[styles.description, { fontSize: theme.fontSize(12), color: theme.subTextColor }]}>{'Theory questions & app support'}</Text>
          </View>
          <Text style={styles.chevron}>{'›'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={() => router.push('/instructor?mode=instructor' as any)} activeOpacity={0.85}>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Instructor / Parent Dashboard'}</Text>
          </View>
          <Text style={styles.chevron}>{'›'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={() => router.push('/testday' as any)} activeOpacity={0.85}>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'🎯 Test Day Mode'}</Text>
            <Text style={[styles.description, { fontSize: theme.fontSize(12), color: theme.subTextColor }]}>{'Preview test-day conditions'}</Text>
          </View>
          <Text style={styles.chevron}>{'›'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={handleDeleteAccount}
          activeOpacity={0.75}
        >
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: '#EF4444' }]}>{'Delete Account'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ══ APP PREFERENCES ═════════════════════════════════════════════════════ */}
      <Text style={[styles.sectionHeader, { fontSize: theme.fontSize(13), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>
        {'APP PREFERENCES'}
      </Text>

      {/* ── Accessibility Section ────────────────────────────────────────────── */}
      <Text style={[styles.sectionHeader, { fontSize: theme.fontSize(22), fontFamily: theme.fontFamily, color: theme.textColor }]}>
        {'Accessibility'}
      </Text>
      <Text style={[styles.sectionSub, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(20), color: theme.subTextColor }]}>
        {'Customise the app to suit your reading and learning needs.'}
      </Text>

      <View style={[styles.group, { backgroundColor: theme.cardColor }]}>
        {SETTINGS.map((item, index) => (
          <View
            key={item.key}
            style={[styles.row, index < SETTINGS.length - 1 && styles.rowBorder]}
          >
            <View style={styles.iconWrap}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{item.label}</Text>
              <Text style={[styles.description, { fontSize: theme.fontSize(12), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(17), color: theme.subTextColor }]}>{item.description}</Text>
            </View>
            <Switch
              value={settings[item.key]}
              onValueChange={(val) => { setSetting(item.key, val); showSavedToast(); }}
              trackColor={{ false: '#E5E7EB', true: Colors.indigo }}
              thumbColor={settings[item.key] ? '#FFFFFF' : '#9CA3AF'}
              ios_backgroundColor={'#E5E7EB'}
            />
          </View>
        ))}
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          {'Settings are saved automatically and restored each time you open the app.'}
        </Text>
      </View>

      {/* ── Notifications Section ────────────────────────────────────────────── */}
      <Text style={[styles.sectionHeader, { fontSize: theme.fontSize(22), fontFamily: theme.fontFamily, color: theme.textColor }]}>
        {'Notifications'}
      </Text>
      <Text style={[styles.sectionSub, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(20), color: theme.subTextColor }]}>
        {'Stay on track with timely reminders and alerts.'}
      </Text>

      <View style={[styles.group, { backgroundColor: theme.cardColor }]}>
        {/* Daily Study Reminder */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>
              {'Daily Study Reminder'}
            </Text>
            <Text style={[styles.description, { fontSize: theme.fontSize(12), color: theme.subTextColor }]}>
              {notifSettings.studyReminder
                ? formatTime(notifSettings.reminderHour, notifSettings.reminderMinute)
                : 'Get a daily nudge to practise'}
            </Text>
          </View>
          <Switch
            value={notifSettings.studyReminder}
            onValueChange={(val) => void handleToggleStudyReminder(val)}
            trackColor={{ false: '#E5E7EB', true: Colors.indigo }}
            thumbColor={notifSettings.studyReminder ? '#FFFFFF' : '#9CA3AF'}
            ios_backgroundColor={'#E5E7EB'}
          />
        </View>

        {/* Streak Protection */}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>
              {'Streak Protection'}
            </Text>
            <Text style={[styles.description, { fontSize: theme.fontSize(12), color: theme.subTextColor }]}>
              {notifSettings.streakProtection
                ? 'Alert at 8:00 PM if streak at risk'
                : "Reminds you at 8pm when your streak's at risk"}
            </Text>
          </View>
          <Switch
            value={notifSettings.streakProtection}
            onValueChange={(val) => void handleToggleStreakProtection(val)}
            trackColor={{ false: '#E5E7EB', true: Colors.indigo }}
            thumbColor={notifSettings.streakProtection ? '#FFFFFF' : '#9CA3AF'}
            ios_backgroundColor={'#E5E7EB'}
          />
        </View>

        {/* Test Countdown */}
        <View style={styles.row}>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>
              {'Test Countdown Alerts'}
            </Text>
            <Text style={[styles.description, { fontSize: theme.fontSize(12), color: theme.subTextColor }]}>
              {notifSettings.testCountdown
                ? '3 reminders scheduled (7, 3 and 1 day before)'
                : 'Reminders 7, 3 and 1 day before your test'}
            </Text>
          </View>
          <Switch
            value={notifSettings.testCountdown}
            onValueChange={(val) => void handleToggleTestCountdown(val)}
            trackColor={{ false: '#E5E7EB', true: Colors.indigo }}
            thumbColor={notifSettings.testCountdown ? '#FFFFFF' : '#9CA3AF'}
            ios_backgroundColor={'#E5E7EB'}
          />
        </View>
      </View>

      {/* ── Offline Mode Section ────────────────────────────────────────────── */}
      <Text style={[styles.sectionHeader, { fontSize: theme.fontSize(22), fontFamily: theme.fontFamily, color: theme.textColor }]}>
        {'Offline Mode'}
      </Text>
      <Text style={[styles.sectionSub, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(20), color: theme.subTextColor }]}>
        {'All content is available without an internet connection.'}
      </Text>

      <View style={[styles.group, { backgroundColor: theme.cardColor }]}>
        <View style={[styles.cacheRow, styles.rowBorder]}>
          <Text style={styles.cacheIcon}>{cacheStatus?.questions ? '[+]' : '[ ]'}</Text>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Questions'}</Text>
            <Text style={[styles.description, { fontSize: theme.fontSize(12), color: theme.subTextColor }]}>{allQuestions.length}{' questions cached'}</Text>
          </View>
        </View>
        <View style={[styles.cacheRow, styles.rowBorder]}>
          <Text style={styles.cacheIcon}>{cacheStatus?.highwayCode ? '[+]' : '[ ]'}</Text>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Highway Code'}</Text>
            <Text style={[styles.description, { fontSize: theme.fontSize(12), color: theme.subTextColor }]}>{highwayCodeChapters.length}{' chapters cached'}</Text>
          </View>
        </View>
        <View style={[styles.cacheRow, styles.rowBorder]}>
          <Text style={styles.cacheIcon}>{cacheStatus?.roadSigns ? '[+]' : '[ ]'}</Text>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Road Signs'}</Text>
            <Text style={[styles.description, { fontSize: theme.fontSize(12), color: theme.subTextColor }]}>{roadSigns.length}{' signs cached'}</Text>
          </View>
        </View>
        <View style={styles.cacheRow}>
          <Text style={[styles.cacheLastLabel, { color: theme.subTextColor }]}>{'Last cached:'}</Text>
          <Text style={[styles.cacheLastValue, { color: theme.textColor }]}>
            {formatLastCached(cacheStatus?.lastCached)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.refreshCacheBtn, refreshingCache && styles.refreshCacheBtnDisabled]}
        onPress={() => void handleRefreshCache()}
        activeOpacity={0.85}
        disabled={refreshingCache}
      >
        {refreshingCache && <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />}
        <Text style={styles.refreshCacheBtnText}>
          {refreshingCache ? 'Refreshing...' : 'Refresh Cache'}
        </Text>
      </TouchableOpacity>

      {/* ── Parent Updates Section ──────────────────────────────────────────── */}
      <Text style={[styles.sectionHeader, { fontSize: theme.fontSize(22), fontFamily: theme.fontFamily, color: theme.textColor }]}>
        {'Parent Updates'}
      </Text>
      <Text style={[styles.sectionSub, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(20), color: theme.subTextColor }]}>
        {'Send weekly progress summaries to a parent or guardian.'}
      </Text>

      <View style={[styles.group, { backgroundColor: theme.cardColor }]}>
        {parentEmail ? (
          <View style={styles.row}>
            <View style={styles.textWrap}>
              <Text style={[styles.label, { fontSize: theme.fontSize(15), color: theme.textColor }]}>{'Parent email'}</Text>
              <Text style={[styles.description, { color: theme.subTextColor }]}>{parentEmail}</Text>
              {parentMsg.length > 0 && <Text style={styles.parentSuccessText}>{parentMsg}</Text>}
            </View>
            <TouchableOpacity onPress={() => void handleRemoveParentEmail()} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.removeParentText}>{'Remove'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.row, styles.parentInputRow]}>
            <TextInput
              style={[styles.parentEmailInput, { color: theme.textColor, borderColor: parentEmailInput.includes('@') ? Colors.indigo : '#E5E7EB' }]}
              value={parentEmailInput}
              onChangeText={setParentEmailInput}
              placeholder="parent@example.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              editable={!savingParent}
            />
            <TouchableOpacity
              style={[styles.saveParentBtn, (!parentEmailInput.includes('@') || savingParent) && { opacity: 0.5 }]}
              onPress={() => void handleSaveParentEmail()}
              activeOpacity={0.85}
              disabled={!parentEmailInput.includes('@') || savingParent}
            >
              <Text style={styles.saveParentBtnText}>{savingParent ? 'Saving...' : 'Send confirmation'}</Text>
            </TouchableOpacity>
            {parentMsg.length > 0 && <Text style={styles.parentSuccessText}>{parentMsg}</Text>}
          </View>
        )}
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          {'Your parent will receive a confirmation email before updates begin. Updates are sent once a week.'}
        </Text>
      </View>

      {/* ── About Section ────────────────────────────────────────────────────── */}
      <Text style={[styles.sectionHeader, { fontSize: theme.fontSize(22), fontFamily: theme.fontFamily, color: theme.textColor }]}>
        {'About'}
      </Text>

      <View style={[styles.group, { backgroundColor: theme.cardColor }]}>
        <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={() => router.push('/privacy-policy' as any)} activeOpacity={0.75}>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Privacy Policy'}</Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={() => router.push('/terms' as any)} activeOpacity={0.75}>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Terms of Service'}</Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'App Version'}</Text>
          </View>
          <Text style={[styles.description, { color: theme.subTextColor }]}>{'1.0.0'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={() => void handleSignOut()} activeOpacity={0.85}>
        <Text style={styles.signOutBtnText}>{'Sign Out'}</Text>
      </TouchableOpacity>

      {/* ── Edit Profile Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!saving) setShowEditModal(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { fontSize: theme.fontSize(20), color: theme.textColor }]}>
              {'Edit Profile'}
            </Text>

            <Text style={[styles.modalFieldLabel, { color: theme.subTextColor }]}>{'Display Name'}</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.textColor, borderColor: editName.trim().length > 0 ? Colors.indigo : '#E5E7EB' }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your display name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
              editable={!saving}
            />

            {successMsg.length > 0 && (
              <View style={styles.successRow}>
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.modalSaveBtn, saving && styles.modalSaveBtnDisabled]}
              onPress={() => void handleSaveProfile()}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Text style={styles.modalSaveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => { if (!saving) setShowEditModal(false); }}
              activeOpacity={0.85}
              disabled={saving}
            >
              <Text style={styles.modalCancelBtnText}>{'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Time Picker Modal ────────────────────────────────────────────────── */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="fade"
        onRequestClose={handleCancelTimePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { fontSize: theme.fontSize(20), color: theme.textColor }]}>
              {'Daily Reminder Time'}
            </Text>
            <Text style={[styles.modalFieldLabel, { color: theme.subTextColor }]}>
              {'Choose what time to receive your daily study reminder.'}
            </Text>

            <View style={styles.timePickerRow}>
              {/* Hour */}
              <View style={styles.timePickerUnit}>
                <TouchableOpacity
                  style={styles.timePickerArrow}
                  onPress={() => setPickerHour(h => (h + 1) % 24)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.timePickerArrowText}>{'▲'}</Text>
                </TouchableOpacity>
                <Text style={[styles.timePickerValue, { color: theme.textColor }]}>
                  {String(displayHour).padStart(2, '0')}
                </Text>
                <TouchableOpacity
                  style={styles.timePickerArrow}
                  onPress={() => setPickerHour(h => (h + 23) % 24)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.timePickerArrowText}>{'▼'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.timeSeparator, { color: theme.textColor }]}>{':'}</Text>

              {/* Minute */}
              <View style={styles.timePickerUnit}>
                <TouchableOpacity
                  style={styles.timePickerArrow}
                  onPress={() => setPickerMinute(m => (m + 5) % 60)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.timePickerArrowText}>{'▲'}</Text>
                </TouchableOpacity>
                <Text style={[styles.timePickerValue, { color: theme.textColor }]}>
                  {String(pickerMinute).padStart(2, '0')}
                </Text>
                <TouchableOpacity
                  style={styles.timePickerArrow}
                  onPress={() => setPickerMinute(m => (m + 55) % 60)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.timePickerArrowText}>{'▼'}</Text>
                </TouchableOpacity>
              </View>

              {/* AM/PM */}
              <TouchableOpacity
                style={styles.ampmBtn}
                onPress={() => setPickerHour(h => (h + 12) % 24)}
                activeOpacity={0.8}
              >
                <Text style={styles.ampmText}>{displayAmPm}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={() => void handleConfirmTimePicker()}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSaveBtnText}>{'Set Time'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={handleCancelTimePicker}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelBtnText}>{'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>

    {/* Saved toast */}
    <Animated.View style={[styles.savedToast, { opacity: toastOpacity }]} pointerEvents="none">
      <Text style={styles.savedToastText}>{'Saved ✓'}</Text>
    </Animated.View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:   { flex: 1 },
  content:  { padding: 20, paddingBottom: 40, gap: 16 },
  savedToast: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  savedToastText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  sectionHeader: { fontSize: 22, fontWeight: '800', color: '#111827' },

  subscriptionCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subscriptionCardLeft: { flex: 1, marginRight: 12 },
  subscriptionBadge: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  subscriptionDetail: { fontSize: 12, fontWeight: '500', lineHeight: 17 },
  subscriptionBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  subscriptionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  freezeCard: { borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  freezeCardLeft: { flex: 1, gap: 4 },
  freezeCardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  freezeCardSub: { fontSize: 12, lineHeight: 17 },
  freezeCountBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  freezeCountText: { fontSize: 18, fontWeight: '800' },
  sectionSub:    { fontSize: 14, color: '#6B7280', lineHeight: 20, marginTop: -8 },

  // ── Profile Card ─────────────────────────────────────────────────────────────
  profileCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    padding: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText:     { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  profileInfo:    { flex: 1, gap: 3 },
  profileName:    { fontSize: 16, fontWeight: '700', color: '#111827' },
  profileEmail:   { fontSize: 13, color: '#6B7280' },
  editProfileBtn: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.indigo,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  editProfileBtnText: { fontSize: 13, fontWeight: '700', color: Colors.indigo },
  profileBadgeRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
  },
  profileBadgeText: { fontSize: 13, fontWeight: '600' },
  referralRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referralLeft:    { gap: 2 },
  referralLabel:   { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  referralCode:    { fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  referralBtns:    { flexDirection: 'row', gap: 8 },
  referralCopyBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.indigo,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  referralCopyText:  { fontSize: 13, fontWeight: '700', color: Colors.indigo },
  referralShareBtn: {
    borderRadius: 8,
    backgroundColor: Colors.indigo,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  referralShareText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // ── Settings / Notifications group ────────────────────────────────────────────
  group: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  chevron: { fontSize: 22, color: '#6B7280', fontWeight: '400', lineHeight: 26 },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.indigoBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText:    { fontSize: 10, fontWeight: '700', color: Colors.indigo },
  textWrap:    { flex: 1, gap: 2 },
  label:       { fontSize: 15, fontWeight: '600', color: '#111827' },
  description: { fontSize: 12, color: '#6B7280', lineHeight: 17 },

  // ── Cache rows ────────────────────────────────────────────────────────────────
  cacheRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  cacheIcon: { fontSize: 13, fontWeight: '800', color: Colors.indigo, width: 28, textAlign: 'center' },
  cacheLastLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  cacheLastValue: { fontSize: 13, fontWeight: '700' },
  refreshCacheBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.indigo,
    backgroundColor: '#FFFFFF',
    marginTop: -8,
  },
  refreshCacheBtnDisabled: { opacity: 0.5 },
  refreshCacheBtnText: { color: Colors.indigo, fontSize: 15, fontWeight: '700' },

  // ── Note Box ──────────────────────────────────────────────────────────────────
  noteBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.indigo,
    marginTop: -8,
  },
  noteText: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  // ── Parent Email ──────────────────────────────────────────────────────────────
  parentInputRow: { flexDirection: 'column', gap: 10, paddingVertical: 14 },
  parentEmailInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1.5,
    fontSize: 15,
    padding: 12,
    color: '#111827',
  },
  saveParentBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveParentBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  removeParentText: { fontSize: 13, fontWeight: '600', color: '#EF4444' },
  parentSuccessText: { fontSize: 12, color: Colors.indigo, fontWeight: '600', marginTop: 4 },

  // ── Instructor Button ─────────────────────────────────────────────────────────
  instructorBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#0891B2',
    marginBottom: 4,
  },
  instructorBtnText: { color: '#0891B2', fontSize: 16, fontWeight: '700' },

  // ── Test Day Button ───────────────────────────────────────────────────────────
  testDayBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1.5,
    borderColor: Colors.indigo,
    marginBottom: 4,
  },
  testDayBtnText: { color: Colors.indigo, fontSize: 16, fontWeight: '700' },

  // ── Bottom Buttons ────────────────────────────────────────────────────────────
  manageBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  manageBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  signOutBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  signOutBtnText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },

  // ── Modals ────────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  modalTitle:      { fontSize: 20, fontWeight: '800', color: '#111827' },
  modalFieldLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', lineHeight: 18 },
  modalInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1.5,
    fontSize: 16,
    fontWeight: '600',
    padding: 14,
    color: '#111827',
  },
  successRow: {
    backgroundColor: '#F0FDFA',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.indigo,
    marginBottom: -4,
  },
  successText:          { fontSize: 14, fontWeight: '700', color: Colors.indigo, textAlign: 'center' },
  modalSaveBtn:         { backgroundColor: Colors.indigo, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalSaveBtnDisabled: { opacity: 0.6 },
  modalSaveBtnText:     { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalCancelBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelBtnText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },

  // ── Time Picker ───────────────────────────────────────────────────────────────
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  timePickerUnit: {
    alignItems: 'center',
    gap: 6,
  },
  timePickerArrow: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    width: 52,
  },
  timePickerArrowText: { fontSize: 14, color: '#374151', fontWeight: '700' },
  timePickerValue:     { fontSize: 36, fontWeight: '800', lineHeight: 44, minWidth: 52, textAlign: 'center' },
  timeSeparator:       { fontSize: 36, fontWeight: '800', lineHeight: 44, marginBottom: 2 },
  ampmBtn: {
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.indigo,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 4,
    alignSelf: 'center',
  },
  ampmText: { fontSize: 16, fontWeight: '800', color: Colors.indigo },
});
