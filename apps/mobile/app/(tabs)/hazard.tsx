import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const FACTS = [
  { label: 'Video Clips', value: '14' },
  { label: 'Approx. Time', value: '20 min' },
  { label: 'Pass Mark', value: '44 / 75' },
  { label: 'Points per Clip', value: '0 - 5' },
];

export default function HazardScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Hazard Perception</Text>
      <Text style={styles.screenSub}>Spot developing hazards in real driving footage</Text>

      <View style={styles.factsRow}>
        {FACTS.map(({ label, value }) => (
          <View key={label} style={styles.factCard}>
            <Text style={styles.factValue}>{value}</Text>
            <Text style={styles.factLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>
          Watch 14 video clips shot from a driver's perspective. Tap the screen as soon as you spot a developing hazard - the sooner you respond, the higher your score. You can score up to 5 points per clip (75 total).
        </Text>
      </View>

      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>Key Tip</Text>
        <Text style={styles.tipText}>
          Don't tap repeatedly - the system will penalise you for clicking patterns that suggest guessing.
        </Text>
      </View>

      <TouchableOpacity style={styles.startButton} activeOpacity={0.85}>
        <Text style={styles.startButtonText}>Start Practice Clips</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F8F7FF',
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
  factsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  factCard: {
    flex: 1,
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  factValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  factLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#F0EEFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6C63FF',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6C63FF',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
  },
  tipBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
