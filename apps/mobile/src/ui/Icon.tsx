import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  /** Required when the icon is the only label of a control; omit for decorative icons. */
  accessibilityLabel?: string;
}

/** Ionicons wrapper. Decorative unless given an accessibilityLabel. */
export function Icon({ name, size = 24, color, accessibilityLabel }: IconProps) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      accessibilityElementsHidden={!accessibilityLabel}
    />
  );
}
