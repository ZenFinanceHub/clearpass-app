import { Pressable, ScrollView, Text, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const CATEGORIES = [
  { id: '1', label: 'Alertness', count: 45, color: 'bg-blue-100', textColor: 'text-blue-700' },
  { id: '2', label: 'Attitude', count: 30, color: 'bg-green-100', textColor: 'text-green-700' },
  { id: '3', label: 'Safety & Your Vehicle', count: 40, color: 'bg-yellow-100', textColor: 'text-yellow-700' },
  { id: '4', label: 'Safety Margins', count: 35, color: 'bg-purple-100', textColor: 'text-purple-700' },
  { id: '5', label: 'Hazard Awareness', count: 50, color: 'bg-red-100', textColor: 'text-red-700' },
  { id: '6', label: 'Vulnerable Road Users', count: 25, color: 'bg-orange-100', textColor: 'text-orange-700' },
  { id: '7', label: 'Other Types of Vehicle', count: 20, color: 'bg-teal-100', textColor: 'text-teal-700' },
  { id: '8', label: 'Vehicle Handling', count: 30, color: 'bg-indigo-100', textColor: 'text-indigo-700' },
];

export default function PracticeScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 pt-5 pb-3">
        <Pressable className="bg-blue-600 rounded-xl py-4 items-center active:opacity-80">
          <Text className="text-white text-base font-semibold">Start Random Practice</Text>
        </Pressable>
      </View>

      <View className="px-4 mb-6">
        <ThemedText className="text-gray-700 font-semibold text-base mb-3">By Category</ThemedText>
        <View className="gap-y-2">
          {CATEGORIES.map((cat) => (
            <Pressable key={cat.id} className="active:opacity-75">
              <ThemedView className="bg-white rounded-xl px-4 py-3.5 flex-row items-center justify-between border border-gray-100">
                <View className="flex-row items-center gap-x-3">
                  <View className={`${cat.color} rounded-lg px-2.5 py-1`}>
                    <ThemedText className={`${cat.textColor} text-xs font-semibold`}>
                      {cat.count}
                    </ThemedText>
                  </View>
                  <ThemedText className="text-gray-800 font-medium">{cat.label}</ThemedText>
                </View>
                <ThemedText className="text-gray-400 text-lg">›</ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
