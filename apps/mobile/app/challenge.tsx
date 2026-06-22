import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { TopicCategory, awardXp } from '@clearpass/core';
import { getProxyUrl } from '@/src/proxyUrl';
import type { Question } from '@clearpass/core';
import { allQuestions } from '@clearpass/content';
import { supabase } from '@/src/supabase';
import { createFreshUserProgress, loadUserProgress, saveUserProgress } from '@/src/storage';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ChallengeStatus = 'pending' | 'accepted' | 'completed' | 'expired';

type ChallengeRecord = {
  id: string;
  challenger_id: string;
  challenger_name: string;
  challenged_id: string | null;
  challenged_email: string | null;
  status: ChallengeStatus;
  topic_category: string | null;
  question_ids: string[];
  challenger_score: number | null;
  challenger_time: number | null;
  challenger_answers: (number | null)[] | null;
  challenged_score: number | null;
  challenged_time: number | null;
  challenged_answers: (number | null)[] | null;
  winner_id: string | null;
  created_at: string;
  expires_at: string;
  share_code: string;
};

type AppView = 'lobby' | 'quiz' | 'results';

// ─── Constants ─────────────────────────────────────────────────────────────────

const CHALLENGE_Q_COUNT = 10;

const TOPIC_OPTIONS: { value: TopicCategory | null; label: string; emoji: string }[] = [
  { value: null,                                label: 'Mixed - All Topics',  emoji: '🎲' },
  { value: TopicCategory.Alertness,             label: 'Alertness',           emoji: '👁' },
  { value: TopicCategory.Attitude,              label: 'Attitude',            emoji: '🧠' },
  { value: TopicCategory.SafetyAndYourVehicle,  label: 'Safety & Vehicle',    emoji: '🔧' },
  { value: TopicCategory.SafetyMargins,         label: 'Safety Margins',      emoji: '📏' },
  { value: TopicCategory.HazardAwareness,       label: 'Hazard Awareness',    emoji: '⚠' },
  { value: TopicCategory.VulnerableRoadUsers,   label: 'Vulnerable Users',    emoji: '🚶' },
  { value: TopicCategory.OtherTypes,            label: 'Other Vehicles',      emoji: '🚛' },
  { value: TopicCategory.VehicleHandling,       label: 'Vehicle Handling',    emoji: '🏎' },
  { value: TopicCategory.MotorwayRules,         label: 'Motorway Rules',      emoji: '🛣' },
  { value: TopicCategory.RulesOfTheRoad,        label: 'Rules of Road',       emoji: '📋' },
  { value: TopicCategory.RoadAndTrafficSigns,   label: 'Road Signs',          emoji: '🪧' },
  { value: TopicCategory.DocumentsAndRegulations, label: 'Documents',         emoji: '📄' },
  { value: TopicCategory.AccidentsAndEmergencies, label: 'Accidents',         emoji: '🚨' },
  { value: TopicCategory.VehicleLoading,        label: 'Vehicle Loading',     emoji: '📦' },
];

const STATUS_COLOR: Record<ChallengeStatus, string> = {
  pending:   '#F59E0B',
  accepted:  '#3B82F6',
  completed: '#10B981',
  expired:   '#9CA3AF',
};

const STATUS_LABEL: Record<ChallengeStatus, string> = {
  pending:   'Pending',
  accepted:  'In Progress',
  completed: 'Completed',
  expired:   'Expired',
};

const LABELS = ['A', 'B', 'C', 'D'];

const XP_CHALLENGE_WIN      = 50;
const XP_CHALLENGE_COMPLETE = 20;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function pickQuestionIds(topic: TopicCategory | null): string[] {
  const pool = topic
    ? allQuestions.filter(q => q.topicCategory === topic)
    : allQuestions;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, CHALLENGE_Q_COUNT).map(q => q.id);
}

function loadQuestionsByIds(ids: string[]): Question[] {
  const map = new Map(allQuestions.map(q => [q.id, q]));
  return ids.map(id => map.get(id)).filter((q): q is Question => q !== undefined);
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : (name.slice(0, 2) || '?').toUpperCase();
}

function topicLabel(cat: string | null): string {
  if (!cat) return 'Mixed';
  return TOPIC_OPTIONS.find(t => t.value === cat)?.label ?? cat;
}

function expiresLabel(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

function isExpired(challenge: ChallengeRecord): boolean {
  return challenge.status !== 'completed' && new Date(challenge.expires_at) < new Date();
}

// ─── ChallengeCard ─────────────────────────────────────────────────────────────

function ChallengeCard({
  challenge,
  myUserId,
  onPlay,
}: {
  challenge: ChallengeRecord;
  myUserId: string;
  onPlay: () => void;
}) {
  const theme    = useTheme();
  const expired  = isExpired(challenge);
  const status: ChallengeStatus = expired ? 'expired' : challenge.status;

  const isChallenger = challenge.challenger_id === myUserId;
  const opponentName = isChallenger
    ? (challenge.challenged_email ?? 'Waiting for opponent...')
    : challenge.challenger_name;

  const myScore  = isChallenger ? challenge.challenger_score  : challenge.challenged_score;
  const oppScore = isChallenger ? challenge.challenged_score  : challenge.challenger_score;

  const canPlay = !expired && (
    (isChallenger  && challenge.challenger_score  === null) ||
    (!isChallenger && challenge.challenged_score  === null)
  );
  const canSeeResults = challenge.status === 'completed';

  const badgeColor = STATUS_COLOR[status];

  return (
    <View style={[styles.challengeCard, expired && styles.challengeCardDimmed, { backgroundColor: theme.cardColor }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardAvatarWrap}>
          <Text style={styles.cardAvatarText}>{getInitials(opponentName)}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardOpponentName, { color: theme.textColor }]} numberOfLines={1}>
            {opponentName}
          </Text>
          <Text style={[styles.cardTopic, { color: theme.subTextColor }]}>
            {topicLabel(challenge.topic_category)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: badgeColor + '22', borderColor: badgeColor }]}>
          <Text style={[styles.statusBadgeText, { color: badgeColor }]}>{STATUS_LABEL[status]}</Text>
        </View>
      </View>

      {myScore !== null && (
        <View style={styles.scoreRow}>
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreLabel}>{'YOU'}</Text>
            <Text style={[styles.scoreNum, { color: Colors.indigo }]}>{myScore}{'/10'}</Text>
          </View>
          <Text style={[styles.vsSmall, { color: theme.subTextColor }]}>{'VS'}</Text>
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreLabel}>{'THEM'}</Text>
            <Text style={[styles.scoreNum, { color: Colors.indigo }]}>
              {oppScore !== null ? `${oppScore}/10` : '--'}
            </Text>
          </View>
        </View>
      )}

      {!expired && (
        <Text style={[styles.expiresText, { color: theme.subTextColor }]}>
          {expiresLabel(challenge.expires_at)}
        </Text>
      )}

      {canPlay && (
        <TouchableOpacity style={styles.playBtn} onPress={onPlay} activeOpacity={0.85}>
          <Text style={styles.playBtnText}>
            {isChallenger ? 'Play My Side' : 'Accept & Play'}
          </Text>
        </TouchableOpacity>
      )}

      {canSeeResults && (
        <TouchableOpacity style={styles.resultsBtn} onPress={onPlay} activeOpacity={0.85}>
          <Text style={styles.resultsBtnText}>{'View Results'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── QuizView ──────────────────────────────────────────────────────────────────

function QuizView({
  challenge,
  questions,
  myUserId,
  onComplete,
}: {
  challenge: ChallengeRecord;
  questions: Question[];
  myUserId: string;
  onComplete: (updated: ChallengeRecord) => void;
}) {
  const theme          = useTheme();
  const [idx, setIdx]  = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(questions.length).fill(null));
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const answersRef     = useRef<(number | null)[]>(Array(questions.length).fill(null));
  const elapsedRef     = useRef(0);
  const submittedRef   = useRef(false);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(e => e + 1);
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function handleSelect(optIdx: number) {
    const next = [...answersRef.current];
    next[idx] = optIdx;
    answersRef.current = next;
    setAnswers([...next]);
  }

  async function handleSubmit() {
    if (submittedRef.current || submitting) return;
    submittedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);

    const finalAnswers = answersRef.current;
    const timeTaken    = elapsedRef.current;

    let score = 0;
    for (let i = 0; i < questions.length; i++) {
      if (finalAnswers[i] === questions[i].correctIndex) score++;
    }

    const isChallenger = challenge.challenger_id === myUserId;
    let updateData: Record<string, unknown>;
    let newStatus: ChallengeStatus = challenge.status;
    let winnerId: string | null    = challenge.winner_id;

    if (isChallenger) {
      updateData = {
        challenger_score:   score,
        challenger_time:    timeTaken,
        challenger_answers: finalAnswers,
      };
    } else {
      const chalScore = challenge.challenger_score;
      const chalTime  = challenge.challenger_time;

      if (chalScore !== null && chalTime !== null) {
        if      (score   > chalScore) winnerId = myUserId;
        else if (chalScore > score)   winnerId = challenge.challenger_id;
        else if (timeTaken < chalTime) winnerId = myUserId;
        else if (chalTime < timeTaken) winnerId = challenge.challenger_id;
        else                           winnerId = null;
        newStatus = 'completed';
      }

      updateData = {
        challenged_score:   score,
        challenged_time:    timeTaken,
        challenged_answers: finalAnswers,
        status:             newStatus,
        winner_id:          winnerId,
      };
    }

    try {
      const { data } = await supabase
        .from('challenges')
        .update(updateData)
        .eq('id', challenge.id)
        .select()
        .single();

      try {
        const xpToAward = (newStatus === 'completed' && winnerId === myUserId)
          ? XP_CHALLENGE_WIN
          : XP_CHALLENGE_COMPLETE;
        const prog    = (await loadUserProgress()) ?? createFreshUserProgress();
        await saveUserProgress(awardXp(prog, xpToAward));
      } catch {}

      onComplete((data as unknown as ChallengeRecord) ?? { ...challenge, ...updateData } as ChallengeRecord);
    } catch {
      Alert.alert('Error', 'Failed to save your score. Please try again.');
      setSubmitting(false);
      submittedRef.current = false;
    }
  }

  if (submitting) {
    return (
      <View style={[styles.flex, styles.centerContent, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={Colors.indigo} />
        <Text style={[styles.calculatingText, { color: theme.textColor }]}>{'Calculating results...'}</Text>
      </View>
    );
  }

  const q            = questions[idx];
  const isOnLast     = idx === questions.length - 1;
  const opponentName = challenge.challenger_id === myUserId
    ? (challenge.challenged_email ?? 'Opponent')
    : challenge.challenger_name;

  if (!q) return null;

  return (
    <View style={[styles.flex, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.quizTopBar}>
        <Text style={[styles.quizVs, { color: theme.subTextColor }]} numberOfLines={1}>
          {'vs '}{opponentName}
        </Text>
        <Text style={styles.quizTimer}>{formatTime(elapsed)}</Text>
        <Text style={[styles.quizCounter, { color: theme.subTextColor }]}>
          {'Q '}{idx + 1}{'/'}{questions.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.quizContent}>
        <View style={[styles.questionCard, { backgroundColor: theme.cardColor }]}>
          <Text style={[styles.questionText, { fontSize: theme.fontSize(17), fontFamily: theme.fontFamily, color: theme.textColor, lineHeight: theme.lineHeight(26) }]}>
            {q.questionText}
          </Text>
        </View>

        <View style={styles.optionList}>
          {q.options.map((opt, optIdx) => {
            const selected = optIdx === answers[idx];
            return (
              <TouchableOpacity
                key={optIdx}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => handleSelect(optIdx)}
                activeOpacity={0.75}
              >
                <View style={[styles.optBadge, selected && styles.optBadgeSelected]}>
                  <Text style={[styles.optBadgeText, selected && styles.optBadgeTextSelected]}>
                    {LABELS[optIdx]}
                  </Text>
                </View>
                <Text style={[styles.optionText, selected && styles.optionTextSelected, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily }]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.quizNavRow}>
          <TouchableOpacity
            style={[styles.quizNavBtn, idx === 0 && styles.quizNavBtnDisabled]}
            onPress={() => setIdx(i => i - 1)}
            disabled={idx === 0}
            activeOpacity={0.75}
          >
            <Text style={[styles.quizNavBtnText, idx === 0 && styles.quizNavBtnDisabledText]}>{'< Prev'}</Text>
          </TouchableOpacity>

          {isOnLast ? (
            <TouchableOpacity style={styles.quizSubmitBtn} onPress={() => void handleSubmit()} activeOpacity={0.85}>
              <Text style={styles.quizSubmitBtnText}>{'Submit'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.quizNavBtn} onPress={() => setIdx(i => i + 1)} activeOpacity={0.75}>
              <Text style={styles.quizNavBtnText}>{'Next >'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── ResultsView ───────────────────────────────────────────────────────────────

function ResultsView({
  challenge,
  myUserId,
  questions,
  onChallengeAgain,
  onHome,
}: {
  challenge: ChallengeRecord;
  myUserId: string;
  questions: Question[];
  onChallengeAgain: () => void;
  onHome: () => void;
}) {
  const theme                   = useTheme();
  const [latest, setLatest]     = useState(challenge);
  const pollRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  const isChallenger  = latest.challenger_id === myUserId;
  const myScore       = isChallenger ? latest.challenger_score   : latest.challenged_score;
  const oppScore      = isChallenger ? latest.challenged_score   : latest.challenger_score;
  const myAnswers     = isChallenger ? latest.challenger_answers : latest.challenged_answers;
  const oppAnswers    = isChallenger ? latest.challenged_answers : latest.challenger_answers;
  const myTime        = isChallenger ? latest.challenger_time    : latest.challenged_time;
  const oppTime       = isChallenger ? latest.challenged_time    : latest.challenger_time;
  const opponentName  = isChallenger ? (latest.challenged_email ?? 'Opponent') : latest.challenger_name;

  const bothDone = myScore !== null && oppScore !== null;
  const iWon     = latest.winner_id === myUserId;
  const isDraw   = bothDone && latest.winner_id === null;

  useEffect(() => {
    if (bothDone) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await supabase.from('challenges').select('*').eq('id', latest.id).single();
        if (data) setLatest(data as unknown as ChallengeRecord);
      } catch {}
    }, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [bothDone, latest.id]);

  function handleShare() {
    const msg = bothDone
      ? `I ${iWon ? 'beat' : isDraw ? 'drew with' : 'lost to'} ${opponentName} on ClearPass! ${myScore}/10 vs ${oppScore}/10. Download ClearPass to challenge me!`
      : `I scored ${myScore}/10 on a ClearPass challenge! Can you beat me?`;
    void Share.share({ message: msg });
  }

  const xpNote = iWon
    ? `+${XP_CHALLENGE_WIN} XP earned for winning!`
    : `+${XP_CHALLENGE_COMPLETE} XP earned for completing!`;

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backRow} onPress={onHome} activeOpacity={0.7}>
        <Text style={styles.backBtn}>{'< Back to Lobby'}</Text>
      </TouchableOpacity>

      {!bothDone ? (
        <View style={[styles.waitingCard, { backgroundColor: theme.cardColor }]}>
          <Text style={styles.waitingEmoji}>{'⏳'}</Text>
          <Text style={[styles.waitingTitle, { color: theme.textColor }]}>
            {'Waiting for '}{opponentName}{'...'}
          </Text>
          <Text style={[styles.waitingSub, { color: theme.subTextColor }]}>
            {'Checking for results every 30 seconds.'}
          </Text>
          {myScore !== null && (
            <View style={styles.myScoreSummary}>
              <Text style={styles.myScoreLabel}>{'YOUR SCORE'}</Text>
              <Text style={[styles.myScoreBig, { color: Colors.indigo }]}>{myScore}{'/10'}</Text>
              {myTime !== null && (
                <Text style={[styles.myScoreTime, { color: theme.subTextColor }]}>{'Time: '}{formatTime(myTime)}</Text>
              )}
            </View>
          )}
          <TouchableOpacity
            style={styles.remindBtn}
            onPress={() => {
              const targetId = latest.challenger_id === myUserId ? latest.challenged_id : latest.challenger_id;
              const senderName = latest.challenger_id === myUserId ? opponentName : latest.challenger_name;
              if (targetId) {
                void fetch(`${getProxyUrl()}/api/send-challenge-notification`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ challenged_user_id: targetId, challenger_username: senderName }),
                }).then(() => Alert.alert('Reminder sent!', `${opponentName} has been notified.`));
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.remindBtnText}>{'Remind '}{opponentName}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <LinearGradient
            colors={isDraw ? ['#6B7280', '#4B5563'] : iWon ? ['#F59E0B', '#D97706'] : [Colors.indigo, Colors.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.winnerBanner}
          >
            <Text style={styles.winnerEmoji}>{isDraw ? '🤝' : iWon ? '🏆' : '🎯'}</Text>
            <Text style={styles.winnerText}>
              {isDraw ? "It's a Draw!" : iWon ? 'You Win!' : `${opponentName} Wins!`}
            </Text>
          </LinearGradient>

          <View style={[styles.scoreCompare, { backgroundColor: theme.cardColor }]}>
            <View style={styles.playerBlock}>
              <View style={[styles.compareAvatar, { backgroundColor: Colors.indigo }]}>
                <Text style={styles.compareAvatarText}>{'ME'}</Text>
              </View>
              <Text style={[styles.comparePlayerName, { color: theme.textColor }]}>{'You'}</Text>
              <Text style={[styles.compareScore, { color: Colors.indigo }]}>{myScore}{'/10'}</Text>
              {myTime !== null && (
                <Text style={[styles.compareTime, { color: theme.subTextColor }]}>{formatTime(myTime)}</Text>
              )}
            </View>

            <Text style={[styles.vsBig, { color: theme.subTextColor }]}>{'VS'}</Text>

            <View style={styles.playerBlock}>
              <View style={[styles.compareAvatar, { backgroundColor: Colors.indigo }]}>
                <Text style={styles.compareAvatarText}>{getInitials(opponentName)}</Text>
              </View>
              <Text style={[styles.comparePlayerName, { color: theme.textColor }]} numberOfLines={1}>
                {opponentName}
              </Text>
              <Text style={[styles.compareScore, { color: Colors.indigo }]}>{oppScore}{'/10'}</Text>
              {oppTime !== null && (
                <Text style={[styles.compareTime, { color: theme.subTextColor }]}>{formatTime(oppTime)}</Text>
              )}
            </View>
          </View>

          <View style={styles.xpEarnedCard}>
            <Text style={styles.xpEarnedText}>{xpNote}</Text>
          </View>

          {myAnswers && oppAnswers && (
            <View style={[styles.breakdownCard, { backgroundColor: theme.cardColor }]}>
              <Text style={[styles.breakdownTitle, { color: theme.subTextColor }]}>{'QUESTION BREAKDOWN'}</Text>
              <View style={styles.breakdownLegend}>
                <View style={styles.legendItem}>
                  <Text style={styles.tickGreen}>{'[V]'}</Text>
                  <Text style={[styles.legendLabel, { color: theme.subTextColor }]}>{' You'}</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.tickIndigo}>{'[V]'}</Text>
                  <Text style={[styles.legendLabel, { color: theme.subTextColor }]}>{' '}{opponentName}</Text>
                </View>
              </View>
              {questions.map((q, qi) => {
                const myOk  = myAnswers[qi]  === q.correctIndex;
                const oppOk = oppAnswers[qi] === q.correctIndex;
                return (
                  <View key={qi} style={[styles.breakdownRow, qi < questions.length - 1 && styles.breakdownRowBorder]}>
                    <Text style={[styles.breakdownQNum, { color: theme.subTextColor }]}>{'Q'}{qi + 1}</Text>
                    <Text style={[styles.breakdownQText, { color: theme.textColor }]} numberOfLines={1}>
                      {q.questionText.length > 36 ? q.questionText.slice(0, 36) + '...' : q.questionText}
                    </Text>
                    <Text style={myOk ? styles.tickGreen : styles.tickRed}>{myOk ? '[V]' : '[X]'}</Text>
                    <Text style={oppOk ? styles.tickIndigo : styles.tickGrey}>{oppOk ? '[V]' : '[X]'}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <TouchableOpacity style={styles.challengeAgainBtn} onPress={onChallengeAgain} activeOpacity={0.85}>
            <Text style={styles.challengeAgainBtnText}>{'Challenge Again'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareResultBtn} onPress={handleShare} activeOpacity={0.85}>
            <Text style={styles.shareResultBtnText}>{'Share Result'}</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.homeBtn} onPress={onHome} activeOpacity={0.85}>
        <Text style={styles.homeBtnText}>{'Back to Lobby'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── LobbyView ─────────────────────────────────────────────────────────────────

function LobbyView({
  myUserId,
  myUsername,
  outgoing,
  incoming,
  loading,
  onRefresh,
  onPlay,
  onViewResults,
}: {
  myUserId: string;
  myUsername: string;
  outgoing: ChallengeRecord[];
  incoming: ChallengeRecord[];
  loading: boolean;
  onRefresh: () => void;
  onPlay: (c: ChallengeRecord) => void;
  onViewResults: (c: ChallengeRecord) => void;
}) {
  const theme = useTheme();

  const [showStartModal, setShowStartModal] = useState(false);
  const [showCodeModal,  setShowCodeModal]  = useState(false);
  const [startStep,      setStartStep]      = useState<1 | 2>(1);
  const [selectedTopic,  setSelectedTopic]  = useState<TopicCategory | null>(null);
  const [inviteMethod,   setInviteMethod]   = useState<'username' | 'link'>('username');
  const [targetUsername, setTargetUsername] = useState('');
  const [creating,       setCreating]       = useState(false);
  const [enterCode,      setEnterCode]      = useState('');
  const [joiningCode,    setJoiningCode]    = useState(false);

  function openStartModal() {
    setStartStep(1);
    setSelectedTopic(null);
    setInviteMethod('username');
    setTargetUsername('');
    setCreating(false);
    setShowStartModal(true);
  }

  async function handleCreateChallenge() {
    if (creating) return;
    setCreating(true);

    const questionIds = pickQuestionIds(selectedTopic);
    const shareCode   = generateShareCode();
    let challengedId: string | null = null;

    if (inviteMethod === 'username' && targetUsername.trim()) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', targetUsername.trim())
        .single();

      if (!profile) {
        Alert.alert('User not found', `No ClearPass user found with username "${targetUsername.trim()}"`);
        setCreating(false);
        return;
      }
      challengedId = profile.id as string;
    }

    const { data, error } = await supabase
      .from('challenges')
      .insert({
        challenger_id:  myUserId,
        challenger_name: myUsername,
        challenged_id:  challengedId,
        topic_category: selectedTopic,
        question_ids:   questionIds,
        share_code:     shareCode,
        expires_at:     new Date(Date.now() + 24 * 3_600_000).toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Failed to create challenge. Please try again.');
      setCreating(false);
      return;
    }

    const created = data as unknown as ChallengeRecord;

    if (inviteMethod === 'link') {
      Alert.alert(
        'Challenge created!',
        `Share this code with your friend:\n\n${shareCode}\n\nThey can enter it on the Challenge screen.`,
        [{ text: 'OK' }],
      );
    }

    // Notify the challenged user if they have a push token
    if (challengedId) {
      void fetch(`${getProxyUrl()}/api/send-challenge-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenged_user_id: challengedId, challenger_username: myUsername }),
      });
    }

    setShowStartModal(false);
    setCreating(false);
    onRefresh();
    onPlay(created);
  }

  async function handleJoinByCode() {
    const code = enterCode.trim().toUpperCase();
    if (code.length !== 8) {
      Alert.alert('Invalid code', 'Please enter an 8-character challenge code.');
      return;
    }
    setJoiningCode(true);

    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('share_code', code)
      .single();

    if (error || !data) {
      Alert.alert('Code not found', 'No challenge found with that code. Please check and try again.');
      setJoiningCode(false);
      return;
    }

    const ch = data as unknown as ChallengeRecord;

    if (ch.challenger_id === myUserId) {
      Alert.alert("That's your own challenge!", 'You cannot accept your own challenge. Share the code with a friend.');
      setJoiningCode(false);
      return;
    }
    if (new Date(ch.expires_at) < new Date()) {
      Alert.alert('Challenge expired', 'This challenge has expired.');
      setJoiningCode(false);
      return;
    }
    if (ch.challenged_id && ch.challenged_id !== myUserId) {
      Alert.alert('Not available', 'This challenge is for a specific user.');
      setJoiningCode(false);
      return;
    }

    if (!ch.challenged_id) {
      await supabase.from('challenges').update({ challenged_id: myUserId }).eq('id', ch.id);
    }

    setJoiningCode(false);
    setShowCodeModal(false);
    setEnterCode('');
    onRefresh();
    onPlay({ ...ch, challenged_id: myUserId });
  }

  const liveOutgoing    = outgoing.filter(c => !isExpired(c));
  const expiredOutgoing = outgoing.filter(c => isExpired(c));

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()} style={styles.lobbyBackBtn} activeOpacity={0.7}>
        <Text style={[styles.backBtn, { color: theme.textColor }]}>{'← Back'}</Text>
      </TouchableOpacity>

      <LinearGradient colors={[Colors.indigo, Colors.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.lobbyHeader}>
        <Text style={styles.lobbyTitle}>{'Challenge a Friend'}</Text>
        <Text style={styles.lobbySub}>{'10 questions. Same quiz. Who wins?'}</Text>
      </LinearGradient>

      <View style={styles.lobbyActionRow}>
        <TouchableOpacity style={styles.startBtn} onPress={openStartModal} activeOpacity={0.85}>
          <Text style={styles.startBtnText}>{'+ Start a Challenge'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.enterCodeBtnSmall, { backgroundColor: theme.cardColor, borderColor: '#E5E7EB' }]}
          onPress={() => { setEnterCode(''); setShowCodeModal(true); }}
          activeOpacity={0.85}
        >
          <Text style={[styles.enterCodeBtnSmallText, { color: theme.textColor }]}>{'Enter a Code'}</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={Colors.indigo} style={{ marginVertical: 20 }} />}

      {incoming.length > 0 && (
        <>
          <Text style={[styles.sectionHeader, { color: theme.subTextColor }]}>{'INCOMING CHALLENGES'}</Text>
          {incoming.map(c => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              myUserId={myUserId}
              onPlay={() => c.status === 'completed' ? onViewResults(c) : onPlay(c)}
            />
          ))}
        </>
      )}

      {(liveOutgoing.length > 0 || expiredOutgoing.length > 0) && (
        <Text style={[styles.sectionHeader, { color: theme.subTextColor }]}>{'MY CHALLENGES'}</Text>
      )}

      {liveOutgoing.map(c => (
        <ChallengeCard
          key={c.id}
          challenge={c}
          myUserId={myUserId}
          onPlay={() => c.status === 'completed' ? onViewResults(c) : onPlay(c)}
        />
      ))}

      {expiredOutgoing.map(c => (
        <ChallengeCard key={c.id} challenge={c} myUserId={myUserId} onPlay={() => {}} />
      ))}

      {!loading && incoming.length === 0 && outgoing.length === 0 && (
        <View style={[styles.emptyState, { backgroundColor: theme.cardColor }]}>
          <Text style={styles.emptyEmoji}>{'⚔'}</Text>
          <Text style={[styles.emptyTitle, { color: theme.textColor }]}>{'No challenges yet'}</Text>
          <Text style={[styles.emptySub, { color: theme.subTextColor }]}>
            {'Challenge a friend to see who knows their theory best!'}
          </Text>
        </View>
      )}

      {/* Start Challenge Modal */}
      <Modal visible={showStartModal} transparent animationType="slide" onRequestClose={() => setShowStartModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.cardColor }]}>
            <View style={styles.dragHandle} />
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>
              {startStep === 1 ? 'Choose a Topic' : 'Invite a Friend'}
            </Text>

            {startStep === 1 && (
              <>
                <ScrollView style={styles.topicScroll} showsVerticalScrollIndicator={false}>
                  {TOPIC_OPTIONS.map(({ value, label, emoji }) => {
                    const sel = value === selectedTopic;
                    return (
                      <TouchableOpacity
                        key={String(value)}
                        style={[styles.topicOption, { borderColor: sel ? Colors.indigo : '#E5E7EB' }, sel && styles.topicOptionSelected]}
                        onPress={() => setSelectedTopic(value)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.topicEmoji}>{emoji}</Text>
                        <Text style={[styles.topicLabel, { color: theme.textColor }, sel && styles.topicLabelSel]}>
                          {label}
                        </Text>
                        {sel && <Text style={styles.topicCheck}>{'✓'}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity style={styles.modalNextBtn} onPress={() => setStartStep(2)} activeOpacity={0.85}>
                  <Text style={styles.modalNextBtnText}>{'Next: Invite Friend'}</Text>
                </TouchableOpacity>
              </>
            )}

            {startStep === 2 && (
              <>
                <View style={styles.inviteMethodRow}>
                  {(['username', 'link'] as const).map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.inviteMethodTab, inviteMethod === m && styles.inviteMethodTabActive]}
                      onPress={() => setInviteMethod(m)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.inviteMethodText, inviteMethod === m && styles.inviteMethodTextActive]}>
                        {m === 'username' ? 'By Username' : 'Share Code'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {inviteMethod === 'username' ? (
                  <TextInput
                    style={[styles.usernameInput, { color: theme.textColor, backgroundColor: theme.backgroundColor }]}
                    value={targetUsername}
                    onChangeText={setTargetUsername}
                    placeholder="Enter their ClearPass username"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                ) : (
                  <View style={styles.linkNoteBox}>
                    <Text style={[styles.linkNote, { color: theme.subTextColor }]}>
                      {'An 8-character code will be generated. Share it with your friend — they enter it using "Enter a Code" on the Challenge screen.'}
                    </Text>
                  </View>
                )}

                <View style={styles.step2Btns}>
                  <TouchableOpacity style={styles.backTabBtn} onPress={() => setStartStep(1)} activeOpacity={0.8}>
                    <Text style={[styles.backTabBtnText, { color: theme.textColor }]}>{'< Back'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.createBtn, creating && { opacity: 0.6 }]}
                    onPress={() => void handleCreateChallenge()}
                    disabled={creating}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.createBtnText}>{creating ? 'Creating...' : 'Create & Play'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowStartModal(false)} activeOpacity={0.7}>
              <Text style={[styles.cancelBtnText, { color: theme.subTextColor }]}>{'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Enter Code Modal */}
      <Modal visible={showCodeModal} transparent animationType="slide" onRequestClose={() => setShowCodeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.cardColor }]}>
            <View style={styles.dragHandle} />
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>{'Enter Challenge Code'}</Text>
            <Text style={[styles.modalSub, { color: theme.subTextColor }]}>
              {'Enter the 8-character code shared by your friend.'}
            </Text>
            <TextInput
              style={[styles.codeInput, { color: theme.textColor, backgroundColor: theme.backgroundColor }]}
              value={enterCode}
              onChangeText={v => setEnterCode(v.toUpperCase())}
              placeholder="XXXXXXXX"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
            />
            <TouchableOpacity
              style={[styles.joinBtn, joiningCode && { opacity: 0.6 }]}
              onPress={() => void handleJoinByCode()}
              disabled={joiningCode}
              activeOpacity={0.85}
            >
              <Text style={styles.joinBtnText}>{joiningCode ? 'Joining...' : 'Join Challenge'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCodeModal(false)} activeOpacity={0.7}>
              <Text style={[styles.cancelBtnText, { color: theme.subTextColor }]}>{'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── ChallengeScreen ───────────────────────────────────────────────────────────

export default function ChallengeScreen() {
  const [view,            setView]            = useState<AppView>('lobby');
  const [myUserId,        setMyUserId]        = useState('');
  const [myUsername,      setMyUsername]      = useState('');
  const [outgoing,        setOutgoing]        = useState<ChallengeRecord[]>([]);
  const [incoming,        setIncoming]        = useState<ChallengeRecord[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [activeChallenge, setActiveChallenge] = useState<ChallengeRecord | null>(null);
  const [quizQuestions,   setQuizQuestions]   = useState<Question[]>([]);

  async function loadChallenges(userId: string) {
    setLoading(true);
    try {
      const [out, inc] = await Promise.all([
        supabase.from('challenges').select('*').eq('challenger_id',  userId).order('created_at', { ascending: false }),
        supabase.from('challenges').select('*').eq('challenged_id',  userId).order('created_at', { ascending: false }),
      ]);
      setOutgoing((out.data  ?? []) as unknown as ChallengeRecord[]);
      setIncoming((inc.data  ?? []) as unknown as ChallengeRecord[]);
    } catch {}
    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/auth/signin'); return; }
        setMyUserId(user.id);
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
        setMyUsername((profile?.username as string | null) ?? 'Unknown');
        await loadChallenges(user.id);
      })();
    }, []),
  );

  function handlePlay(challenge: ChallengeRecord) {
    setQuizQuestions(loadQuestionsByIds(challenge.question_ids));
    setActiveChallenge(challenge);
    setView('quiz');
  }

  function handleViewResults(challenge: ChallengeRecord) {
    setQuizQuestions(loadQuestionsByIds(challenge.question_ids));
    setActiveChallenge(challenge);
    setView('results');
  }

  function handleQuizComplete(updated: ChallengeRecord) {
    setActiveChallenge(updated);
    setView('results');
    if (myUserId) void loadChallenges(myUserId);
  }

  if (view === 'quiz' && activeChallenge) {
    return (
      <QuizView
        challenge={activeChallenge}
        questions={quizQuestions}
        myUserId={myUserId}
        onComplete={handleQuizComplete}
      />
    );
  }

  if (view === 'results' && activeChallenge) {
    return (
      <ResultsView
        challenge={activeChallenge}
        myUserId={myUserId}
        questions={quizQuestions}
        onChallengeAgain={() => setView('lobby')}
        onHome={() => {
          setView('lobby');
          if (myUserId) void loadChallenges(myUserId);
        }}
      />
    );
  }

  return (
    <LobbyView
      myUserId={myUserId}
      myUsername={myUsername}
      outgoing={outgoing}
      incoming={incoming}
      loading={loading}
      onRefresh={() => { if (myUserId) void loadChallenges(myUserId); }}
      onPlay={handlePlay}
      onViewResults={handleViewResults}
    />
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:          { flex: 1 },
  scroll:        { flex: 1 },
  content:       { padding: 16, paddingBottom: 48, gap: 12 },
  centerContent: { alignItems: 'center', justifyContent: 'center', gap: 16 },

  // ── Lobby ──────────────────────────────────────────────────────────────────────
  lobbyHeader: {
    borderRadius: 20,
    padding: 24,
    gap: 6,
    marginBottom: 4,
  },
  lobbyTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  lobbySub:   { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  lobbyActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  startBtn: {
    flex: 1,
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  enterCodeBtnSmall: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  enterCodeBtnSmallText: { fontSize: 14, fontWeight: '600' },

  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
    marginBottom: -4,
  },

  // ── ChallengeCard ──────────────────────────────────────────────────────────────
  challengeCard: {
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    padding: 14,
    gap: 10,
  },
  challengeCardDimmed: { opacity: 0.55 },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardAvatarText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  cardMeta:       { flex: 1, gap: 2 },
  cardOpponentName: { fontSize: 15, fontWeight: '700' },
  cardTopic:        { fontSize: 12 },

  statusBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
  },
  scoreBlock:  { alignItems: 'center', gap: 2 },
  scoreLabel:  { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 1 },
  scoreNum:    { fontSize: 28, fontWeight: '800', lineHeight: 32 },
  vsSmall:     { fontSize: 14, fontWeight: '800' },

  expiresText: { fontSize: 11, fontWeight: '500' },

  playBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  playBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  resultsBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.indigo,
  },
  resultsBtnText: { color: Colors.indigo, fontSize: 15, fontWeight: '700' },

  // ── Quiz ──────────────────────────────────────────────────────────────────────
  quizTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  quizVs:      { fontSize: 12, fontWeight: '600', flex: 1 },
  quizTimer:   { fontSize: 22, fontWeight: '800', color: Colors.indigo, fontVariant: ['tabular-nums'] },
  quizCounter: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },

  quizContent: { padding: 16, paddingBottom: 48, gap: 12 },

  questionCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderLeftWidth: 3,
    borderLeftColor: Colors.indigo,
  },
  questionText: { fontSize: 17, fontWeight: '600', lineHeight: 26 },

  optionList: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 13,
    gap: 12,
  },
  optionSelected:       { borderColor: Colors.indigo, borderWidth: 2, backgroundColor: '#F0FDFA' },
  optBadge:             { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optBadgeSelected:     { backgroundColor: Colors.indigo },
  optBadgeText:         { fontSize: 13, fontWeight: '800', color: '#6B7280' },
  optBadgeTextSelected: { color: '#FFFFFF' },
  optionText:           { flex: 1, fontSize: 15, color: '#374151', lineHeight: 21 },
  optionTextSelected:   { color: '#111827', fontWeight: '600' },

  quizNavRow:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  quizNavBtn:            { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  quizNavBtnDisabled:    { borderColor: '#F3F4F6', backgroundColor: '#F3F4F6' },
  quizNavBtnText:        { fontSize: 14, fontWeight: '700', color: Colors.indigo },
  quizNavBtnDisabledText: { color: '#9CA3AF' },
  quizSubmitBtn:         { backgroundColor: Colors.indigo, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  quizSubmitBtnText:     { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  calculatingText: { fontSize: 16, fontWeight: '600' },

  // ── Results ───────────────────────────────────────────────────────────────────
  backRow:      { paddingBottom: 4 },
  backBtn:      { fontSize: 14, fontWeight: '600', color: Colors.indigo },
  lobbyBackBtn: { paddingVertical: 8, paddingHorizontal: 4, alignSelf: 'flex-start' },

  waitingCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  waitingEmoji: { fontSize: 36 },
  waitingTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  waitingSub:   { fontSize: 13, textAlign: 'center' },

  myScoreSummary: { alignItems: 'center', gap: 4, marginTop: 8 },
  myScoreLabel:   { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 1 },
  myScoreBig:     { fontSize: 48, fontWeight: '800', lineHeight: 54 },
  myScoreTime:    { fontSize: 13 },

  remindBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1.5,
    borderColor: Colors.indigo,
    marginTop: 4,
  },
  remindBtnText: { color: Colors.indigo, fontSize: 14, fontWeight: '700' },

  winnerBanner: {
    borderRadius: 20,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  winnerEmoji: { fontSize: 36 },
  winnerText:  { fontSize: 26, fontWeight: '900', color: '#FFFFFF', flex: 1 },

  scoreCompare: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  playerBlock: { flex: 1, alignItems: 'center', gap: 6 },
  compareAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareAvatarText:  { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  comparePlayerName:  { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  compareScore:       { fontSize: 32, fontWeight: '800', lineHeight: 38 },
  compareTime:        { fontSize: 12 },
  vsBig:              { fontSize: 18, fontWeight: '800', marginHorizontal: 8 },

  xpEarnedCard: {
    backgroundColor: Colors.indigoBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.indigo,
    alignItems: 'center',
  },
  xpEarnedText: { fontSize: 15, fontWeight: '700', color: Colors.indigo },

  breakdownCard: {
    borderRadius: 16,
    padding: 16,
    gap: 2,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  breakdownTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  breakdownLegend: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  legendItem:      { flexDirection: 'row', alignItems: 'center' },
  legendLabel:     { fontSize: 11 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  breakdownRowBorder: { borderBottomWidth: 0.5, borderBottomColor: '#F3F4F6' },
  breakdownQNum:  { fontSize: 11, fontWeight: '700', width: 24 },
  breakdownQText: { flex: 1, fontSize: 12 },
  tickGreen:  { fontSize: 13, fontWeight: '900', color: Colors.emerald, width: 28, textAlign: 'center' },
  tickRed:    { fontSize: 13, fontWeight: '900', color: '#EF4444', width: 28, textAlign: 'center' },
  tickIndigo: { fontSize: 13, fontWeight: '900', color: Colors.indigo, width: 28, textAlign: 'center' },
  tickGrey:   { fontSize: 13, fontWeight: '900', color: '#D1D5DB', width: 28, textAlign: 'center' },

  challengeAgainBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  challengeAgainBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  shareResultBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.indigo,
  },
  shareResultBtnText: { color: Colors.indigo, fontSize: 16, fontWeight: '700' },

  homeBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  homeBtnText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub:   { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // ── Modals ────────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
    gap: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalSub:   { fontSize: 13, lineHeight: 18 },

  topicScroll: { maxHeight: 320 },
  topicOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    gap: 10,
  },
  topicOptionSelected: { backgroundColor: '#F0FDFA' },
  topicEmoji:          { fontSize: 18, width: 26, textAlign: 'center' },
  topicLabel:          { flex: 1, fontSize: 14, fontWeight: '600' },
  topicLabelSel:       { color: Colors.indigo },
  topicCheck:          { fontSize: 14, fontWeight: '800', color: Colors.indigo },

  modalNextBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  modalNextBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  inviteMethodRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  inviteMethodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  inviteMethodTabActive: { backgroundColor: '#FFFFFF' },
  inviteMethodText:       { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  inviteMethodTextActive: { color: '#111827' },

  usernameInput: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    fontSize: 15,
    fontWeight: '600',
    padding: 14,
  },

  linkNoteBox: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.indigo,
  },
  linkNote: { fontSize: 13, lineHeight: 20 },

  step2Btns: { flexDirection: 'row', gap: 10 },
  backTabBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  backTabBtnText: { fontSize: 14, fontWeight: '600' },
  createBtn: {
    flex: 1,
    backgroundColor: Colors.indigo,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  codeInput: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    fontSize: 24,
    fontWeight: '800',
    padding: 14,
    textAlign: 'center',
    letterSpacing: 4,
  },
  joinBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  cancelBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
});
