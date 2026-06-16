import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useNetwork } from '@/src/NetworkContext';
import { OfflineBanner } from '@/src/components/OfflineBanner';

type StudyCard = {
  route: string;
  emoji: string;
  title: string;
  subtitle: string;
};

const CARDS: StudyCard[] = [
  { route: '/study-plan',                      emoji: '📋', title: 'Study Plan',          subtitle: 'Your daily task' },
  { route: '/highwaycode',                     emoji: '📖', title: 'Highway Code',        subtitle: 'Rules and regulations' },
  { route: '/roadsigns',                       emoji: '🚦', title: 'Road Signs',          subtitle: 'Learn all UK signs' },
  { route: '/hazard',                          emoji: '⚠️',  title: 'Hazard Perception',  subtitle: 'Spot developing hazards' },
  { route: '/progress',                        emoji: '📊', title: 'Progress',            subtitle: 'Track your learning' },
  { route: '/leaderboard',                     emoji: '🏆', title: 'Leaderboard',         subtitle: 'See how you rank' },
  { route: '/aitutor',                         emoji: '🤖', title: 'AI Tutor',            subtitle: 'Get instant help' },
  { route: '/(tabs)/practice?mode=bookmarked', emoji: '🔖', title: 'Bookmarked',          subtitle: 'Your saved questions' },
];

const ONLINE_ONLY = new Set(['/aitutor']);

export default function StudyScreen() {
  const router = useRouter();
  const { isOffline } = useNetwork();

  const rows: StudyCard[][] = [];
  for (let i = 0; i < CARDS.length; i += 2) {
    rows.push(CARDS.slice(i, i + 2));
  }

  return (
    <>
      <OfflineBanner />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.heading}>Study</Text>
          <Text style={styles.subheading}>Everything you need to pass</Text>
        </View>
        <View style={styles.grid}>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((card) => {
                const disabled = isOffline && ONLINE_ONLY.has(card.route);
                return (
                  <TouchableOpacity
                    key={card.route}
                    style={[styles.card, disabled && styles.cardDisabled]}
                    onPress={() => { if (!disabled) router.push(card.route as any); }}
                    activeOpacity={disabled ? 1 : 0.8}
                  >
                    <Text style={[styles.emoji, disabled && styles.textDisabled]}>{card.emoji}</Text>
                    <Text style={[styles.title, disabled && styles.textDisabled]}>{card.title}</Text>
                    <Text style={[styles.subtitle, disabled && styles.textDisabled]}>
                      {disabled ? 'Requires internet' : card.subtitle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  grid: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  emoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  cardDisabled: { opacity: 0.45 },
  textDisabled: { color: '#9CA3AF' },
});
