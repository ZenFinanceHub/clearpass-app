import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { getXpLevel } from '@clearpass/core';
import { supabase } from '@/src/supabase';
import { loadUserProgress, syncProgressToCloud } from '@/src/storage';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';
import { Pip } from '@/src/components/Pip';

type LeaderboardEntry = {
  username: string;
  readiness_score: number | null;
  xp: number | null;
  streak: number | null;
  updated_at: string;
};

const RANK_COLORS = ['#F59E0B', '#9CA3AF', '#B45309'];

export default function LeaderboardScreen() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setLoggedIn(!!user);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        setCurrentUsername(profile?.username ?? null);

        const progress = await loadUserProgress();
        if (progress) {
          await syncProgressToCloud(progress);
        }
      }

      const { data } = await supabase
        .from('leaderboard')
        .select('*')
        .order('xp', { ascending: false })
        .limit(50);
      setEntries((data ?? []) as LeaderboardEntry[]);
    } catch {
      // ignore network errors
    } finally {
      setLoading(false);
    }
  }

  if (loggedIn === null || loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={Colors.indigo} />
      </View>
    );
  }

  if (!loggedIn) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.noAuthTitle, { fontSize: theme.fontSize(20), fontFamily: theme.fontFamily, color: theme.textColor }]}>Sign in to compete</Text>
        <Text style={[styles.noAuthSub, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, letterSpacing: theme.letterSpacing, lineHeight: theme.lineHeight(22), color: theme.subTextColor }]}>
          Sign in to appear on the leaderboard and compare your progress
        </Text>
        <TouchableOpacity
          style={styles.signInBtn}
          onPress={() => router.push('/auth')}
          activeOpacity={0.85}
        >
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const topTen = entries.slice(0, 10);
  const userIdx = currentUsername
    ? entries.findIndex((e) => e.username === currentUsername)
    : -1;
  const userRank = userIdx >= 0 ? userIdx + 1 : null;
  const userInTopTen = userIdx >= 0 && userIdx < 10;

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: theme.backgroundColor }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { fontFamily: theme.fontFamily }]}>LEADERBOARD</Text>
      <Text style={[styles.subtitle, { fontSize: theme.fontSize(14), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>Top learners this week</Text>

      <View style={styles.list}>
        {topTen.map((entry, idx) => {
          const isCurrentUser = entry.username === currentUsername;
          const rankColor = idx < 3 ? RANK_COLORS[idx] : '#6B7280';
          const xp = entry.xp ?? 0;
          const level = getXpLevel(xp);
          const streak = entry.streak ?? 0;

          return (
            <View
              key={entry.username + idx}
              style={[styles.row, isCurrentUser && styles.rowCurrentUser]}
            >
              <Text style={[styles.rankNum, { color: rankColor }]}>
                {'#'}{idx + 1}
              </Text>
              <View style={styles.rowMid}>
                <Text style={[styles.rowUsername, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]} numberOfLines={1}>
                  {entry.username}
                </Text>
                <Text style={[styles.rowLevel, { fontSize: theme.fontSize(11), fontFamily: theme.fontFamily, color: theme.subTextColor }]}>{'Level '}{level.level}{' - '}{level.label}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowXp}>{xp}{' XP'}</Text>
                {streak > 0 && (
                  <View style={styles.streakBadge}>
                    <Text style={styles.streakText}>{streak}{'d'}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {topTen.length === 0 && (
          <View style={styles.emptyList}>
            <Pip size={72} mood="celebrate" />
            <Text style={styles.emptyListTitle}>{'No one here yet'}</Text>
            <Text style={styles.emptyListSub}>{'Be the first on the board — answer questions to earn XP and claim the top spot.'}</Text>
            <TouchableOpacity style={styles.emptyListBtn} onPress={() => router.push('/(tabs)/practice')} activeOpacity={0.85}>
              <Text style={styles.emptyListBtnText}>{'Start practising →'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {userRank !== null && !userInTopTen && (
        <View style={styles.yourRankCard}>
          <Text style={styles.yourRankText}>{'Your rank: #'}{userRank}</Text>
        </View>
      )}

      {userRank === null && currentUsername !== null && (
        <View style={styles.yourRankCard}>
          <Text style={styles.yourRankText}>
            Complete a practice session to appear on the leaderboard
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },

  title: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.indigo,
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },

  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  rowCurrentUser: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.indigo,
  },
  rankNum: {
    fontSize: 15,
    fontWeight: '800',
    width: 40,
    textAlign: 'center',
  },
  rowMid: { flex: 1 },
  rowUsername: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  rowLevel: { fontSize: 11, color: '#6B7280' },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowXp: { fontSize: 15, fontWeight: '800', color: Colors.indigo },
  streakBadge: {
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: '#F59E0B',
  },
  streakText: { fontSize: 11, fontWeight: '700', color: '#D97706' },

  emptyList: { paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  emptyListTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  emptyListSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  emptyListBtn: {
    marginTop: 8,
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  emptyListBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  yourRankCard: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderLeftWidth: 3,
    borderLeftColor: Colors.indigo,
  },
  yourRankText: { fontSize: 14, fontWeight: '700', color: Colors.indigo },

  noAuthTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  noAuthSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  signInBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  signInBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
