import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, type TextStyle } from 'react-native';
import { useAccessibility } from '@/src/AccessibilityContext';
import { useInterFonts } from './fonts';
import {
  buildColorTokens,
  interFamily,
  LARGE_TEXT_MULTIPLIER,
  maxFontScale,
  radii,
  space,
  typeScale,
  type ColorScheme,
  type ColorTokens,
  type FontWeight,
  type TextVariant,
} from './tokens';

/**
 * ClearPass 2.0 theme. Reads the EXISTING in-app accessibility settings
 * (src/AccessibilityContext: darkMode, highContrast, creamBackground,
 * largeText, dyslexiaFont, wordSpacing) — no new stored settings — and
 * combines Reduced Motion from the OS.
 *
 * `DesignThemeProvider` is optional: `useDesignTheme()` works without it.
 * The provider exists so a dev preview can force a scheme
 * (e.g. /dev/home-preview?theme=dark) without touching stored settings.
 */

export interface DesignThemeOverrides {
  scheme?: ColorScheme;
  reduceMotion?: boolean;
}

const OverridesContext = createContext<DesignThemeOverrides>({});

export function DesignThemeProvider({ overrides, children }: { overrides?: DesignThemeOverrides; children: React.ReactNode }) {
  const value = useMemo(() => overrides ?? {}, [overrides]);
  return <OverridesContext.Provider value={value}>{children}</OverridesContext.Provider>;
}

/** OS reduce-motion setting. (An in-app toggle is planned for P6-1; it will be OR-ed in here.) */
export function useOsReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (alive) setReduce(v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduce;
}

export interface DesignTheme {
  colors: ColorTokens;
  scheme: ColorScheme;
  space: typeof space;
  radii: typeof radii;
  reduceMotion: boolean;
  largeText: boolean;
  dyslexiaFont: boolean;
  fontsLoaded: boolean;
  /** Full text style for a type-scale variant, with an optional weight override. */
  textStyle: (variant: TextVariant, weight?: FontWeight) => TextStyle;
  maxFontScale: (variant: TextVariant) => number;
}

export function useDesignTheme(): DesignTheme {
  const overrides = useContext(OverridesContext);
  const { settings } = useAccessibility();
  const osReduceMotion = useOsReduceMotion();
  const fontsLoaded = useInterFonts();

  const scheme: ColorScheme = overrides.scheme ?? (settings.darkMode ? 'dark' : 'light');
  const { highContrast, creamBackground, largeText, dyslexiaFont, wordSpacing } = settings;
  const reduceMotion = overrides.reduceMotion ?? osReduceMotion;

  return useMemo<DesignTheme>(() => {
    const colors = buildColorTokens({ scheme, highContrast, cream: creamBackground });
    const mult = largeText ? LARGE_TEXT_MULTIPLIER : 1;

    function family(weight: FontWeight): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
      if (dyslexiaFont) {
        // OpenDyslexic replaces Inter wholesale (already loaded in app/_layout.tsx).
        return { fontFamily: weight >= 600 ? 'OpenDyslexic-Bold' : 'OpenDyslexic-Regular' };
      }
      if (fontsLoaded) return { fontFamily: interFamily[weight] };
      return { fontWeight: String(weight) as TextStyle['fontWeight'] };
    }

    function textStyle(variant: TextVariant, weight?: FontWeight): TextStyle {
      const v = typeScale[variant];
      return {
        ...family(weight ?? v.weight),
        fontSize: Math.round(v.size * mult),
        lineHeight: Math.round(v.lineHeight * mult * (wordSpacing ? 1.25 : 1)),
        letterSpacing: wordSpacing ? 1.5 : variant === 'display' || variant === 'title' ? -0.3 : 0,
      };
    }

    return {
      colors,
      scheme,
      space,
      radii,
      reduceMotion,
      largeText,
      dyslexiaFont,
      fontsLoaded,
      textStyle,
      maxFontScale: (variant) => maxFontScale[variant],
    };
  }, [scheme, highContrast, creamBackground, largeText, dyslexiaFont, wordSpacing, reduceMotion, fontsLoaded]);
}
