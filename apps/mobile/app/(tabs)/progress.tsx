import { ScrollView, StyleSheet, Text, View } from 'react-native';

const STATS = [
  { label: 'Questions Answered', value: '342', icon: '❓', color: '#EFF6FF', border: '#BFDBFE' },
  { label: 'Mock Tests Taken', value: '3', icon: '📋', color: '#F0FDF4', border: '#BBF7D0' },
  { label: 'Current Streak', value: '5 days', icon: '🔥', color: '#FFF7ED', border: '#FED7AA' },
  { label: 'Best Score', value: '46 / 50', icon: '⭐', color: '#FEF9C3', border: '#FDE047' },
];

const RECENT = [
  { date: 'Today', topic: 'Hazard Awareness', score: 18, total: 20 },
  { date: 'Yesterday', topic: 'Vehicle Handling', score: 14, total: 20 },
  { date: 'Mon 21 Apr', topic: 'Full Mock Test', score: 41, total: 50 },
];

export default function ProgressScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Your Progress</Text>
      <Text style={styles.screenSub}>Keep the streak going — you're doing great!</Text>

      <View style={styles.statGrid}>
        {STATS.map(({ label, value, icon, color, border }) => (
          <View
            key={label}
            style={[styles.statCard, { backgroundColor: color, borderColor: border }]}
          >
            <Text style={styles.statIcon}>{icon}</Text>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Recent Sessions</Text>

      <View style={styles.sessionList}>
        {RECENT.map(({ date, topic, score, total }) => {
          const pct = Math.round((score / total) * 100);
          return (
            <View key={topic} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <View style={styles.sessionMeta}>
                  <Text style={styles.sessionTopic}>{topic}</Text>
                  <Text style={styles.sessionDate}>{date}</Text>
                </View>
                <Text style={styles.sessionScore}>
                  {score}/{total}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  screenSub: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  statIcon: {
    fontSize: 26,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sessionList: {
    gap: 10,
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  sessionMeta: {
    flex: 1,
  },
  sessionTopic: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  sessionDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  sessionScore: {
    fontSize: 18,
    fontWeight: '800',
    color: '#012169',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: '#22C55E',
    borderRadius: 3,
  },
});
