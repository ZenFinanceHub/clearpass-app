import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Linking,
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
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/src/supabase';
import { loadUserProgress, saveUserProgress, createFreshUserProgress } from '@/src/storage';
import { awardXp } from '@clearpass/core';
import { useTheme } from '@/src/theme';
import { CelebrationModal } from '@/src/components/CelebrationModal';

// ── Shared storage helpers (imported by home + settings) ──────────────────────

const RESULT_KEY    = '@clearpass/test_result';
const SUBMITTED_KEY = '@clearpass/has_submitted_result';

export type TestResult = { passed: boolean; score?: number };

export async function getTestResult(): Promise<TestResult | null> {
  try {
    const raw = await AsyncStorage.getItem(RESULT_KEY);
    return raw ? (JSON.parse(raw) as TestResult) : null;
  } catch { return null; }
}

export async function hasSubmittedResult(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(SUBMITTED_KEY)) === 'true'; }
  catch { return false; }
}

async function saveTestResult(result: TestResult): Promise<void> {
  await AsyncStorage.setItem(RESULT_KEY, JSON.stringify(result));
  await AsyncStorage.setItem(SUBMITTED_KEY, 'true');
}

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

// ── PassedFlow ─────────────────────────────────────────────────────────────────

const SCORES = [43, 44, 45, 46, 47, 48, 49, 50];

function PassedFlow() {
  const [selectedScore,   setSelectedScore]   = useState<number | null>(null);
  const [story,           setStory]           = useState('');
  const [shareStory,      setShareStory]      = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showReview,      setShowReview]      = useState(false);

  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -14, duration: 680, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0,   duration: 680, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, [bounceAnim]);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let username: string | null = null;
        try {
          const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
          username = (profile?.username as string) ?? null;
        } catch {}
        await supabase.from('pass_stories').insert({
          user_id:   user.id,
          username,
          score:     selectedScore ?? null,
          test_date: new Date().toISOString().split('T')[0],
          story:     story.trim() || null,
          shared:    shareStory,
        });
      }
      const progress = (await loadUserProgress()) ?? createFreshUserProgress();
      await saveUserProgress(awardXp(progress, 500));
      await saveTestResult({ passed: true, score: selectedScore ?? undefined });
    } catch {
      await saveTestResult({ passed: true, score: selectedScore ?? undefined });
    } finally {
      setSubmitting(false);
    }
    setShowCelebration(true);
  }

  async function handleShare() {
    const scoreText = selectedScore ? ` I scored ${selectedScore}/50.` : '';
    await Share.share({
      message: `I just passed my UK driving theory test!${scoreText} Studied with ClearPass -- highly recommend it. #ClearPass #DrivingTest`,
    });
  }

  async function handleRateApp() {
    const url = Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/clearpass-theory-test/id000000000'
      : 'https://play.google.com/store/apps/details?id=co.uk.getclearpass.app';
    try { await Linking.openURL(url); } catch {}
    setShowReview(false);
    router.replace('/(tabs)/home');
  }

  function handleReviewSkip() {
    setShowReview(false);
    router.replace('/(tabs)/home');
  }

  return (
    <>
      <LinearGradient colors={['#0D9488', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.passedContent} keyboardShouldPersistTaps="handled">

          <Animated.View style={[styles.trophyWrap, { transform: [{ translateY: bounceAnim }] }]}>
            <View style={styles.trophyCircle}>
              <Text style={styles.trophyEmoji}>{'🏆'}</Text>
            </View>
            <Text style={styles.trophyLabel}>{'PASSED'}</Text>
          </Animated.View>

          <Text style={styles.passedHeading}>{'Congratulations!'}</Text>
          <Text style={styles.passedSub}>{'You passed your theory test!'}</Text>

          <View style={styles.scoreSection}>
            <Text style={styles.sectionWhiteLabel}>{'What did you score?'}</Text>
            <View style={styles.scoreGrid}>
              {SCORES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.scorePill, selectedScore === s && styles.scorePillActive]}
                  onPress={() => setSelectedScore(s)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.scorePillText, selectedScore === s && styles.scorePillTextActive]}>
                    {String(s)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.storySection}>
            <Text style={styles.sectionWhiteLabel}>{'Share your experience (optional)'}</Text>
            <TextInput
              style={styles.storyInput}
              value={story}
              onChangeText={(t) => setStory(t.slice(0, 280))}
              placeholder={'I used ClearPass for 3 weeks and passed with...'}
              placeholderTextColor={'rgba(255,255,255,0.45)'}
              multiline
              numberOfLines={4}
              maxLength={280}
            />
            <Text style={styles.charCount}>{String(story.length)}{'/280'}</Text>
          </View>

          <View style={styles.shareToggleRow}>
            <View style={styles.shareToggleText}>
              <Text style={styles.shareToggleLabel}>{'Share my story'}</Text>
              <Text style={styles.shareToggleSub}>{'Appears on our site to inspire others'}</Text>
            </View>
            <Switch
              value={shareStory}
              onValueChange={setShareStory}
              trackColor={{ false: 'rgba(255,255,255,0.3)', true: '#FFFFFF' }}
              thumbColor={shareStory ? '#0D9488' : 'rgba(255,255,255,0.7)'}
              ios_backgroundColor={'rgba(255,255,255,0.3)'}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={() => void handleSubmit()}
            activeOpacity={0.85}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? 'Saving...' : 'Submit & Celebrate'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {showCelebration && (
        <CelebrationModal
          event="test_ready"
          onDismiss={() => {
            setShowCelebration(false);
            void handleShare().finally(() => setShowReview(true));
          }}
        />
      )}

      {showReview && (
        <View style={styles.reviewBackdrop}>
          <View style={styles.reviewCard}>
            <Text style={styles.reviewStars}>{'* * * * *'}</Text>
            <Text style={styles.reviewTitle}>{'Leave us a review?'}</Text>
            <Text style={styles.reviewSub}>
              {'Your feedback helps other learners find ClearPass.'}
            </Text>
            <TouchableOpacity style={styles.reviewBtn} onPress={() => void handleRateApp()} activeOpacity={0.85}>
              <Text style={styles.reviewBtnText}>{'Rate on App Store'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reviewSkip} onPress={handleReviewSkip} activeOpacity={0.75}>
              <Text style={styles.reviewSkipText}>{'Maybe later'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
}

// ── ResitFlow ──────────────────────────────────────────────────────────────────

function ResitFlow() {
  const theme = useTheme();
  const [dateInput, setDateInput] = useState('');
  const [dateError, setDateError] = useState('');
  const [saving,    setSaving]    = useState(false);

  async function handleUpdatePlan() {
    const parsed = parseDdMmYyyy(dateInput.trim());
    if (!parsed) { setDateError('Enter a valid date in DD/MM/YYYY format'); return; }
    if (saving) return;
    setSaving(true);
    try {
      const progress = (await loadUserProgress()) ?? createFreshUserProgress();
      await saveUserProgress({ ...progress, testDate: parsed });
      await saveTestResult({ passed: false });
    } finally {
      setSaving(false);
    }
    router.replace('/(tabs)/home');
  }

  async function handleGoToTutor() {
    await saveTestResult({ passed: false });
    router.push({
      pathname: '/(tabs)/tutor',
      params: {
        freeMessage: "I just sat my theory test and didn't pass. Can you help me understand what to focus on for my resit?",
      },
    });
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.resitContent}
    >
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={styles.backBtnText}>{'<- Back'}</Text>
      </TouchableOpacity>

      <View style={[styles.resitCard, { backgroundColor: theme.cardColor }]}>
        <Text style={[styles.resitIcon, { color: '#0D9488' }]}>{'[OK]'}</Text>
        <Text style={[styles.resitHeading, { color: theme.textColor }]}>{"Don't worry"}</Text>
        <Text style={[styles.resitStat, { color: '#0D9488' }]}>
          {'54% of people need more than one attempt'}
        </Text>
        <Text style={[styles.resitBody, { color: theme.subTextColor }]}>
          {"Let's look at what went wrong and make a plan for your resit."}
        </Text>
      </View>

      <Text style={[styles.resitSectionLabel, { color: theme.textColor }]}>
        {'When is your next test?'}
      </Text>

      <TextInput
        style={[styles.dateInput, { color: theme.textColor, borderColor: theme.borderColor as string }]}
        value={dateInput}
        onChangeText={setDateInput}
        placeholder={'DD/MM/YYYY'}
        placeholderTextColor={'#9CA3AF'}
        keyboardType={'numbers-and-punctuation'}
        maxLength={10}
      />
      {dateError.length > 0 && <Text style={styles.dateError}>{dateError}</Text>}

      <TouchableOpacity
        style={[styles.updatePlanBtn, saving && styles.updatePlanBtnDisabled]}
        onPress={() => void handleUpdatePlan()}
        activeOpacity={0.85}
        disabled={saving}
      >
        <Text style={styles.updatePlanBtnText}>
          {saving ? 'Saving...' : 'Update my study plan'}
        </Text>
      </TouchableOpacity>

      <View style={styles.orDivider}>
        <View style={[styles.orLine, { backgroundColor: theme.borderColor as string }]} />
        <Text style={[styles.orText, { color: theme.subTextColor }]}>{'or'}</Text>
        <View style={[styles.orLine, { backgroundColor: theme.borderColor as string }]} />
      </View>

      <TouchableOpacity style={styles.tutorBtn} onPress={() => void handleGoToTutor()} activeOpacity={0.85}>
        <Text style={styles.tutorBtnText}>{'Go to AI Tutor'}</Text>
      </TouchableOpacity>

      <Text style={[styles.tutorHint, { color: theme.subTextColor }]}>
        {'The AI tutor will help you identify weak areas and build a focused resit plan.'}
      </Text>
    </ScrollView>
  );
}

// ── Root screen ────────────────────────────────────────────────────────────────

export default function IPassedScreen() {
  const params = useLocalSearchParams<{ flow?: string }>();
  const flow = params.flow === 'resit' ? 'resit' : 'passed';
  if (flow === 'resit') return <ResitFlow />;
  return <PassedFlow />;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // ── Passed flow ───────────────────────────────────────────────────────────────
  passedContent: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 60,
    alignItems: 'center',
    gap: 20,
  },

  trophyWrap: {
    alignItems: 'center',
    gap: 14,
  },
  trophyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyEmoji: {
    fontSize: 60,
    lineHeight: 72,
    includeFontPadding: false,
  },
  trophyLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
  },

  passedHeading: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  passedSub: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },

  scoreSection: { width: '100%', gap: 12 },
  storySection:  { width: '100%', gap: 8 },

  sectionWhiteLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },

  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scorePill: {
    width: 52,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  scorePillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scorePillTextActive: {
    color: '#0D9488',
  },

  storyInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    padding: 14,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'right',
  },

  shareToggleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  shareToggleText: { flex: 1, gap: 3 },
  shareToggleLabel: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  shareToggleSub:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 15 },

  submitBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#0D9488', fontSize: 17, fontWeight: '800' },

  // ── Review modal ──────────────────────────────────────────────────────────────
  reviewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    gap: 10,
  },
  reviewStars: {
    fontSize: 22,
    color: '#F59E0B',
    fontWeight: '800',
    letterSpacing: 4,
  },
  reviewTitle: { fontSize: 22, fontWeight: '900', color: '#111827', textAlign: 'center' },
  reviewSub:   { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  reviewBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  reviewBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  reviewSkip:     { paddingVertical: 10 },
  reviewSkipText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },

  // ── Resit flow ────────────────────────────────────────────────────────────────
  resitContent: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 60,
    gap: 16,
  },
  backBtn:     { marginBottom: 4 },
  backBtnText: { fontSize: 14, fontWeight: '600', color: '#0D9488' },

  resitCard: {
    borderRadius: 20,
    padding: 24,
    gap: 10,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    borderTopWidth: 4,
    borderTopColor: '#0D9488',
  },
  resitIcon:    { fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  resitHeading: { fontSize: 26, fontWeight: '900', textAlign: 'center' },
  resitStat:    { fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 20 },
  resitBody:    { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  resitSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  dateInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 18,
    fontWeight: '600',
    padding: 14,
    letterSpacing: 2,
  },
  dateError: { fontSize: 13, color: '#EF4444', marginTop: -8 },

  updatePlanBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  updatePlanBtnDisabled: { opacity: 0.5 },
  updatePlanBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  orLine: { flex: 1, height: 0.5 },
  orText: { fontSize: 13, fontWeight: '600' },

  tutorBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tutorBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  tutorHint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: -8,
  },
});
