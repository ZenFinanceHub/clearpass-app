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
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import {
  UserProgress,
  calculateReadiness,
  generateDailyChallenge,
  getXpLevel,
} from '@clearpass/core';
import {
  createFreshUserProgress,
  loadUserProgress,
  saveUserProgress,
  syncPendingUsername,
} from '@/src/storage';
import { supabase } from '@/src/supabase';
import { useTheme } from '@/src/theme';

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
        backgroundColor: '#0D9488',
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
              backgroundColor: '#F59E0B',
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
    state === 'complete' ? '#0D9488' :
    state === 'current'  ? '#6366F1' :
    '#E5E7EB';

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
            backgroundColor: '#6366F1',
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
          shadowColor: state === 'current' ? '#6366F1' : '#D1D5DB',
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
              backgroundColor: '#EEF2FF',
              borderRadius: 6,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderWidth: 1,
              borderColor: '#6366F1',
            }}
          >
            <Text style={{ fontSize: 8, fontWeight: '800', color: '#6366F1', letterSpacing: 0.5 }}>
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

// ─── Daily tips & helpers ─────────────────────────────────────────────────────

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
  const theme = useTheme();

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
      setProgress(updated);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await syncPendingUsername();

        const fresh = await loadUserProgress();
        if (fresh) setProgress(fresh);

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('[HomeScreen] getUser ->', user?.id ?? 'no user', userError ?? 'no error');

        if (!user) {
          const pending = await AsyncStorage.getItem('@clearpass/pending_username');
          if (pending) setUsername(pending);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', user.id)
          .single();

        const displayName = (profile?.full_name as string | null) || (profile?.username as string | null);
        if (displayName) {
          setUsername(displayName);
        } else {
          const pending = await AsyncStorage.getItem('@clearpass/pending_username');
          if (pending) setUsername(pending);
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
  let countdownColor = '#0D9488';
  if (daysLeft !== null) {
    if (daysLeft <= 0) {
      countdownMsg = 'Good luck on your test today!';
      countdownColor = '#6366F1';
    } else if (daysLeft <= 7) {
      countdownMsg = 'Almost there! Make sure you are ready!';
      countdownColor = '#EF4444';
    } else if (daysLeft <= 30) {
      countdownMsg = 'Keep practising hard!';
      countdownColor = '#F59E0B';
    } else {
      countdownMsg = 'You have got plenty of time - stay consistent!';
      countdownColor = '#0D9488';
    }
  }

  const dc    = progress?.dailyChallenge ?? null;
  const dcPct = dc && dc.targetCount > 0
    ? Math.min((dc.currentCount / dc.targetCount) * 100, 100)
    : 0;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.content}
    >
      {/* Hero Header */}
      <LinearGradient colors={['#0D9488', '#6366F1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroHeader}>
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
        <View style={styles.heroBarTrack}>
          <View style={[styles.heroBarFill, { width: `${readinessPct}%` as any }]} />
        </View>
        <Text style={[styles.heroBarLabel, { fontSize: theme.fontSize(11), fontFamily: theme.fontFamily }]}>
          {'Readiness: '}{readinessPct}{'%'}
        </Text>
      </LinearGradient>

      {/* Road Map Hero */}
      <RoadMapHero progress={progress} />

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

      {/* Action Grid */}
      <View style={styles.actionGrid}>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/practice')} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'🎯'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, color: theme.textColor }]}>Practice</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>Random questions</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/mock')} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'📋'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, color: theme.textColor }]}>Mock Test</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>57 minutes</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/learn')} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'📚'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, color: theme.textColor }]}>Learn</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>Highway Code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/hazard')} activeOpacity={0.8}>
            <Text style={styles.actionEmoji}>{'⚠'}</Text>
            <Text style={[styles.actionTitle, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, color: theme.textColor }]}>Hazard</Text>
            <Text style={[styles.actionSub, { fontSize: theme.fontSize(11), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>14 clips</Text>
          </TouchableOpacity>
        </View>
      </View>

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

      {/* Tip Card */}
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>DID YOU KNOW?</Text>
        <Text style={[styles.tipBody, { fontSize: theme.fontSize(13), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(20), color: theme.subTextColor }]}>
          {tip}
        </Text>
      </View>

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
    borderColor: '#E5E7EB',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    margin: 16,
    padding: 24,
    overflow: 'hidden',
  },
  xpDecorCar: { position: 'absolute', top: 12, right: 16, fontSize: 40, opacity: 0.06 },
  xpTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  xpBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: '#6366F1',
  },
  xpBadgeText: { fontSize: 11, fontWeight: '700', color: '#6366F1', letterSpacing: 1 },
  xpScore:     { fontSize: 48, fontWeight: '900', color: '#111827', lineHeight: 56 },
  xpBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  xpBarFill: { height: 6, backgroundColor: '#0D9488', borderRadius: 3 },
  xpMsg:     { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  // ── Countdown Card ────────────────────────────────────────────────────────────
  countdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderTopWidth: 3,
    borderTopColor: '#FBBF24',
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 16,
  },
  countdownTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  countdownLabel:    { fontSize: 11, fontWeight: '700', color: '#FBBF24', letterSpacing: 1 },
  countdownChange:   { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  countdownBody:     { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 6 },
  countdownDays:     { fontSize: 48, fontWeight: '900', color: '#111827', lineHeight: 56 },
  countdownDaysLabel: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
  countdownMsg:      { fontSize: 13, fontWeight: '600' },

  setDateRow:  { marginHorizontal: 16, marginBottom: 4, paddingVertical: 8 },
  setDateText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  // ── Action Grid ───────────────────────────────────────────────────────────────
  actionGrid: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  actionEmoji: { fontSize: 22, marginBottom: 4 },
  actionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 0 },
  actionSub:   { fontSize: 11, fontWeight: '500' },

  // ── Daily Challenge Card ──────────────────────────────────────────────────────
  dcCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderTopWidth: 3,
    borderTopColor: '#0D9488',
    padding: 16,
  },
  dcCardComplete: { opacity: 0.6 },
  dcTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dcLabel:  { fontSize: 11, fontWeight: '700', color: '#0D9488', letterSpacing: 1, flex: 1 },
  dcCompleteBadge: { backgroundColor: '#ECFDF5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  dcCompleteText:  { fontSize: 10, fontWeight: '800', color: '#0D9488', letterSpacing: 0.5 },
  dcXpBadge: {
    backgroundColor: '#F0FDFA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: '#0D9488',
  },
  dcXpText:        { fontSize: 11, fontWeight: '700', color: '#0D9488' },
  dcDesc:          { fontSize: 14, fontWeight: '600', marginBottom: 10, lineHeight: 20 },
  dcDescComplete:  { color: '#6B7280' },
  dcBarTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 6,
  },
  dcBarFill:    { height: 6, backgroundColor: '#0D9488', borderRadius: 3 },
  dcProgress:   { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  // ── Tip Card ──────────────────────────────────────────────────────────────────
  tipCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    padding: 16,
  },
  tipTitle: { fontSize: 11, fontWeight: '700', color: '#6366F1', letterSpacing: 1, marginBottom: 6 },
  tipBody:  { fontSize: 13, lineHeight: 20 },

  // ── Modal ─────────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  modalTitle:    { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  modalSub:      { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  dateInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
    fontSize: 18,
    fontWeight: '600',
    padding: 14,
    marginBottom: 8,
    letterSpacing: 2,
  },
  dateError:      { fontSize: 13, color: '#EF4444', marginBottom: 10 },
  modalSave: {
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  modalSaveText:  { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  modalCancel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
});
