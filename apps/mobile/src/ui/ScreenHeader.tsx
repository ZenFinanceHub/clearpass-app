import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useDesignTheme } from '@/src/design';
import { minTouchTarget } from '@/src/design/tokens';
import { Text } from './Text';
import { Icon } from './Icon';

/**
 * App header: the existing app icon plus the text wordmark "ClearPass"
 * (existing branding only, no new logo). No notification bell (spec §5, D3).
 * The profile button is shown only on wide layouts; on mobile the Profile
 * tab covers it.
 */
export function ScreenHeader({ showProfileButton = false, onProfilePress }: {
  showProfileButton?: boolean; onProfilePress?: () => void;
}) {
  const { colors, space } = useDesignTheme();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: minTouchTarget, paddingVertical: space.xxs }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityRole="header" accessibilityLabel="ClearPass">
        <Image
          source={require('../../assets/favicon.png')}
          style={{ width: 32, height: 32, borderRadius: 8 }}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
        <Text variant="title" weight={700} style={{ color: colors.text.brand }}>{'ClearPass'}</Text>
      </View>
      {showProfileButton && onProfilePress && (
        <Pressable
          onPress={onProfilePress}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          hitSlop={4}
          style={{
            width: minTouchTarget, height: minTouchTarget, borderRadius: minTouchTarget / 2,
            alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.brandSubtle,
          }}
        >
          <Icon name="person-outline" size={22} color={colors.text.brand} />
        </Pressable>
      )}
    </View>
  );
}
