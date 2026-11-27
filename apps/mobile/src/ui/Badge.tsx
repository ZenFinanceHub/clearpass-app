import React from 'react';
import { View } from 'react-native';
import { useDesignTheme } from '@/src/design';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';

export type BadgeTone = 'brand' | 'gold' | 'success' | 'error' | 'info' | 'neutral' | 'solid';

/**
 * Pill label. Gold badges are a gold FILL with dark text (never gold text,
 * never white on gold). Text always carries the meaning; colour never alone.
 */
export function Badge({ label, tone = 'brand', icon, accessibilityLabel }: {
  label: string; tone?: BadgeTone; icon?: IconName; accessibilityLabel?: string;
}) {
  const { colors, radii } = useDesignTheme();
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    brand: { bg: colors.bg.brandSubtle, fg: colors.text.brand },
    gold: { bg: colors.accent.gold, fg: colors.text.onGold },
    success: { bg: colors.status.successBg, fg: colors.status.success },
    error: { bg: colors.status.errorBg, fg: colors.status.error },
    info: { bg: colors.status.infoBg, fg: colors.status.info },
    neutral: { bg: colors.bg.subtle, fg: colors.text.secondaryOnTint },
    solid: { bg: colors.brand.primary, fg: colors.text.onPrimary },
  };
  const { bg, fg } = map[tone];
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
        backgroundColor: bg, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4,
      }}
    >
      {icon && <Icon name={icon} size={14} color={fg} />}
      <Text variant="caption" weight={600} style={{ color: fg }} numberOfLines={1}>{label}</Text>
    </View>
  );
}
