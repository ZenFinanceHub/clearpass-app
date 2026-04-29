import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type TabConfig = {
  name: string;
  title: string;
  icon: IoniconName;
  iconFocused: IoniconName;
};

const TABS: TabConfig[] = [
  { name: 'home', title: 'Home', icon: 'home-outline', iconFocused: 'home' },
  { name: 'practice', title: 'Practice', icon: 'book-outline', iconFocused: 'book' },
  { name: 'mock', title: 'Mock Test', icon: 'clipboard-outline', iconFocused: 'clipboard' },
  { name: 'learn', title: 'Learn', icon: 'library-outline', iconFocused: 'library' },
  { name: 'hazard', title: 'Hazard', icon: 'warning-outline', iconFocused: 'warning' },
  { name: 'progress', title: 'Progress', icon: 'stats-chart-outline', iconFocused: 'stats-chart' },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#C4C4D4',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        // Web collapses the tab bar to zero height without an explicit height value.
        // Platform.select keeps native behaviour untouched while fixing the web case.
        tabBarStyle: Platform.select({
          web: {
            height: 60,
            paddingTop: 6,
            paddingBottom: 10,
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            backgroundColor: '#FFFFFF',
          },
          default: {
            borderTopColor: '#E5E7EB',
            backgroundColor: '#FFFFFF',
          },
        }),
        headerStyle: {
          backgroundColor: '#6C63FF',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      {TABS.map(({ name, title, icon, iconFocused }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? iconFocused : icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
