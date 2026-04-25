import { ScrollView, Text, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const READINESS_SCORE = 72;

export default function HomeScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <ThemedView className="bg-blue-600 px-6 pt-6 pb-10">
        <ThemedText className="text-white text-lg font-medium">Good morning!</ThemedText>
        <ThemedText className="text-white text-3xl font-bold mt-1">Ready to study?</ThemedText>
      </ThemedView>

      <View className="-mt-6 mx-4">
        <ThemedView className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <ThemedText className="text-gray-500 text-sm font-medium mb-1">
            Readiness Score
          </ThemedText>
          <View className="flex-row items-end gap-x-2">
            <ThemedText className="text-5xl font-bold text-blue-600">
              {READINESS_SCORE}
            </ThemedText>
            <ThemedText className="text-2xl text-gray-400 mb-1">/ 100</ThemedText>
          </View>
          <View className="mt-3 bg-gray-100 rounded-full h-2">
            <View
              className="bg-blue-600 rounded-full h-2"
              style={{ width: `${READINESS_SCORE}%` }}
            />
          </View>
        </ThemedView>
      </View>

      <View className="px-4 mt-6 mb-8">
        <ThemedText className="text-gray-700 text-base font-semibold mb-3">
          Quick Actions
        </ThemedText>
        <View className="flex-row gap-x-3">
          <ThemedView className="flex-1 bg-white rounded-xl p-4 border border-gray-100">
            <ThemedText className="text-blue-600 text-2xl mb-1">📖</ThemedText>
            <ThemedText className="text-gray-800 font-semibold">Practice</ThemedText>
            <ThemedText className="text-gray-500 text-xs mt-0.5">Random questions</ThemedText>
          </ThemedView>
          <ThemedView className="flex-1 bg-white rounded-xl p-4 border border-gray-100">
            <ThemedText className="text-blue-600 text-2xl mb-1">📋</ThemedText>
            <ThemedText className="text-gray-800 font-semibold">Mock Test</ThemedText>
            <ThemedText className="text-gray-500 text-xs mt-0.5">50 questions</ThemedText>
          </ThemedView>
        </View>
      </View>
    </ScrollView>
  );
}
