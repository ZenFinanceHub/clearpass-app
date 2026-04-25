import { ScrollView, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const STATS = [
  { label: 'Questions Answered', value: '342', sub: 'all time' },
  { label: 'Accuracy', value: '78%', sub: 'last 7 days' },
  { label: 'Study Streak', value: '5', sub: 'days' },
  { label: 'Mock Tests', value: '3', sub: 'completed' },
];

const RECENT_SESSIONS = [
  { date: 'Today', topic: 'Hazard Awareness', score: '18 / 20', pct: 90 },
  { date: 'Yesterday', topic: 'Vehicle Handling', score: '14 / 20', pct: 70 },
  { date: 'Mon', topic: 'Full Mock Test', score: '41 / 50', pct: 82 },
];

export default function ProgressScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 pt-5">
        <View className="flex-row flex-wrap gap-3 mb-6">
          {STATS.map(({ label, value, sub }) => (
            <ThemedView
              key={label}
              className="flex-1 min-w-[44%] bg-white rounded-2xl p-4 border border-gray-100"
            >
              <ThemedText className="text-3xl font-bold text-blue-600">{value}</ThemedText>
              <ThemedText className="text-gray-800 font-medium text-sm mt-0.5">{label}</ThemedText>
              <ThemedText className="text-gray-400 text-xs">{sub}</ThemedText>
            </ThemedView>
          ))}
        </View>

        <ThemedText className="text-gray-700 font-semibold text-base mb-3">
          Recent Sessions
        </ThemedText>

        <View className="gap-y-2 mb-8">
          {RECENT_SESSIONS.map(({ date, topic, score, pct }) => (
            <ThemedView key={topic} className="bg-white rounded-xl px-4 py-3.5 border border-gray-100">
              <View className="flex-row justify-between items-start mb-2">
                <View>
                  <ThemedText className="text-gray-800 font-semibold">{topic}</ThemedText>
                  <ThemedText className="text-gray-400 text-xs">{date}</ThemedText>
                </View>
                <ThemedText className="text-gray-700 font-bold">{score}</ThemedText>
              </View>
              <View className="bg-gray-100 rounded-full h-1.5">
                <View
                  className="bg-blue-500 rounded-full h-1.5"
                  style={{ width: `${pct}%` }}
                />
              </View>
            </ThemedView>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
