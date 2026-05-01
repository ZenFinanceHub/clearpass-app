import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const FACTS = [
  { label: 'Video Clips', value: '14', emoji: '🎬' },
  { label: 'Approx. Time', value: '20 min', emoji: '⏱' },
  { label: 'Pass Mark', value: '44 / 75', emoji: '🎯' },
  { label: 'Points per Clip', value: '0 - 5', emoji: '⭐' },
];

const HOW_STEPS = [
  { num: '1', emoji: '👁', text: 'Watch the driving clip from a first-person perspective' },
  { num: '2', emoji: '🖱', text: 'Tap the screen as soon as you spot a developing hazard' },
  { num: '3', emoji: '✅', text: 'The sooner you tap after the hazard appears, the higher your score' },
];

export default function HazardScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Hazard Perception</Text>
      <Text style={styles.screenSub}>Spot developing hazards in real driving footage</Text>

      <View style={styles.factsRow}>
        {FACTS.map(({ label, value, emoji }) => (
          <View key={label} style={styles.factCard}>
            <Text style={styles.factEmoji}>{emoji}</Text>
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

      <View style={styles.stepList}>
        {HOW_STEPS.map((step) => (
          <View key={step.num} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{step.num}</Text>
            </View>
            <Text style={styles.stepEmoji}>{step.emoji}</Text>
            <Text style={styles.stepText}>{step.text}</Text>
          </View>
        ))}
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
  factEmoji: {
    fontSize: 22,
    marginBottom: 4,
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
    marginBottom: 16,
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
  stepList: {
    gap: 10,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepEmoji: {
    fontSize: 20,
    flexShrink: 0,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
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
