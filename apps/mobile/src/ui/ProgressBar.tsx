import React from 'react';
import { View } from 'react-native';
import { useDesignTheme } from '@/src/design';

/** Accessible progress bar (role progressbar with min/max/now). Value 0–1. */
export function ProgressBar({ value, label, tone = 'brand', height = 8 }: {
  value: number; label: string; tone?: 'brand' | 'success'; height?: number;
}) {
  const { colors, radii } = useDesignTheme();
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const pct = Math.round(v * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct, text: `${pct}%` }}
      style={{ height, borderRadius: radii.pill, backgroundColor: colors.chart.track, overflow: 'hidden' }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: radii.pill,
          backgroundColor: tone === 'success' ? colors.chart.success : colors.chart.fill,
        }}
      />
    </View>
  );
}
