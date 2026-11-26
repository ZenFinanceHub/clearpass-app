import React from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/src/constants/theme';
import { Pip } from '@/src/components/Pip';
import { mockTestExitGuard } from '@/src/mockTestExitGuard';
import { hazardExitGuard } from '@/src/hazardExitGuard';
import { uiV2 } from '@/src/uiFlags';
import { SIDE_NAV_BREAKPOINT, SideNavV2, TabBarV2, type TabKey } from '@/src/ui';
import { ROUTE_TAB, TAB_ROUTE, V2_HEADER_TITLE, tabForRoute } from '@/src/nav/routeMap';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type TabConfig = {
  name: string;
  title: string;
  headerTitle?: string;
  headerPip?: boolean;
  icon: IoniconName;
  iconFocused: IoniconName;
  hidden?: boolean;
};

const TABS: TabConfig[] = [
  { name: 'home',        title: 'Home',     headerTitle: 'ClearPass', icon: 'home-outline',              iconFocused: 'home' },
  { name: 'practice',   title: 'Practice',                            icon: 'book-outline',              iconFocused: 'book' },
  { name: 'mock',        title: 'Mock Test',                           icon: 'clipboard-outline',         iconFocused: 'clipboard' },
  { name: 'hazard',      title: 'Hazard',                              icon: 'warning-outline',           iconFocused: 'warning' },
  { name: 'settings',   title: 'Settings',    headerTitle: 'Settings', headerPip: true, icon: 'settings-outline',          iconFocused: 'settings' },
  // Hidden from tab bar — still navigable via router.push()
  { name: 'learn',        title: 'Study',       icon: 'library-outline',               iconFocused: 'library',            hidden: true },
  { name: 'tutor',        title: 'Ask Pip',     icon: 'chatbubble-ellipses-outline',   iconFocused: 'chatbubble-ellipses', hidden: true },
  { name: 'highwaycode',  title: 'HC Rules',    icon: 'document-text-outline',         iconFocused: 'document-text',       hidden: true },
  { name: 'roadsigns',    title: 'Signs',       icon: 'stop-circle-outline',           iconFocused: 'stop-circle',         hidden: true },
  { name: 'progress',     title: 'Progress',    icon: 'stats-chart-outline',           iconFocused: 'stats-chart',         hidden: true },
  { name: 'leaderboard',  title: 'Leaderboard', icon: 'trophy-outline',                iconFocused: 'trophy',              hidden: true },
  // ClearPass 2.0 Tests hub. Hidden (and redirecting to Home) with ui_v2 off.
  { name: 'tests',        title: 'Tests',       icon: 'play-circle-outline',           iconFocused: 'play-circle',         hidden: true },
];

// Blocks switching away from the Mock Test or Hazard tab mid-session —
// see mockTestExitGuard/hazardExitGuard for why this can't live inside
// mock.tsx/hazard.tsx themselves. Shared by both navigators.
const exitGuardListeners = ({ route }: { route: { key: string; name: string } }) => ({
  tabPress: (e: { preventDefault: () => void }) => {
    if (mockTestExitGuard.active && route.key !== mockTestExitGuard.routeKey) {
      e.preventDefault();
      mockTestExitGuard.requestExit?.(() => router.replace(`/(tabs)/${route.name}` as any));
    } else if (hazardExitGuard.active && route.key !== hazardExitGuard.routeKey) {
      e.preventDefault();
      hazardExitGuard.requestExit?.(() => router.replace(`/(tabs)/${route.name}` as any));
    }
  },
});

// Instructor-account gating for this route group lives in ONE place:
// InstructorRouteGuardOverlay in apps/mobile/app/_layout.tsx. It covers
// every screen under (tabs) plus the legacy top-level sibling routes
// (hazard.tsx, roadsigns.tsx, etc.) from a single check, so it isn't
// duplicated here.
export default function TabLayout() {
  return uiV2 ? <TabLayoutV2 /> : <TabLayoutV1 />;
}

function TabLayoutV1() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.indigo,
        tabBarInactiveTintColor: Colors.mutedText,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        // No explicit height/paddingBottom here — @react-navigation/bottom-tabs
        // only auto-adds the bottom safe-area inset (for Android gesture/3-button
        // nav) when both are left unset. Setting either overrides its own inset
        // calculation and the bar renders under the system nav bar on Android.
        tabBarStyle: {
          paddingTop: 6,
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
      screenListeners={exitGuardListeners}
    >
      {TABS.map(({ name, title, headerTitle, headerPip, icon, iconFocused, hidden }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            ...(headerTitle ? {
              headerTitle: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {headerPip && <Pip size={22} mood="happy" />}
                  <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.indigo, letterSpacing: -0.3 }}>
                    {headerTitle}
                  </Text>
                </View>
              ),
            } : {}),
            ...(hidden ? { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const, width: 0 } } : {}),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? iconFocused : icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

// ─── ClearPass 2.0 (ui_v2 only) ──────────────────────────────────────────────

/**
 * Five tabs: Home · Learn · Tests · Progress · Profile. The same (tabs)
 * route files as today (every URL keeps working); the custom bar shows only
 * the five tabs and highlights the tab a screen belongs to (practice ->
 * Learn, mock/hazard -> Tests, settings -> Profile; see src/nav/routeMap.ts).
 * Phones get TabBarV2 at the bottom; >= 1024px gets SideNavV2 as a permanent
 * left sidebar. Tab presses emit `tabPress`, so the mock/hazard exit guards
 * still fire.
 */
function TabLayoutV2() {
  const { width } = useWindowDimensions();
  const wide = width >= SIDE_NAV_BREAKPOINT;
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <V2Bar {...props} wide={wide} />}
      screenOptions={{
        tabBarPosition: wide ? 'left' : 'bottom',
        headerStyle: { backgroundColor: Colors.cardWhite },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
      screenListeners={exitGuardListeners}
    >
      {Object.keys(ROUTE_TAB).map((name) => {
        const title = V2_HEADER_TITLE[name];
        return (
          <Tabs.Screen
            key={name}
            name={name}
            options={title === null || title === undefined ? { headerShown: false, title: 'ClearPass' } : { title }}
          />
        );
      })}
    </Tabs>
  );
}

function V2Bar({ state, navigation, wide }: BottomTabBarProps & { wide: boolean }) {
  const active = tabForRoute(state.routes[state.index]?.name) as TabKey;
  const onPress = (key: TabKey) => {
    const target = state.routes.find((r) => r.name === TAB_ROUTE[key]);
    if (!target) return;
    const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(target.name);
  };
  return wide ? <SideNavV2 active={active} onPress={onPress} /> : <TabBarV2 active={active} onPress={onPress} />;
}
