import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/src/constants/theme';
import { Pip } from '@/src/components/Pip';
import { supabase } from '@/src/supabase';

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
];

export default function TabLayout() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    void guardInstructorAccounts();
  }, []);

  async function guardInstructorAccounts() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', user.id)
          .maybeSingle();
        if ((profile as { account_type?: string } | null)?.account_type === 'instructor') {
          router.replace('/instructor');
          return;
        }
      }
    } catch {
      // Network/Supabase error: fail open, same as "not an instructor".
    }
    setChecked(true);
  }

  if (!checked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardWhite }}>
        <ActivityIndicator size="large" color={Colors.indigo} />
      </View>
    );
  }

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
