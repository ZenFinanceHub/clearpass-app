import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useDesignTheme } from '@/src/design';
import { minTouchTarget } from '@/src/design/tokens';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

/** inverse: white button on the deep-indigo Go Pro card. */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'inverse';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  /** Label lines before truncating (long topic names, large text). */
  numberOfLines?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** 44pt minimum target; role, label and disabled/busy state for screen readers. */
export function Button({
  label, onPress, variant = 'primary', size = 'md', icon, iconPosition = 'right',
  disabled, loading, fullWidth, numberOfLines = 1, accessibilityLabel, accessibilityHint, style, testID,
}: ButtonProps) {
  const { colors, radii } = useDesignTheme();
  const fg =
    variant === 'primary' ? colors.text.onPrimary
    : variant === 'secondary' ? colors.text.onSecondary
    : variant === 'inverse' ? colors.promo.ctaText
    : colors.text.brand;
  const bg =
    variant === 'primary' ? colors.brand.primary
    : variant === 'secondary' ? colors.brand.secondary
    : variant === 'inverse' ? colors.promo.ctaBg
    : 'transparent';
  const iconEl = icon ? <Icon name={icon} size={18} color={fg} /> : null;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: size === 'lg' ? 52 : minTouchTarget,
          paddingHorizontal: size === 'lg' ? 24 : 18,
          paddingVertical: 8,
          borderRadius: radii.control,
          backgroundColor: bg,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: colors.brand.primary,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        fullWidth && styles.full,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {iconPosition === 'left' && iconEl}
          <Text variant="label" weight={600} align="center" style={{ color: fg, flexShrink: 1 }} numberOfLines={numberOfLines}>{label}</Text>
          {iconPosition === 'right' && iconEl}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%' },
});
