import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { loadSRState } from '@/src/spacedRepetition';
import { computeAndSavePassProbability, PassProbabilityResult } from '@/src/passProbability';
import { generateNudges, saveNudges, loadNudges, dismissNudge, TutorNudge, NudgeType } from '@/src/tutorNudges';
import { checkAndTriggerCelebrations, CelebrationEvent } from '@/src/celebrations';
import { CelebrationModal } from '@/src/components/CelebrationModal';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { allQuestions } from '@clearpass/content';
import { supabase } from '@/src/supabase';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';
import { useNetwork } from '@/src/NetworkContext';

// ─── Road map constants ───────────────────────────────────────────────────────

const CANVAS_W  = 1600;
const CANVAS_H  = 300;
const ROAD_W    = 28;
const CIRCLE_R  = 28;   // 56px diameter badges
const CAR_SIZE  = 32;
const DASH_LEN  = 14;
const GAP_LEN   = 10;
const DASH_STEP = DASH_LEN + GAP_LEN;

type Point = { x: number; y: number };

// x: 60 start, +220px per step; y: wide amplitude wave between 230 (low) and 100 (high)
const POSITIONS: Point[] = [
  { x:   60, y: 230 },  // Start
  { x:  280, y: 100 },  // First Steps
  { x:  500, y: 230 },  // Getting There
  { x:  720, y: 100 },  // Hazard Aware
  { x:  940, y: 230 },  // Mock Ready
  { x: 1160, y: 100 },  // First Pass
  { x: 1380, y: 230 },  // Consistent
  { x: 1540, y: 100 },  // Test Ready
];

const MILESTONE_LABELS = [
  'Start', 'First Steps', 'Getting There', 'Hazard Aware',
  'Mock Ready', 'First Pass', 'Consistent', 'Test Ready',
];

const MILESTONE_EMOJIS = ['🚗', '📚', '🎯', '⚠', '📝', '✅', '🔁', '🏆'];

// ─── Milestone logic ──────────────────────────────────────────────────────────

function computeMilestone(p: UserProgress | null): number {
  if (!p || p.totalQuestionsAnswered < 1) return 0;

  const totalTopics = Object.keys(p.topicScores).length || 14;
  const attempted = Object.values(p.topicScores).filter(s => s > 0).length;
  if (attempted < Math.ceil(totalTopics * 0.5)) return 1;

  if (!p.hazardPerceptionHistory.some(h => h.passed)) return 2;
  if (p.totalQuestionsAnswered < 200) return 3;
  if (!p.mockTestHistory.some(h => h.passed)) return 4;

  const mh = p.mockTestHistory;
  const twoConsec = mh.some((_, i) => i > 0 && mh[i].passed && mh[i - 1].passed);
  if (!twoConsec) return 5;

  const threeConsec = mh.some(
    (_, i) =>
      i >= 2 &&
      mh[i].passed     && mh[i].score     >= 43 &&
      mh[i-1].passed   && mh[i-1].score   >= 43 &&
      mh[i-2].passed   && mh[i-2].score   >= 43,
  );
  return threeConsec ? 7 : 6;
}

// ─── RoadSegment ─────────────────────────────────────────────────────────────

function RoadSegment({
  from,
  to,
  dashPhase,
}: {
  from: Point;
  to: Point;
  dashPhase: Animated.Value;
}) {
  const dx  = to.x - from.x;
  const dy  = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const cx  = (from.x + to.x) / 2;
  const cy  = (from.y + to.y) / 2;
  const numDashes = Math.ceil(len / DASH_STEP) + 2;

  return (
    <View
      style={{
        position: 'absolute',
        left: cx - len / 2,
        top: cy - ROAD_W / 2,
        width: len,
        height: ROAD_W,
        backgroundColor: Colors.navy,
        overflow: 'hidden',
        transform: [{ rotate: `${angle}deg` }],
      }}
    >
      {/* Centre highlight */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: ROAD_W / 2 - 5,
          height: 10,
          backgroundColor: 'rgba(255,255,255,0.5)',
        }}
      />
      {/* Animated amber dashes scrolling along the road */}
      <Animated.View
        style={{
          position: 'absolute',
          top: ROAD_W / 2 - 2,
          left: -DASH_STEP,
          flexDirection: 'row',
          transform: [{ translateX: dashPhase }],
        }}
      >
        {Array.from({ length: numDashes }, (_, i) => (
          <View
            key={i}
            style={{
              width: DASH_LEN,
              height: 4,
              borderRadius: 2,
              backgroundColor: Colors.amber,
              marginRight: GAP_LEN,
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// ─── MilestoneMarker ─────────────────────────────────────────────────────────

function MilestoneMarker({
  pos,
  state,
  label,
  emoji,
}: {
  pos: Point;
  state: 'complete' | 'current' | 'upcoming';
  label: string;
  emoji: string;
}) {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state !== 'current') {
      glowAnim.stopAnimation();
      glowAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, glowAnim]);

  const isHigh = pos.y < 145;

  const ringColor =
    state === 'complete' ? Colors.emerald :
    state === 'current'  ? Colors.indigo :
    Colors.border;

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.52] });
  const glowScale   = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0,  1.28] });

  const youAreHereTop = isHigh ? pos.y - CIRCLE_R - 26 : pos.y - CIRCLE_R - 50;
  const nameLabelTop  = isHigh ? pos.y + CIRCLE_R + 8  : pos.y - CIRCLE_R - 20;

  return (
    <>
      {/* Breathing glow ring (current only) */}
      {state === 'current' && (
        <Animated.View
          style={{
            position: 'absolute',
            left: pos.x - CIRCLE_R - 12,
            top:  pos.y - CIRCLE_R - 12,
            width:  (CIRCLE_R + 12) * 2,
            height: (CIRCLE_R + 12) * 2,
            borderRadius: CIRCLE_R + 12,
            backgroundColor: Colors.indigo,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          }}
        />
      )}

      {/* Badge circle */}
      <View
        style={{
          position: 'absolute',
          left: pos.x - CIRCLE_R,
          top:  pos.y - CIRCLE_R,
          width:  CIRCLE_R * 2,
          height: CIRCLE_R * 2,
          borderRadius: CIRCLE_R,
          backgroundColor: '#FFFFFF',
          borderWidth: 3,
          borderColor: ringColor,
          alignItems: 'center',
          justifyContent: 'center',
          transform: state === 'current' ? [{ scale: 1.15 }] : undefined,
          shadowColor: state === 'current' ? Colors.indigo : '#D1D5DB',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: state === 'current' ? 0.55 : 0.3,
          shadowRadius: state === 'current' ? 10 : 4,
          elevation: state === 'current' ? 12 : 4,
        }}
      >
        <Text style={{ fontSize: 22, opacity: state === 'upcoming' ? 0.4 : 1 }}>
          {emoji}
        </Text>
      </View>

      {/* Sparkle — completed milestones */}
      {state === 'complete' && (
        <Text
          style={{
            position: 'absolute',
            left: pos.x + CIRCLE_R - 10,
            top:  pos.y - CIRCLE_R - 6,
            fontSize: 12,
          }}
        >
          {'✨'}
        </Text>
      )}

      {/* YOU ARE HERE badge — current milestone */}
      {state === 'current' && (
        <View
          style={{
            position: 'absolute',
            left: pos.x - 46,
            top:  youAreHereTop,
            width: 92,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              backgroundColor: Colors.indigoBg,
              borderRadius: 6,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderWidth: 1,
              borderColor: Colors.indigo,
            }}
          >
            <Text style={{ fontSize: 8, fontWeight: '800', color: Colors.indigo, letterSpacing: 0.5 }}>
              {'YOU ARE HERE'}
            </Text>
          </View>
        </View>
      )}

      {/* Milestone name */}
      <View
        style={{
          position: 'absolute',
          left: pos.x - 40,
          top:  nameLabelTop,
          width: 80,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 13,
              fontWeight: '700',
              color: '#111827',
              textAlign: 'center',
            }}
          >
            {label}
          </Text>
        </View>
      </View>
    </>
  );
}

// ─── RoadMapHero ─────────────────────────────────────────────────────────────

function RoadMapHero({ progress }: { progress: UserProgress | null }) {
  const theme            = useTheme();
  const currentMilestone = computeMilestone(progress);
  const driveAnim        = useRef(new Animated.Value(0)).current;
  const bobAnim          = useRef(new Animated.Value(0)).current;
  const dashPhaseAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    driveAnim.setValue(0);
    const tid = setTimeout(() => {
      Animated.timing(driveAnim, {
        toValue: currentMilestone,
        duration: 1500,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 500);
    return () => clearTimeout(tid);
  }, [currentMilestone, driveAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: -5, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(bobAnim, { toValue: 0,  duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bobAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(dashPhaseAnim, {
        toValue: DASH_STEP,
        duration: 600,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [dashPhaseAnim]);

  const inputRange = POSITIONS.map((_, i) => i);
  const carX = driveAnim.interpolate({
    inputRange,
    outputRange: POSITIONS.map(p => p.x - CAR_SIZE / 2),
    extrapolate: 'clamp',
  });
  const carYBase = driveAnim.interpolate({
    inputRange,
    outputRange: POSITIONS.map(p => p.y - CAR_SIZE / 2),
    extrapolate: 'clamp',
  });
  const carY = Animated.add(carYBase, bobAnim);

  const edgeColor = theme.cardColor;

  return (
    <View style={{ width: '100%', alignItems: 'center', overflow: 'hidden' }}>
      <View style={[styles.roadContainer, { backgroundColor: theme.cardColor }]}>
        <Text style={[styles.roadTitle, { color: theme.subTextColor }]}>{'YOUR JOURNEY'}</Text>

        <View style={styles.roadCanvas}>
          <View style={{ width: CANVAS_W, height: CANVAS_H, alignSelf: 'center' }}>
            {POSITIONS.slice(0, -1).map((pos, i) => (
              <RoadSegment key={i} from={pos} to={POSITIONS[i + 1]} dashPhase={dashPhaseAnim} />
            ))}

            {POSITIONS.map((pos, i) => (
              <MilestoneMarker
                key={i}
                pos={pos}
                state={
                  i < currentMilestone  ? 'complete' :
                  i === currentMilestone ? 'current'  :
                  'upcoming'
                }
                label={MILESTONE_LABELS[i]}
                emoji={MILESTONE_EMOJIS[i]}
              />
            ))}

            <Animated.View
              style={{
                position: 'absolute',
                left: carX,
                top:  carY,
                width: CAR_SIZE,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: CAR_SIZE - 2 }}>{'🚗'}</Text>
              <View style={styles.carShadow} />
            </Animated.View>
          </View>

        <View pointerEvents="none" style={styles.edgeFadeLeft}>
          <View style={[styles.edgeSlice, { opacity: 0.92, backgroundColor: edgeColor }]} />
          <View style={[styles.edgeSlice, { opacity: 0.62, backgroundColor: edgeColor }]} />
          <View style={[styles.edgeSlice, { opacity: 0.30, backgroundColor: edgeColor }]} />
          <View style={[styles.edgeSlice, { opacity: 0.10, backgroundColor: edgeColor }]} />
        </View>

        <View pointerEvents="none" style={styles.edgeFadeRight}>
          <View style={[styles.edgeSlice, { opacity: 0.10, backgroundColor: edgeColor }]} />
          <View style={[styles.edgeSlice, { opacity: 0.30, backgroundColor: edgeColor }]} />
          <View style={[styles.edgeSlice, { opacity: 0.62, backgroundColor: edgeColor }]} />
          <View style={[styles.edgeSlice, { opacity: 0.92, backgroundColor: edgeColor }]} />
        </View>
        </View>
      </View>
    </View>
  );
}

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
}: {
  nudges: TutorNudge[];
  onDismiss: (id: string) => void;
}) {
  if (nudges.length === 0) return null;
  const visible = nudges.slice(0, 2);
  return (
    <View style={styles.nudgesSection}>
      <Text style={styles.nudgesLabel}>{'AI TUTOR TIPS'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nudgesScroll}>
        {visible.map(nudge => {
          const borderColor = NUDGE_BORDER[nudge.type];
          const actionBg    = NUDGE_ACTION_BG[nudge.type];
          const emoji       = NUDGE_EMOJI[nudge.type];
          return (
            <View key={nudge.id} style={[styles.nudgeCard, { borderLeftColor: borderColor }]}>
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
  const { width: winW } = useWindowDimensions();
  const [studyPlan, setStudyPlan] = useState<SimpleStudyPlan | null>(null);
  const cardW: `${number}%` = winW >= 600 ? '30%' : '47%';

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
    >
      {/* Hero Header */}
      <LinearGradient colors={[Colors.indigo, Colors.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroHeader}>
        <View style={styles.heroTopRow}>
          <Text style={[styles.heroGreeting, { fontSize: theme.fontSize(22), fontFamily: theme.fontFamily }]}>
            {'Hey, '}{username ? username + '!' : 'there!'}{' 👋'}
          </Text>
          {streak > 0 && (
            <View style={styles.heroStreakBadge}>
              <Text style={[styles.heroStreakText, { fontSize: theme.fontSize(12), fontFamily: theme.fontFamily }]}>
                {'🔥 '}{streak}{' day streak'}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.heroSub, { fontSize: theme.fontSize(13), fontFamily: theme.fontFamily }]}>
          {daysLeft !== null && daysLeft >= 0
            ? `Your test is in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Keep it up!`
            : 'Set your test date to see countdown'}
        </Text>
        <View style={styles.heroProbRow}>
          <Text style={[styles.heroProbNum, { fontSize: theme.fontSize(48), fontFamily: theme.fontFamily }]}>
            {passProb ? passProb.probability : readinessPct}{'%'}
          </Text>
          {passProb && (
            <Text style={[styles.heroProbArrow, {
              color: passProb.trend === 'up' ? '#6EE7B7' : passProb.trend === 'down' ? '#FCA5A5' : 'rgba(255,255,255,0.45)',
            }]}>
              {passProb.trend === 'up' ? '↑' : passProb.trend === 'down' ? '↓' : '→'}
            </Text>
          )}
        </View>
        <Text style={[styles.heroProbLabel, { fontSize: theme.fontSize(11), fontFamily: theme.fontFamily }]}>
          {'Pass Probability'}
        </Text>
        <View style={styles.heroBarTrack}>
          <View style={[styles.heroBarFill, { width: `${passProb ? passProb.probability : readinessPct}%` as any }]} />
        </View>
      </LinearGradient>

      {/* Road Map Hero */}
      <RoadMapHero progress={progress} />

      {/* Tutor Nudges */}
      <NudgesSection nudges={nudges} onDismiss={(id) => void handleDismissNudge(id)} />

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
          <View style={[styles.xpBarFill, { width: `${Math.round(xpData.pct * 100)}%` as any }]} />
        </View>
        <Text style={styles.xpMsg}>{xpMsg}</Text>
      </View>

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
          <Text style={[styles.countdownMsg, { color: countdownColor }]}>{countdownMsg}</Text>
        </View>
      )}

      {/* Set test date link */}
      {!testDate && (
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
          <TouchableOpacity style={[styles.actionCard, { width: cardW }]} onPress={() => router.push('/(tabs)/practice')} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'🎯'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>Practice</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>Random questions</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, { width: cardW }]} onPress={() => router.push('/(tabs)/mock')} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'📋'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>Mock Test</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>57 minutes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, { width: cardW }]} onPress={() => router.push('/roadsigns' as any)} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'🚦'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>Road Signs</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>89 UK signs</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, { width: cardW }]} onPress={() => router.push('/highwaycode' as any)} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'🛣️'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>Highway Code</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>Official rules</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, { width: cardW }]} onPress={() => router.push('/hazard' as any)} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'⚠️'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>Hazard</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>14 clips</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, { width: cardW }]} onPress={() => router.push('/(tabs)/learn')} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'📊'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), color: theme.textColor }]}>Progress & More</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), color: theme.subTextColor }]}>Leaderboard, AI Tutor</Text>
          </TouchableOpacity>
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
        <Text style={styles.iPassedBtnText}>{'[*] I Passed my Theory Test!'}</Text>
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

  // Hero Header
  heroHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroGreeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  heroStreakBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroStreakText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 14,
    lineHeight: 18,
  },
  heroBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  heroBarFill: {
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  heroBarLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },
  heroProbRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 2,
  },
  heroProbNum: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 52,
  },
  heroProbArrow: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 52,
    paddingBottom: 2,
  },
  heroProbLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // ── Nudges ───────────────────────────────────────────────────────────────────
  nudgesSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
  },
  nudgesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.subtleText,
    letterSpacing: 1,
    marginBottom: 8,
  },
  nudgesScroll: {
    gap: 12,
    paddingRight: 16,
  },
  nudgeCard: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    padding: 14,
    width: 272,
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
  nudgeDismiss: { fontSize: 15, color: Colors.subtleText, lineHeight: 22, fontWeight: '600' },
  nudgeBody: { fontSize: 12, color: Colors.mutedText, lineHeight: 18, marginBottom: 10 },
  nudgeAction: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  nudgeActionText: { fontSize: 12, fontWeight: '700' },

  // ── Road Map Hero ────────────────────────────────────────────────────────────
  roadContainer: {
    width: '100%',
    marginHorizontal: 0,
    paddingHorizontal: 0,
    marginBottom: 8,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
    height: 320,
    overflow: 'hidden',
  },
  roadTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    paddingLeft: 16,
    marginBottom: 4,
  },
  roadCanvas: {
    height: CANVAS_H,
    position: 'relative',
    width: '100%',
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },
  roadScroll: { flex: 1, width: '100%' },

  carShadow: {
    width: 18,
    height: 5,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginTop: -4,
  },

  edgeFadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 40,
    flexDirection: 'row',
    zIndex: 10,
  },
  edgeFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    flexDirection: 'row',
    zIndex: 10,
  },
  edgeSlice: { flex: 1 },

  // ── XP Card ──────────────────────────────────────────────────────────────────
  xpCard: {
    backgroundColor: Colors.cardWhite,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: Colors.border,
    margin: 16,
    padding: 24,
    overflow: 'hidden',
  },
  xpDecorCar: { position: 'absolute', top: 12, right: 16, fontSize: 40, opacity: 0.06 },
  xpTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  xpBadge: {
    backgroundColor: Colors.indigoBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: Colors.indigo,
  },
  xpBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.indigo, letterSpacing: 1 },
  xpScore:     { fontSize: 48, fontWeight: '900', color: Colors.textPrimary, lineHeight: 56 },
  xpBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.surfaceGray,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  xpBarFill: { height: 6, backgroundColor: Colors.indigo, borderRadius: 3 },
  xpMsg:     { fontSize: 12, color: Colors.mutedText, fontWeight: '500' },

  // ── Countdown Card ────────────────────────────────────────────────────────────
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
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
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
  studyPlanChevronText: { fontSize: 22, color: Colors.subtleText, fontWeight: '400', lineHeight: 26 },

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
  qotdTap:     { fontSize: 12, color: Colors.subtleText, fontWeight: '500' },
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
  scheduledItemCancel: { fontSize: 18, color: Colors.subtleText, fontWeight: '600', paddingHorizontal: 4 },

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
  todayTaskChevron: { fontSize: 20, color: Colors.subtleText, fontWeight: '400', marginLeft: 8 },

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
