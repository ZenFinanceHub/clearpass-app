import { Pressable, Text, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const MOCK_INFO = [
  { label: 'Questions', value: '50' },
  { label: 'Time Limit', value: '57 min' },
  { label: 'Pass Mark', value: '43 / 50' },
  { label: 'Topics', value: 'All' },
];

export default function MockScreen() {
  return (
    <View className="flex-1 bg-gray-50 px-4 pt-6">
      <ThemedView className="bg-white rounded-2xl p-6 border border-gray-100 mb-5">
        <ThemedText className="text-gray-800 text-xl font-bold mb-1">
          Full Mock Test
        </ThemedText>
        <ThemedText className="text-gray-500 text-sm mb-5">
          Simulates the real DVSA theory test
        </ThemedText>

        <View className="flex-row flex-wrap gap-3">
          {MOCK_INFO.map(({ label, value }) => (
            <View key={label} className="flex-1 min-w-[40%] bg-gray-50 rounded-xl p-3">
              <ThemedText className="text-gray-500 text-xs mb-0.5">{label}</ThemedText>
              <ThemedText className="text-gray-800 font-bold text-base">{value}</ThemedText>
            </View>
          ))}
        </View>
      </ThemedView>

      <Pressable className="bg-blue-600 rounded-xl py-4 items-center mb-3 active:opacity-80">
        <Text className="text-white text-base font-semibold">Start Mock Test</Text>
      </Pressable>

      <Pressable className="bg-white border border-gray-200 rounded-xl py-4 items-center active:opacity-80">
        <Text className="text-gray-700 text-base font-medium">View Past Results</Text>
      </Pressable>
    </View>
  );
}
