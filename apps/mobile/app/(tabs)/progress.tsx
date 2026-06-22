import React, { useEffect, useState } from 'react';
import { loadSRState, SpacedRepetitionState } from '@/src/spacedRepetition';
import { computeAndSavePassProbability, PassProbabilityResult } from '@/src/passProbability';
import { allQuestions } from '@clearpass/content';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '@/src/supabase';
import { router } from 'expo-router';
import {
  ACHIEVEMENTS,
  Achievement,
  MockTestResult,
  TopicCategory,
  UserProgress,
} from '@clearpass/core';
import { getSessionHistory, getTopicAccuracy, getMasteredTopics, loadUserProgress, type SessionHistoryEntry } from '@/src/storage';
import { getProxyUrl } from '@/src/proxyUrl';
import { TOPIC_BADGES, type TopicBadge } from '@/src/badges';
import { getComparativeStats } from '@/src/analytics';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';

const TOPIC_LABELS: Record<TopicCategory, string> = {
  [TopicCategory.Alertness]: 'Alertness',
  [TopicCategory.Attitude]: 'Attitude',
  [TopicCategory.SafetyAndYourVehicle]: 'Safety and Your Vehicle',
  [TopicCategory.SafetyMargins]: 'Safety Margins',
  [TopicCategory.HazardAwareness]: 'Hazard Awareness',
  [TopicCategory.VulnerableRoadUsers]: 'Vulnerable Road Users',
  [TopicCategory.OtherTypes]: 'Other Types of Vehicle',
  [TopicCategory.VehicleHandling]: 'Vehicle Handling',
  [TopicCategory.MotorwayRules]: 'Motorway Rules',
  [TopicCategory.RulesOfTheRoad]: 'Rules of the Road',
  [TopicCategory.RoadAndTrafficSigns]: 'Road and Traffic Signs',
  [TopicCategory.DocumentsAndRegulations]: 'Documents and Regulations',
  [TopicCategory.AccidentsAndEmergencies]: 'Accidents and Emergencies',
  [TopicCategory.VehicleLoading]: 'Vehicle Loading',
};

type PassStory = {
  id: string;
  username: string | null;
  score: number | null;
  story: string | null;
  test_date: string | null;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function bestScore(history: MockTestResult[]): string {
  if (history.length === 0) return '-';
  return `${Math.max(...history.map((r) => r.score))} / 50`;
}

function goalDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 56);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function barColor(pct: number): string {
  if (pct >= 80) return Colors.indigo;
  if (pct >= 50) return '#F59E0B';
  return '#EF4444';
}

function getRank(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Test Ready!', color: '#F59E0B' };
  if (score >= 60) return { label: 'Advanced', color: Colors.indigo };
  if (score >= 40) return { label: 'Intermediate', color: Colors.indigo };
  if (score >= 20) return { label: 'Improving', color: '#3B82F6' };
  return { label: 'Learner', color: '#9CA3AF' };
}

const DISPLAY_ACHIEVEMENTS = ACHIEVEMENTS.filter((a) => !a.id.endsWith('_eligible'));

export default function ProgressScreen() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [srState,  setSrState]  = useState<SpacedRepetitionState | null>(null);
  const [passProb, setPassProb] = useState<PassProbabilityResult | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>([]);
  const [topicAccuracy, setTopicAccuracy] = useState<Record<string, { correct: number; total: number }>>({});
  const [masteredTopics, setMasteredTopics] = useState<string[]>([]);
  const [passStories, setPassStories] = useState<PassStory[]>([]);
  const [hasOwnStory, setHasOwnStory] = useState(false);
  const [loaded,   setLoaded]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    void (async () => {
      const [p, sr, history, acc, mastered] = await Promise.all([
        loadUserProgress(),
        loadSRState(),
        getSessionHistory(),
        getTopicAccuracy(),
        getMasteredTopics(),
      ]);
      setProgress(p);
      setSrState(sr);
      setSessionHistory(history);
      setTopicAccuracy(acc);
      setMasteredTopics(mastered);
      if (p) {
        const prob = await computeAndSavePassProbability(p, sr, allQuestions);
        setPassProb(prob);
      }

      // Load public pass stories
      try {
        const { data: stories } = await supabase
          .from('pass_stories')
          .select('id, username, score, story, test_date')
          .eq('shared', true)
          .order('created_at', { ascending: false })
          .limit(5);
        if (stories) setPassStories(stories as PassStory[]);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: own } = await supabase
            .from('pass_stories')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
          setHasOwnStory(!!own);
        }
      } catch {}

      setLoaded(true);
    })();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const [p, sr, history, acc, mastered] = await Promise.all([
        loadUserProgress(),
        loadSRState(),
        getSessionHistory(),
        getTopicAccuracy(),
        getMasteredTopics(),
      ]);
      setProgress(p);
      setSrState(sr);
      setSessionHistory(history);
      setTopicAccuracy(acc);
      setMasteredTopics(mastered);
      if (p) {
        const prob = await computeAndSavePassProbability(p, sr, allQuestions);
        setPassProb(prob);
      }
    } catch {}
    setRefreshing(false);
  }

  async function handleUpgrade() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth'); return; }
    try {
      const res = await fetch(`${getProxyUrl()}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) await Linking.openURL(data.url);
    } catch {
      router.push('/auth');
    }
  }

  if (!loaded) return null;

  const hasActivity = progress !== null && progress.totalQuestionsAnswered > 0;

  if (!hasActivity) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundColor }]}>
        <Text style={styles.emptyIllustration}>{'📊'}</Text>
        <Text style={[styles.emptyTitle, { fontSize: theme.fontSize(22), fontFamily: theme.fontFamily, color: theme.textColor }]}>
          {'Your stats will appear here'}
        </Text>
        <Text style={[styles.emptyBody, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(22), color: theme.subTextColor }]}>
          {'Answer a few questions and your pass probability, streaks, weak spots and badges will all show up here.'}
        </Text>
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => router.push('/(tabs)/practice')}
          activeOpacity={0.85}
        >
          <Text style={styles.emptyButtonText}>{'Start your first session →'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.emptySecondary}
          onPress={() => router.push('/(tabs)/mock')}
          activeOpacity={0.8}
        >
          <Text style={styles.emptySecondaryText}>{'Or take a full mock test'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const recentTests = [...progress.mockTestHistory]
    .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())
    .slice(0, 5);

  const topics = Object.values(TopicCategory);
  const rank = getRank(progress.readinessScore);

  const unlockedIds = new Set(progress.achievements ?? []);
  const unlockedCount = DISPLAY_ACHIEVEMENTS.filter((a) => unlockedIds.has(a.id)).length;

  const achievementPairs: [Achievement, Achievement | null][] = [];
  for (let i = 0; i < DISPLAY_ACHIEVEMENTS.length; i += 2) {
    achievementPairs.push([
      DISPLAY_ACHIEVEMENTS[i],
      DISPLAY_ACHIEVEMENTS[i + 1] ?? null,
    ]);
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={[styles.content, { backgroundColor: theme.backgroundColor }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void handleRefresh(); }} tintColor={Colors.indigo} />}
    >
      <Text style={[styles.screenTitle, { fontSize: theme.fontSize(26), fontFamily: theme.fontFamily, color: theme.textColor }]}>Your Progress</Text>

      {!(progress.isPro ?? false) && (
        <TouchableOpacity style={styles.proBanner} onPress={() => void handleUpgrade()} activeOpacity={0.85}>
          <View style={styles.proBannerContent}>
            <Text style={styles.proBannerTitle}>Go Pro for £4.99</Text>
            <Text style={styles.proBannerSub}>Unlock unlimited questions, AI tutor and more</Text>
          </View>
          <Text style={styles.proBannerArrow}>{'→'}</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.rankBadge, { borderColor: rank.color }]}>
        <Text style={[styles.rankText, { color: rank.color }]}>{rank.label}</Text>
      </View>

      <View style={styles.goalCard}>
        <Text style={styles.goalCardLabel}>YOUR GOAL</Text>
        <Text style={[styles.goalTarget, { fontSize: theme.fontSize(16), fontFamily: theme.fontFamily, color: theme.textColor }]}>Target: Pass by {goalDate()}</Text>
        <View style={styles.goalBarTrack}>
          <View
            style={[
              styles.goalBarFill,
              { width: `${Math.min(progress.readinessScore, 100)}%` as any },
            ]}
          />
        </View>
        <Text
          style={[
            styles.goalStatus,
            { color: progress.readinessScore >= 80 ? Colors.indigo : '#6B7280' },
          ]}
        >
          {progress.readinessScore >= 80
            ? "You're ready to book your test!"
            : "Keep practising - you're getting there!"}
        </Text>
      </View>

      <View style={styles.statGrid}>
        <View style={[styles.statCard, styles.statQuestions]}>
          <Text style={styles.statEmoji}>{'📝'}</Text>
          <Text style={styles.statValue}>{progress.totalQuestionsAnswered}</Text>
          <Text style={styles.statLabel}>{'Questions\nAnswered'}</Text>
        </View>
        <View style={[styles.statCard, styles.statMocks]}>
          <Text style={styles.statEmoji}>{'📋'}</Text>
          <Text style={styles.statValue}>{progress.mockTestHistory.length}</Text>
          <Text style={styles.statLabel}>{'Mock Tests\nTaken'}</Text>
        </View>
        <View style={[styles.statCard, styles.statStreak]}>
          <Text style={styles.statEmoji}>{'🔥'}</Text>
          <Text style={styles.statValue}>{progress.studyStreakDays}</Text>
          <Text style={styles.statLabel}>{'Day\nStreak'}</Text>
        </View>
        <View style={[styles.statCard, styles.statBest]}>
          <Text style={styles.statEmoji}>{'🏆'}</Text>
          <Text style={[styles.statValue, styles.statValueSmall]}>
            {bestScore(progress.mockTestHistory)}
          </Text>
          <Text style={styles.statLabel}>{'Best Mock\nScore'}</Text>
        </View>
      </View>

      {passProb && <PassProbabilityCard result={passProb} />}

      <DueForReviewSection srState={srState} />

      {sessionHistory.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginHorizontal: 16, marginTop: 8, marginBottom: 8 }]}>RECENT SESSIONS</Text>
          <View style={[styles.recentSessionsCard, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
            {sessionHistory.slice(0, 10).map((entry, i) => {
              const pct = entry.total > 0 ? entry.score / entry.total : 0;
              const color = pct >= 0.7 ? '#16A34A' : pct >= 0.5 ? '#D97706' : '#DC2626';
              const mins = Math.floor(entry.durationSeconds / 60);
              const secs = entry.durationSeconds % 60;
              const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
              return (
                <View key={i} style={[styles.recentRow, i < Math.min(sessionHistory.length, 10) - 1 && { borderBottomWidth: 1, borderBottomColor: theme.borderColor }]}>
                  <View style={styles.recentLeft}>
                    <Text style={[styles.recentDate, { color: theme.subTextColor }]}>{formatDate(entry.date)}</Text>
                    <Text style={[styles.recentTopic, { color: theme.textColor }]}>{entry.topic}</Text>
                  </View>
                  <View style={styles.recentRight}>
                    <Text style={[styles.recentScore, { color }]}>{entry.score}/{entry.total}</Text>
                    <Text style={[styles.recentTime, { color: theme.subTextColor }]}>{timeStr}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      <TopicBadgesSection
        topicAccuracy={topicAccuracy}
        masteredTopics={masteredTopics}
      />

      <View style={styles.achievementsHeader}>
        <Text style={styles.sectionLabel}>ACHIEVEMENTS</Text>
        <Text style={styles.achievementsCount}>
          {unlockedCount}{' / '}{DISPLAY_ACHIEVEMENTS.length}{' unlocked'}
        </Text>
      </View>

      <View style={styles.achievementGrid}>
        {achievementPairs.map(([a, b], rowIdx) => (
          <View key={rowIdx} style={styles.achievementRow}>
            <AchievementCard achievement={a} unlocked={unlockedIds.has(a.id)} />
            {b ? (
              <AchievementCard achievement={b} unlocked={unlockedIds.has(b.id)} />
            ) : (
              <View style={styles.achievementCardPlaceholder} />
            )}
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Topic Mastery</Text>
      <View style={styles.topicList}>
        {topics.map((cat) => {
          const pct = progress.topicScores[cat] ?? 0;
          const color = barColor(pct);
          return (
            <View key={cat} style={styles.topicRow}>
              <View style={styles.topicHeader}>
                <Text style={[styles.topicName, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, color: theme.textColor }]}>{TOPIC_LABELS[cat]}</Text>
                <Text style={[styles.topicPct, { color }]}>{pct}{'%'}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct}%` as any, backgroundColor: color },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Pass Stories */}
      {(passStories.length > 0 || !hasOwnStory) && (
        <>
          <Text style={styles.sectionLabel}>{'PASS STORIES'}</Text>
          {!hasOwnStory && (
            <TouchableOpacity
              style={styles.shareStoryBtn}
              onPress={() => router.push('/ipassed' as any)}
              activeOpacity={0.85}
            >
              <Text style={styles.shareStoryBtnText}>{'[*] Share your story'}</Text>
            </TouchableOpacity>
          )}
          {passStories.map(s => (
            <View key={s.id} style={[styles.passStoryCard, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
              <View style={styles.passStoryHeader}>
                <Text style={[styles.passStoryUser, { color: theme.textColor }]}>
                  {s.username ?? 'Anonymous'}
                </Text>
                {s.score !== null && (
                  <View style={styles.passScoreBadge}>
                    <Text style={styles.passScoreText}>{String(s.score)}{'/50'}</Text>
                  </View>
                )}
              </View>
              {s.story ? (
                <Text style={[styles.passStoryBody, { color: theme.subTextColor }]} numberOfLines={3}>
                  {s.story}
                </Text>
              ) : null}
            </View>
          ))}
        </>
      )}

      {recentTests.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Recent Mock Tests</Text>
          <View style={styles.sessionList}>
            {recentTests.map((test) => (
              <View key={test.id} style={styles.sessionCard}>
                <View style={styles.sessionRow}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionDate}>{formatDate(test.takenAt)}</Text>
                    <Text style={styles.sessionDuration}>
                      {formatDuration(test.timeTakenSeconds)}
                    </Text>
                  </View>
                  <View style={styles.sessionRight}>
                    <Text style={styles.sessionScore}>{test.score}{' / 50'}</Text>
                    <View
                      style={[
                        styles.badge,
                        test.passed ? styles.badgePass : styles.badgeFail,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          test.passed ? styles.badgePassText : styles.badgeFailText,
                        ]}
                      >
                        {test.passed ? 'PASS' : 'FAIL'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const BAR_MAX_H = 48;

// ── Pass Probability Card ─────────────────────────────────────────────────────

function CircularProgress({ pct }: { pct: number }) {
  // Half-circle arc (left → top → right = 0% → 100%).
  // Uses per-side border colours on a circle clipped to its top half.
  // Grey ring is rendered inside each half-clip so it cannot be covered by
  // clip Views that may acquire opaque backgrounds on some platforms.
  //
  // Arc segments (approx. 60° each, covering 0-50% and 50-100%):
  //   borderLeftColor  → 9 o'clock sector  (0-33% of gauge)
  //   borderTopColor   → 12 o'clock sector (33-67%)
  //   borderRightColor → 3 o'clock sector  (67-100%)
  const clamp = Math.min(100, Math.max(0, pct));
  const color = clamp >= 70 ? '#10B981' : clamp >= 45 ? '#F59E0B' : '#EF4444';
  const GREY  = '#E5E7EB';
  const NONE  = 'transparent';

  const leftColor  = clamp > 0  ? color : NONE;
  const topColor   = clamp > 33 ? color : NONE;
  const rightColor = clamp > 67 ? color : NONE;

  return (
    <View style={styles.circleWrapper}>
      {/* Clip to top half only */}
      <View style={styles.circleArcClip}>
        {/* Grey track ring */}
        <View style={[styles.circleRing, {
          borderLeftColor: GREY, borderTopColor: GREY,
          borderRightColor: GREY, borderBottomColor: GREY,
        }]} />
        {/* Coloured arc overlaid on top */}
        <View style={[styles.circleRing, {
          borderLeftColor:   leftColor,
          borderTopColor:    topColor,
          borderRightColor:  rightColor,
          borderBottomColor: NONE,
        }]} />
      </View>
      {/* Text sits below the clipped arc */}
      <View style={styles.circleTextBox}>
        <Text style={[styles.circleNum, { color }]}>{clamp}{'%'}</Text>
        <Text style={styles.circleNumLabel}>probability</Text>
      </View>
    </View>
  );
}

function BreakdownBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.bbRow}>
      <View style={styles.bbLabelRow}>
        <Text style={styles.bbLabel}>{label}</Text>
        <Text style={[styles.bbValue, { color }]}>{value}{'%'}</Text>
      </View>
      <View style={styles.bbTrack}>
        <View style={[styles.bbFill, { width: `${value}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function PassProbabilityCard({ result }: { result: PassProbabilityResult }) {
  const theme = useTheme();
  const { probability, trend, breakdown, weakestArea, recommendation } = result;
  const trendColor  = trend === 'up' ? '#10B981' : trend === 'down' ? '#EF4444' : '#9CA3AF';
  const trendArrow  = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendLabel  = trend === 'up' ? 'improving' : trend === 'down' ? 'declining' : 'stable';

  return (
    <View style={styles.ppCard}>
      <View style={styles.ppHeader}>
        <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>PASS PROBABILITY</Text>
        <View style={[styles.ppTrendBadge, { backgroundColor: trend === 'up' ? '#ECFDF5' : trend === 'down' ? '#FEF2F2' : '#F3F4F6' }]}>
          <Text style={[styles.ppTrendText, { color: trendColor }]}>{trendArrow}{' '}{trendLabel}</Text>
        </View>
      </View>

      <CircularProgress pct={probability} />

      <View style={styles.ppBreakdown}>
        <BreakdownBar
          label="Mock Tests"
          value={breakdown.mockScore}
          color={breakdown.mockScore >= 70 ? '#10B981' : breakdown.mockScore >= 45 ? '#F59E0B' : '#EF4444'}
        />
        <BreakdownBar
          label="Practice Accuracy"
          value={breakdown.accuracyScore}
          color={breakdown.accuracyScore >= 70 ? '#10B981' : breakdown.accuracyScore >= 45 ? '#F59E0B' : '#EF4444'}
        />
        <BreakdownBar
          label="Topic Coverage"
          value={breakdown.coverageScore}
          color={breakdown.coverageScore >= 70 ? '#10B981' : breakdown.coverageScore >= 45 ? '#F59E0B' : '#EF4444'}
        />
        <BreakdownBar
          label="Study Streak"
          value={breakdown.consistencyScore}
          color={breakdown.consistencyScore >= 70 ? '#10B981' : breakdown.consistencyScore >= 45 ? '#F59E0B' : '#EF4444'}
        />
      </View>

      <View style={styles.ppFocusBox}>
        <Text style={styles.ppFocusTitle}>What's holding you back</Text>
        <Text style={[styles.ppFocusArea, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily }]}>{weakestArea}</Text>
        <Text style={[styles.ppFocusRec, { fontSize: theme.fontSize(13), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(20) }]}>{recommendation}</Text>
      </View>
    </View>
  );
}

function DueForReviewSection({ srState }: { srState: SpacedRepetitionState | null }) {
  const theme = useTheme();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const reviewCounts = last7.map(date => srState?.dailyReviewCounts?.[date] ?? 0);
  const maxReviews   = Math.max(...reviewCounts, 1);
  const dueCount     = Object.values(srState?.reviews ?? {})
    .filter(r => r.nextReviewDate <= todayStr)
    .length;

  const totalReviewed = Object.keys(srState?.reviews ?? {}).length;
  if (totalReviewed === 0) return null;

  return (
    <View style={styles.srSection}>
      <Text style={[styles.sectionLabel, { color: theme.subTextColor }]}>DUE FOR REVIEW</Text>

      <View style={styles.srCard}>
        <View style={styles.srCardTop}>
          <View>
            <Text style={styles.srDueCount}>{dueCount}</Text>
            <Text style={[styles.srDueLabel, { color: theme.subTextColor }]}>
              {dueCount === 1 ? 'question due today' : 'questions due today'}
            </Text>
          </View>
          <View style={styles.srCardRight}>
            <Text style={styles.srTotalLabel}>
              {totalReviewed}{' in system'}
            </Text>
          </View>
        </View>

        {dueCount > 0 && (
          <TouchableOpacity
            style={styles.srReviewBtn}
            onPress={() => router.push({ pathname: '/(tabs)/practice', params: { mode: 'review' } })}
            activeOpacity={0.85}
          >
            <Text style={styles.srReviewBtnText}>Start Review Session</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.srChartTitle, { color: theme.subTextColor }]}>Reviews this week</Text>
      <View style={styles.srChartRow}>
        {last7.map((date, i) => {
          const barH = reviewCounts[i] > 0
            ? Math.max(4, Math.round((reviewCounts[i] / maxReviews) * BAR_MAX_H))
            : 0;
          return (
            <View key={date} style={styles.srBarCol}>
              <View style={[styles.srBarTrack, { height: BAR_MAX_H }]}>
                {barH > 0 && <View style={[styles.srBarFill, { height: barH }]} />}
              </View>
              {reviewCounts[i] > 0 && (
                <Text style={styles.srBarCount}>{reviewCounts[i]}</Text>
              )}
              <Text style={[styles.srBarDay, date === todayStr && styles.srBarDayToday]}>
                {DAY_NAMES[new Date(date + 'T00:00:00').getDay()]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TopicBadgesSection({
  topicAccuracy,
  masteredTopics,
}: {
  topicAccuracy: Record<string, { correct: number; total: number }>;
  masteredTopics: string[];
}) {
  const masteredSet = new Set(masteredTopics);
  const theme = useTheme();
  const earned = masteredTopics.length;

  async function handleBadgeTap(badge: TopicBadge, earned: boolean) {
    const acc = topicAccuracy[badge.topic];
    const pct = acc && acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : 0;
    const total = acc?.total ?? 0;
    let platformLine = '';
    try {
      const stats = await getComparativeStats(badge.topic, pct);
      if (stats && stats.totalAnswers >= 50) {
        platformLine = `\nPlatform average: ${stats.platformAvgPct}%`;
      }
    } catch {}
    if (earned) {
      Alert.alert(badge.badgeName, `${badge.topic}\nYour accuracy: ${pct}%${platformLine}\n${badge.description}`);
    } else {
      const qNeeded = Math.max(0, 20 - total);
      const msg = pct >= 80
        ? `${badge.topic}\nAccuracy: ${pct}%${platformLine}\n${qNeeded} more questions needed.`
        : `${badge.topic}\nAccuracy: ${pct}%${platformLine}\nNeed 80%+ on 20+ questions.\n${qNeeded > 0 ? qNeeded + ' more questions needed.' : 'Improve your accuracy to unlock.'}`;
      Alert.alert(`[Locked] ${badge.badgeName}`, msg);
    }
  }

  return (
    <>
      <View style={styles.badgesHeader}>
        <Text style={styles.sectionLabel}>{'TOPIC BADGES'}</Text>
        <Text style={styles.badgesCount}>{earned}{' / '}{TOPIC_BADGES.length}{' earned'}</Text>
      </View>
      <View style={styles.badgeGrid}>
        {TOPIC_BADGES.map(badge => {
          const isEarned = masteredSet.has(badge.topic);
          const acc = topicAccuracy[badge.topic];
          const pct = acc && acc.total > 0 ? Math.round((acc.correct / acc.total) * 100) : 0;
          return (
            <TouchableOpacity
              key={badge.topicCategory}
              style={[styles.badgeCell, isEarned ? styles.badgeCellEarned : styles.badgeCellLocked]}
              onPress={() => void handleBadgeTap(badge, isEarned)}
              activeOpacity={0.75}
            >
              <View style={[styles.badgeIconCircle, { backgroundColor: isEarned ? Colors.indigo : '#E5E7EB' }]}>
                <Text style={[styles.badgeCellIcon, { color: isEarned ? '#FFFFFF' : '#9CA3AF' }]}>
                  {isEarned ? '[v]' : '[x]'}
                </Text>
              </View>
              <Text style={[styles.badgeCellName, { color: isEarned ? theme.textColor : '#9CA3AF' }]} numberOfLines={1}>
                {badge.badgeName}
              </Text>
              {isEarned ? (
                <Text style={styles.badgeCellPct}>{pct}{'%'}</Text>
              ) : (
                <Text style={styles.badgeCellLockLabel}>{'[lock]'}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

function AchievementCard({
  achievement,
  unlocked,
}: {
  achievement: Achievement;
  unlocked: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.achievementCard, unlocked ? styles.achievementUnlocked : styles.achievementLocked]}>
      <View style={styles.achievementCardTop}>
        {unlocked ? (
          <View />
        ) : (
          <Text style={styles.achievementLockedText}>LOCKED</Text>
        )}
        <View style={[styles.achievementXpBadge, unlocked ? styles.achievementXpBadgeUnlocked : styles.achievementXpBadgeLocked]}>
          <Text style={[styles.achievementXpText, unlocked ? styles.achievementXpTextUnlocked : styles.achievementXpTextLocked]}>
            {'+' + achievement.xpReward + ' XP'}
          </Text>
        </View>
      </View>
      <Text
        style={[
          styles.achievementTitle,
          unlocked ? styles.achievementTitleUnlocked : styles.achievementTitleLocked,
          { fontFamily: theme.fontFamily, fontSize: theme.fontSize(unlocked ? 15 : 13) },
        ]}
        numberOfLines={1}
      >
        {achievement.title}
      </Text>
      <Text
        style={[
          styles.achievementDesc,
          unlocked ? styles.achievementDescUnlocked : styles.achievementDescLocked,
          { fontFamily: theme.fontFamily, fontSize: theme.fontSize(11), letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(16) },
        ]}
        numberOfLines={2}
      >
        {achievement.description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIllustration: { fontSize: 56, marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center' },
  emptyBody: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  emptyButton: {
    marginTop: 8,
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  emptySecondary: { marginTop: 4, paddingVertical: 8, paddingHorizontal: 16 },
  emptySecondaryText: { fontSize: 14, fontWeight: '600', color: Colors.indigo },

  screenTitle: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 12 },

  rankBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  rankText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderLeftWidth: 3,
    borderLeftColor: Colors.indigo,
  },
  goalCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 6,
  },
  goalTarget: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  goalBarTrack: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  goalBarFill: { height: 8, backgroundColor: Colors.indigo, borderRadius: 4 },
  goalStatus: { fontSize: 13, fontWeight: '600' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  statCard: {
    flex: 1,
    minWidth: '44%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderTopWidth: 3,
  },
  statQuestions: { borderTopColor: '#EF4444' },
  statMocks: { borderTopColor: Colors.indigo },
  statStreak: { borderTopColor: '#F59E0B' },
  statBest: { borderTopColor: '#10B981' },
  statEmoji: { fontSize: 24, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 4 },
  statValueSmall: { fontSize: 20 },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500', textAlign: 'center' },

  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  achievementsCount: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  achievementGrid: { gap: 10, marginBottom: 28 },
  achievementRow: { flexDirection: 'row', gap: 10 },
  achievementCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  achievementCardPlaceholder: { flex: 1 },
  achievementUnlocked: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.indigo,
  },
  achievementLocked: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  achievementCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  achievementLockedText: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1 },
  achievementXpBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
  },
  achievementXpBadgeUnlocked: { backgroundColor: Colors.indigoBg, borderColor: Colors.indigo },
  achievementXpBadgeLocked: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  achievementXpText: { fontSize: 10, fontWeight: '700' },
  achievementXpTextUnlocked: { color: Colors.indigo },
  achievementXpTextLocked: { color: '#9CA3AF' },
  achievementTitle: { fontWeight: '700', marginBottom: 4 },
  achievementTitleUnlocked: { color: '#111827', fontSize: 15 },
  achievementTitleLocked: { color: '#9CA3AF', fontSize: 13 },
  achievementDesc: { fontSize: 11, lineHeight: 16 },
  achievementDescUnlocked: { color: '#6B7280' },
  achievementDescLocked: { color: '#E5E7EB' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  recentSessionsCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recentLeft: { flex: 1, gap: 2 },
  recentDate: { fontSize: 11, fontWeight: '500' },
  recentTopic: { fontSize: 13, fontWeight: '600' },
  recentRight: { alignItems: 'flex-end', gap: 2 },
  recentScore: { fontSize: 14, fontWeight: '700' },
  recentTime: { fontSize: 11, fontWeight: '500' },

  topicList: { gap: 10, marginBottom: 28 },
  topicRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  topicName: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  topicPct: { fontSize: 13, fontWeight: '700', marginLeft: 8 },
  barTrack: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },

  sessionList: { gap: 10 },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionInfo: { flex: 1 },
  sessionDate: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  sessionDuration: { fontSize: 12, color: '#6B7280' },
  sessionRight: { alignItems: 'flex-end', gap: 6 },
  sessionScore: { fontSize: 18, fontWeight: '800', color: '#111827' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgePass: { backgroundColor: '#ECFDF5' },
  badgeFail: { backgroundColor: '#FEF2F2' },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  badgePassText: { color: Colors.emerald },
  badgeFailText: { color: '#EF4444' },

  // ── Pass Probability Card ─────────────────────────────────────────────────
  ppCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderTopWidth: 3,
    borderTopColor: Colors.indigo,
    padding: 18,
    marginBottom: 24,
  },
  ppHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  ppTrendBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ppTrendText: { fontSize: 12, fontWeight: '700' },

  // Half-circle progress
  circleWrapper: {
    alignSelf: 'center',
    marginBottom: 20,
    alignItems: 'center',
  },
  circleArcClip: {
    width: 120,
    height: 62,
    overflow: 'hidden',
    position: 'relative',
  },
  circleRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 12,
    backgroundColor: 'transparent',
    top: 0,
  },
  circleTextBox: {
    alignItems: 'center',
    marginTop: 6,
  },
  circleNum: { fontSize: 26, fontWeight: '900', lineHeight: 30 },
  circleNumLabel: { fontSize: 10, color: '#6B7280', fontWeight: '600', letterSpacing: 0.5 },

  ppBreakdown: { gap: 10, marginBottom: 16 },
  bbRow: { gap: 4 },
  bbLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bbLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  bbValue: { fontSize: 13, fontWeight: '700' },
  bbTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  bbFill: { height: 6, borderRadius: 3 },

  ppFocusBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  ppFocusTitle: { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  ppFocusArea: { fontSize: 15, fontWeight: '800', color: '#111827' },
  ppFocusRec: { fontSize: 13, color: '#6B7280', lineHeight: 20 },

  // ── Due for Review ────────────────────────────────────────────────────────
  srSection:      { marginBottom: 28 },
  srCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderTopWidth: 3,
    borderTopColor: Colors.indigo,
    padding: 16,
    marginBottom: 12,
  },
  srCardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  srDueCount:     { fontSize: 40, fontWeight: '900', color: Colors.indigo, lineHeight: 46 },
  srDueLabel:     { fontSize: 13, fontWeight: '500', marginTop: 2 },
  srCardRight:    { alignItems: 'flex-end', paddingTop: 4 },
  srTotalLabel:   { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  srReviewBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  srReviewBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  srChartTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  srChartRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-end',
  },
  srBarCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  srBarTrack: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  srBarFill:      { width: '100%', backgroundColor: Colors.indigo, borderRadius: 4 },
  srBarCount:     { fontSize: 10, color: Colors.indigo, fontWeight: '700' },
  srBarDay:       { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  srBarDayToday:  { color: Colors.indigo, fontWeight: '700' },

  // ── Topic Badges ─────────────────────────────────────────────────────────────
  badgesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badgesCount: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  badgeCell: {
    width: '22%',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  badgeCellEarned: { backgroundColor: '#FFFFFF', borderColor: Colors.indigo },
  badgeCellLocked: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  badgeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCellIcon: { fontSize: 10, fontWeight: '800' },
  badgeCellName: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  badgeCellPct: { fontSize: 9, fontWeight: '600', color: Colors.indigo },
  badgeCellLockLabel: { fontSize: 8, color: '#D1D5DB', fontWeight: '600' },

  // ── Pass Stories ─────────────────────────────────────────────────────────────
  shareStoryBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  shareStoryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  passStoryCard: {
    borderRadius: 14,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  passStoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  passStoryUser:   { fontSize: 14, fontWeight: '700' },
  passScoreBadge: {
    backgroundColor: '#F0FDFA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: Colors.indigo,
  },
  passScoreText: { fontSize: 12, fontWeight: '700', color: Colors.emerald },
  passStoryBody: { fontSize: 13, lineHeight: 19 },

  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  proBannerContent: { flex: 1 },
  proBannerTitle: { fontSize: 15, fontWeight: '800', color: '#D97706', marginBottom: 2 },
  proBannerSub: { fontSize: 12, color: '#6B7280' },
  proBannerArrow: { fontSize: 18, color: '#D97706', fontWeight: '700', marginLeft: 8 },
});
