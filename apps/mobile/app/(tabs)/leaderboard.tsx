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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#A78BFA" />
      </View>
    );
  }

  if (!loggedIn) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noAuthTitle}>Sign in to compete</Text>
        <Text style={styles.noAuthSub}>
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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>LEADERBOARD</Text>
      <Text style={styles.subtitle}>Top learners this week</Text>

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
                <Text style={styles.rowUsername} numberOfLines={1}>
                  {entry.username}
                </Text>
                <Text style={styles.rowLevel}>{'Level '}{level.level}{' - '}{level.label}</Text>
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
            <Text style={styles.emptyListText}>No entries yet - be the first!</Text>
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
  scroll: { flex: 1, backgroundColor: '#0A0A0F' },
  content: { padding: 20, paddingBottom: 48 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0F',
    gap: 12,
    paddingHorizontal: 32,
  },

  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#A78BFA',
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },

  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13131A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    gap: 12,
  },
  rowCurrentUser: {
    borderLeftWidth: 3,
    borderLeftColor: '#A78BFA',
  },
  rankNum: {
    fontSize: 15,
    fontWeight: '800',
    width: 40,
    textAlign: 'center',
  },
  rowMid: { flex: 1 },
  rowUsername: { fontSize: 15, fontWeight: '700', color: '#F1F0FF', marginBottom: 2 },
  rowLevel: { fontSize: 11, color: '#6B7280' },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowXp: { fontSize: 15, fontWeight: '800', color: '#A78BFA' },
  streakBadge: {
    backgroundColor: '#1C1C27',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: '#FBBF24',
  },
  streakText: { fontSize: 11, fontWeight: '700', color: '#FBBF24' },

  emptyList: { padding: 20, alignItems: 'center' },
  emptyListText: { fontSize: 14, color: '#374151' },

  yourRankCard: {
    marginTop: 20,
    backgroundColor: '#13131A',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#1F1F2E',
    borderLeftWidth: 3,
    borderLeftColor: '#A78BFA',
  },
  yourRankText: { fontSize: 14, fontWeight: '700', color: '#A78BFA' },

  noAuthTitle: { fontSize: 20, fontWeight: '800', color: '#F1F0FF' },
  noAuthSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  signInBtn: {
    backgroundColor: '#7B5EA7',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  signInBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
