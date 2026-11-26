import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTheme } from '@/src/design';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

export type TabKey = 'home' | 'learn' | 'tests' | 'progress' | 'profile';

export const V2_TABS: ReadonlyArray<{ key: TabKey; label: string; icon: IconName; iconActive: IconName }> = [
  { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { key: 'learn', label: 'Learn', icon: 'book-outline', iconActive: 'book' },
  { key: 'tests', label: 'Tests', icon: 'play-circle-outline', iconActive: 'play-circle' },
  { key: 'progress', label: 'Progress', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { key: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

/**
 * The five-tab bar (Home · Learn · Tests · Progress · Profile), VISUAL ONLY
 * for now: the real navigator swap is P2-2. Each item is ≥ 44pt tall and
 * an equal fifth of the width; labels are short single words at 12px so
 * they never clip at 320–390px (the current bar clips on web, F6).
 */
export function TabBarV2({ active, onPress }: { active: TabKey; onPress?: (key: TabKey) => void }) {
  const { colors, radii } = useDesignTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bg.card,
        borderTopWidth: 1,
        borderTopColor: colors.border.default,
        paddingTop: 6,
        paddingBottom: Math.max(insets.bottom, 6),
      }}
    >
      {V2_TABS.map((t) => {
        const focused = t.key === active;
        const color = focused ? colors.text.brand : colors.text.secondary;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: focused }}
            onPress={() => onPress?.(t.key)}
            style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2 }}
          >
            <View
              style={{
                paddingHorizontal: 14, paddingVertical: 2, borderRadius: radii.tabIndicator,
                backgroundColor: focused ? colors.bg.brandSubtle : 'transparent',
              }}
            >
              <Icon name={focused ? t.iconActive : t.icon} size={22} color={color} />
            </View>
            <Text
              variant="caption"
              weight={focused ? 700 : 500}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={{ color }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
