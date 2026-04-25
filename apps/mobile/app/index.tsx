import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

export default function Onboarding() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <View className="items-center mb-12">
        <Text className="text-5xl font-bold text-blue-600 mb-3">ClearPass</Text>
        <Text className="text-lg text-gray-500 text-center leading-relaxed">
          Your UK driving theory{'\n'}test companion
        </Text>
      </View>

      <View className="w-full gap-y-3">
        <Pressable
          className="bg-blue-600 rounded-xl px-8 py-4 w-full items-center active:opacity-80"
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Text className="text-white text-lg font-semibold">Get Started</Text>
        </Pressable>

        <Pressable
          className="border border-blue-600 rounded-xl px-8 py-4 w-full items-center active:opacity-80"
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Text className="text-blue-600 text-lg font-semibold">Sign In</Text>
        </Pressable>
      </View>
    </View>
  );
}
