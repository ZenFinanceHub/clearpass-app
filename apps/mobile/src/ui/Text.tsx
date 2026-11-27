import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useDesignTheme } from '@/src/design';
import type { ColorTokens, FontWeight, TextVariant } from '@/src/design/tokens';

type TextColor = keyof ColorTokens['text'] | 'success' | 'error' | 'warning' | 'info';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  weight?: FontWeight;
  align?: 'left' | 'center' | 'right';
}

/**
 * Themed text. Uses the type scale, Inter (or OpenDyslexic), the in-app
 * Large Text setting and a capped OS font scale. Headings get
 * accessibilityRole="header" automatically.
 */
export function Text({ variant = 'body', color = 'primary', weight, align, style, ...rest }: TextProps) {
  const theme = useDesignTheme();
  const c = theme.colors;
  const resolved =
    color === 'success' || color === 'error' || color === 'warning' || color === 'info'
      ? c.status[color]
      : c.text[color];
  const isHeader = variant === 'display' || variant === 'title' || variant === 'heading';
  return (
    <RNText
      accessibilityRole={isHeader ? 'header' : undefined}
      maxFontSizeMultiplier={theme.maxFontScale(variant)}
      style={[theme.textStyle(variant, weight), { color: resolved }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}
