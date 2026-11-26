import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useDesignTheme } from '@/src/design';
import { minTouchTarget } from '@/src/design/tokens';
import { Text } from './Text';
import { Icon } from './Icon';
import { V2_TABS, type TabKey } from './TabBarV2';

export const SIDE_NAV_WIDTH = 240;
/** Wide layouts (≥ this) use the sidebar instead of the bottom tab bar. */
export const SIDE_NAV_BREAKPOINT = 1024;

/**
 * Permanent left navigation for wide web layouts: the same five
 * destinations as the bottom tab bar, the existing app icon and the text
 * wordmark. Visual for now; the navigator wiring is P2-2.
 */
export function SideNavV2({ active, onPress }: { active: TabKey; onPress?: (key: TabKey) => void }) {
  const { colors, radii } = useDesignTheme();
  return (
    <View
      role="navigation"
      style={{
        width: SIDE_NAV_WIDTH,
        backgroundColor: colors.nav.bg,
        borderRightWidth: 1,
        borderRightColor: colors.border.default,
        paddingHorizontal: 16,
        paddingTop: 24,
        gap: 4,
      }}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 24 }}
        accessible
        accessibilityRole="header"
        accessibilityLabel="ClearPass"
      >
        <Image source={require('../../assets/favicon.png')} style={{ width: 36, height: 36, borderRadius: 9 }} accessible={false} />
        <Text variant="title" weight={700} style={{ color: colors.text.brand }}>{'ClearPass'}</Text>
      </View>
      <View accessibilityRole="tablist" style={{ gap: 4 }}>
        {V2_TABS.map((t) => {
          const focused = t.key === active;
          const color = focused ? colors.nav.activeText : colors.nav.text;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: focused }}
              // react-native-web ignores accessibilityState.selected; aria-selected reaches the DOM.
              aria-selected={focused}
              onPress={() => onPress?.(t.key)}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12,
                minHeight: minTouchTarget, paddingHorizontal: 12, borderRadius: radii.tabIndicator,
                backgroundColor: focused ? colors.nav.activeBg : hovered ? colors.bg.subtle : 'transparent',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Icon name={focused ? t.iconActive : t.icon} size={22} color={color} />
              <Text variant="body" weight={focused ? 700 : 500} style={{ color }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
