import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const DETAILS = [
  { label: 'Questions', value: '50' },
  { label: 'Time Limit', value: '57 min' },
  { label: 'Pass Mark', value: '43 / 50' },
  { label: 'Format', value: 'Multiple choice' },
];

export default function MockScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Mock Test</Text>
      <Text style={styles.screenSub}>Simulates the real DVSA theory test</Text>

      <View style={styles.detailGrid}>
        {DETAILS.map(({ label, value }) => (
          <View key={label} style={styles.detailCard}>
            <Text style={styles.detailValue}>{value}</Text>
            <Text style={styles.detailLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>What to expect</Text>
        <Text style={styles.infoText}>
          You'll face 50 multiple-choice questions drawn from all DVSA topic areas. The test is timed at 57 minutes. A score of 43 or more is required to pass.
        </Text>
      </View>

      <TouchableOpacity style={styles.startButton} activeOpacity={0.85}>
        <Text style={styles.startButtonText}>Start Mock Test</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.historyButton} activeOpacity={0.85}>
        <Text style={styles.historyButtonText}>View Past Results</Text>
      </TouchableOpacity>
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
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  detailCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: '#012169',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  detailValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 12,
    color: '#A5B4CC',
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#012169',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#012169',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
  },
  startButton: {
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  historyButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },
});
