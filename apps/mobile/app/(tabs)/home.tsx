import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const READINESS_SCORE = 72;

export default function HomeScreen() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      <View style={styles.scoreSection}>
        <Text style={styles.scoreSectionLabel}>Your Readiness Score</Text>
        <View style={styles.scoreCircle}>
          <Text style={styles.scoreNumber}>{READINESS_SCORE}</Text>
          <Text style={styles.scoreOutOf}>/ 100</Text>
        </View>
        <Text style={styles.scoreHint}>Keep practising — you're almost ready!</Text>
      </View>

      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity style={[styles.actionCard, styles.actionCardPrimary]} activeOpacity={0.85}>
          <Text style={styles.actionIcon}>📖</Text>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Start Practice</Text>
            <Text style={styles.actionSub}>Random questions from all topics</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionCard, styles.actionCardSecondary]} activeOpacity={0.85}>
          <Text style={styles.actionIcon}>📋</Text>
          <View style={styles.actionText}>
            <Text style={[styles.actionTitle, styles.actionTitleDark]}>Take Mock Test</Text>
            <Text style={styles.actionSub}>50 questions · 57 minutes</Text>
          </View>
          <Text style={[styles.actionChevron, styles.actionChevronDark]}>›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flexGrow: 1,
    backgroundColor: '#F5F5F5',
    paddingBottom: 32,
  },
  scoreSection: {
    backgroundColor: '#012169',
    paddingTop: 36,
    paddingBottom: 44,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  scoreSectionLabel: {
    color: '#A5B4CC',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  scoreCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 6,
    borderColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  scoreNumber: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 60,
  },
  scoreOutOf: {
    fontSize: 16,
    color: '#A5B4CC',
    fontWeight: '500',
  },
  scoreHint: {
    color: '#A5B4CC',
    fontSize: 14,
    textAlign: 'center',
  },
  actionsSection: {
    padding: 20,
    gap: 12,
    backgroundColor: '#F5F5F5',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 18,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  actionCardPrimary: {
    backgroundColor: '#012169',
  },
  actionCardSecondary: {
    backgroundColor: '#FFFFFF',
  },
  actionIcon: {
    fontSize: 28,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  actionTitleDark: {
    color: '#1E293B',
  },
  actionSub: {
    fontSize: 13,
    color: '#94A3B8',
  },
  actionChevron: {
    fontSize: 24,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '300',
  },
  actionChevronDark: {
    color: '#CBD5E1',
  },
});
