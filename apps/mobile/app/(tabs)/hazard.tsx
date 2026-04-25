import { Pressable, ScrollView, Text, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const HAZARD_INFO = [
  {
    id: '1',
    title: 'What is Hazard Perception?',
    body:
      'You watch 14 video clips and must tap when you spot a developing hazard. Each clip scores 0–5 based on reaction speed.',
  },
  {
    id: '2',
    title: 'Pass mark',
    body: 'You need at least 44 out of 75 to pass the hazard perception part of the theory test.',
  },
];

export default function HazardScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 pt-5">
        <ThemedView className="bg-white rounded-2xl p-5 border border-gray-100 mb-5">
          <View className="flex-row items-center gap-x-3 mb-4">
            <View className="bg-yellow-100 rounded-xl p-3">
              <ThemedText className="text-2xl">⚠️</ThemedText>
            </View>
            <View className="flex-1">
              <ThemedText className="text-gray-800 font-bold text-lg">Hazard Perception</ThemedText>
              <ThemedText className="text-gray-500 text-sm">14 video clips · 75 points total</ThemedText>
            </View>
          </View>

          {HAZARD_INFO.map(({ id, title, body }) => (
            <View key={id} className="mb-3">
              <ThemedText className="text-gray-800 font-semibold text-sm mb-0.5">{title}</ThemedText>
              <ThemedText className="text-gray-500 text-sm leading-5">{body}</ThemedText>
            </View>
          ))}
        </ThemedView>

        <Pressable className="bg-yellow-500 rounded-xl py-4 items-center mb-3 active:opacity-80">
          <Text className="text-white text-base font-semibold">Watch Practice Clips</Text>
        </Pressable>

        <Pressable className="bg-white border border-gray-200 rounded-xl py-4 items-center active:opacity-80">
          <Text className="text-gray-700 text-base font-medium">Tips &amp; Techniques</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
