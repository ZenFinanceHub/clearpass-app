import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/src/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type TabConfig = {
  name: string;
  title: string;
  headerTitle?: string;
  icon: IoniconName;
  iconFocused: IoniconName;
  hidden?: boolean;
};

const TABS: TabConfig[] = [
  { name: 'home',        title: 'Home',     headerTitle: 'ClearPass', icon: 'home-outline',              iconFocused: 'home' },
  { name: 'practice',   title: 'Practice',                            icon: 'book-outline',              iconFocused: 'book' },
  { name: 'mock',        title: 'Mock Test',                           icon: 'clipboard-outline',         iconFocused: 'clipboard' },
  { name: 'learn',       title: 'Study',                               icon: 'library-outline',           iconFocused: 'library' },
  { name: 'settings',   title: 'Settings',                            icon: 'settings-outline',          iconFocused: 'settings' },
  // Hidden from tab bar — still navigable via router.push()
  { name: 'tutor',        title: 'AI Tutor',    icon: 'chatbubble-ellipses-outline', iconFocused: 'chatbubble-ellipses', hidden: true },
  { name: 'highwaycode',  title: 'HC Rules',    icon: 'document-text-outline', iconFocused: 'document-text',  hidden: true },
  { name: 'roadsigns',    title: 'Signs',       icon: 'stop-circle-outline',   iconFocused: 'stop-circle',    hidden: true },
  { name: 'hazard',       title: 'Hazard',      icon: 'warning-outline',       iconFocused: 'warning',        hidden: true },
  { name: 'progress',     title: 'Progress',    icon: 'stats-chart-outline',   iconFocused: 'stats-chart',    hidden: true },
  { name: 'leaderboard',  title: 'Leaderboard', icon: 'trophy-outline',        iconFocused: 'trophy',         hidden: true },
];

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.indigo,
        tabBarInactiveTintColor: Colors.mutedText,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarStyle: {
          height: 60,
          paddingTop: 6,
          paddingBottom: 8,
          borderTopWidth: 0.5,
          borderTopColor: Colors.border,
          backgroundColor: Colors.cardWhite,
        },
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerStyle: {
          backgroundColor: Colors.cardWhite,
        },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      {TABS.map(({ name, title, headerTitle, icon, iconFocused, hidden }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            ...(headerTitle ? { headerTitle } : {}),
            ...(hidden ? { tabBarButton: () => null } : {}),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? iconFocused : icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
