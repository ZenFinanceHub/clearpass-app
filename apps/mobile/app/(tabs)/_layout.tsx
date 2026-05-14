import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type TabConfig = {
  name: string;
  title: string;
  headerTitle?: string;
  icon: IoniconName;
  iconFocused: IoniconName;
};

const TABS: TabConfig[] = [
  { name: 'home', title: 'Home', headerTitle: 'ClearPass', icon: 'home-outline', iconFocused: 'home' },
  { name: 'practice', title: 'Practice', icon: 'book-outline', iconFocused: 'book' },
  { name: 'highwaycode', title: 'HC Rules', icon: 'document-text-outline', iconFocused: 'document-text' },
  { name: 'roadsigns', title: 'Signs', icon: 'stop-circle-outline', iconFocused: 'stop-circle' },
  { name: 'mock', title: 'Mock Test', icon: 'clipboard-outline', iconFocused: 'clipboard' },
  { name: 'learn', title: 'Learn', icon: 'library-outline', iconFocused: 'library' },
  { name: 'hazard', title: 'Hazard', icon: 'warning-outline', iconFocused: 'warning' },
  { name: 'progress', title: 'Progress', icon: 'stats-chart-outline', iconFocused: 'stats-chart' },
  { name: 'leaderboard', title: 'Leaderboard', icon: 'trophy-outline', iconFocused: 'trophy' },
  { name: 'tutor', title: 'AI Tutor', icon: 'chatbubble-ellipses-outline', iconFocused: 'chatbubble-ellipses' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline', iconFocused: 'settings' },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0D9488',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarStyle: Platform.select({
          web: {
            height: 60,
            paddingBottom: 8,
            borderTopWidth: 0.5,
            borderTopColor: '#E5E7EB',
            backgroundColor: '#FFFFFF',
          },
          default: {
            height: 60,
            paddingBottom: 8,
            borderTopWidth: 0.5,
            borderTopColor: '#E5E7EB',
            backgroundColor: '#FFFFFF',
          },
        }),
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTintColor: '#111827',
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      {TABS.map(({ name, title, headerTitle, icon, iconFocused }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            ...(headerTitle ? { headerTitle } : {}),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? iconFocused : icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
