import React from 'react';
import { Pressable, View } from 'react-native';
import { useDesignTheme } from '@/src/design';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { listRowSemantics } from './listRowSemantics';

export interface ListRowProps {
  title: string;
  subtitle?: string | null;
  /** Right-aligned value, e.g. a score or date. */
  value?: string | null;
  /** Leading Ionicons name (decorative). */
  icon?: IconName;
  /** Extra element before the value, e.g. a Badge. */
  accessory?: React.ReactNode;
  onPress?: () => void;
  /** Disables the row and replaces the subtitle (e.g. "Requires internet"). */
  disabledNote?: string | null;
  chevron?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * P1-2 list row: one line of title (+ optional detail), an optional value
 * on the right and a chevron when it opens something. 48pt minimum height;
 * the whole row is one accessible element (see listRowSemantics).
 */
export function ListRow({ title, subtitle, value, icon, accessory, onPress, disabledNote, chevron, accessibilityLabel, testID }: ListRowProps) {
  const { colors } = useDesignTheme();
  const s = listRowSemantics({ title, subtitle, value, pressable: !!onPress, disabledNote, chevron, accessibilityLabel });
  const muted = s.state.disabled;
  const content = (
    <>
      {icon ? <Icon name={icon} size={22} color={muted ? colors.text.secondary : colors.text.brand} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" weight={600} color={muted ? 'secondary' : 'primary'}>{title}</Text>
        {(disabledNote ?? subtitle) ? <Text variant="bodySmall" color="secondary">{disabledNote ?? subtitle}</Text> : null}
      </View>
      {accessory}
      {value && !muted ? <Text variant="bodySmall" color="secondary">{value}</Text> : null}
      {s.showChevron ? <Icon name="chevron-forward" size={16} color={colors.text.secondary} /> : null}
    </>
  );
  const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minHeight: s.minHeight, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 };

  if (!onPress) {
    return (
      <View accessible accessibilityRole="text" accessibilityLabel={s.label} testID={testID} style={rowStyle}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={muted ? undefined : onPress}
      disabled={muted}
      accessibilityRole="button"
      accessibilityLabel={s.label}
      accessibilityState={s.state}
      testID={testID}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        ...rowStyle,
        backgroundColor: hovered && !muted ? colors.bg.subtle : 'transparent',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {content}
    </Pressable>
  );
}
