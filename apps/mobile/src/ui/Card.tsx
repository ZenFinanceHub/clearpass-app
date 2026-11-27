import React from 'react';
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useDesignTheme } from '@/src/design';
import type { ColorTokens } from '@/src/design/tokens';

export interface CardProps {
  children: React.ReactNode;
  surface?: keyof ColorTokens['bg'];
  elevation?: 'flat' | 'card' | 'raised';
  padding?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Rounded surface (radius 16). Borders on web, a light shadow on native. Pressable when given onPress. */
export function Card({
  children, surface = 'card', elevation = 'card', padding = 16, onPress,
  accessibilityLabel, accessibilityHint, style, testID,
}: CardProps) {
  const { colors, radii, scheme } = useDesignTheme();
  const shadow: ViewStyle =
    elevation === 'flat' || Platform.OS === 'web' || scheme === 'dark'
      ? {}
      : {
          shadowColor: '#111827',
          shadowOpacity: elevation === 'raised' ? 0.1 : 0.05,
          shadowRadius: elevation === 'raised' ? 12 : 6,
          shadowOffset: { width: 0, height: elevation === 'raised' ? 4 : 2 },
          elevation: elevation === 'raised' ? 4 : 1,
        };
  const base: ViewStyle = {
    backgroundColor: colors.bg[surface],
    borderRadius: radii.card,
    padding,
    borderWidth: elevation === 'flat' && surface !== 'card' ? 0 : 1,
    borderColor: colors.border.default,
    ...shadow,
  };

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={[base, style]}>{children}</View>;
}
