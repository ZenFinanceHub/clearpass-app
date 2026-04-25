import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const CATEGORIES = [
  { id: '1', label: 'Alertness', count: 45, emoji: '👀' },
  { id: '2', label: 'Attitude', count: 30, emoji: '🤝' },
  { id: '3', label: 'Safety & Your Vehicle', count: 40, emoji: '🚗' },
  { id: '4', label: 'Safety Margins', count: 35, emoji: '📏' },
  { id: '5', label: 'Hazard Awareness', count: 50, emoji: '⚠️' },
  { id: '6', label: 'Vulnerable Road Users', count: 25, emoji: '🚶' },
];

export default function PracticeScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Practice Questions</Text>
      <Text style={styles.screenSub}>Choose a topic or start a mixed session</Text>

      <TouchableOpacity style={styles.randomButton} activeOpacity={0.85}>
        <Text style={styles.randomButtonText}>🔀  Start Random Practice</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Browse by Topic</Text>

      <View style={styles.cardList}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity key={cat.id} style={styles.card} activeOpacity={0.75}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardEmoji}>{cat.emoji}</Text>
              <Text style={styles.cardLabel}>{cat.label}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.cardCount}>{cat.count}</Text>
              <Text style={styles.cardCountLabel}>Qs</Text>
            </View>
          </TouchableOpacity>
        ))}
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
  randomButton: {
    backgroundColor: '#012169',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  randomButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  cardList: {
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardEmoji: {
    fontSize: 22,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  cardRight: {
    alignItems: 'center',
  },
  cardCount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#012169',
  },
  cardCountLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
