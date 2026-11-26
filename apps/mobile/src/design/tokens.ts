/**
 * ClearPass 2.0 design tokens (docs/clearpass-2.0/01-design-spec.md §2).
 *
 * Components refer to ROLES (`colors.text.secondary`), never to hex values.
 * Light and dark sets are generated here from one palette, and
 * scripts/lib/designTokens.test.mjs asserts every foreground/background
 * pair listed in CONTRAST_PAIRS meets WCAG 2.2 AA — add a pair there for
 * any new combination a component uses.
 *
 * Pure module: no React Native imports, so plain Node can test it.
 *
 * The legacy modules (src/constants/theme.ts `Colors`, src/theme.ts
 * `useTheme`) are untouched and keep driving every screen while the
 * `uiV2` flag is off; `src/theme.ts` also re-exports the v2 hook so a
 * screen can migrate piecemeal without a second import path.
 */

// ─── Approved palette (§2.1) ────────────────────────────────────────────────

export const palette = {
  indigo: '#4F46E5',
  indigoDeep: '#312E81',
  teal: '#0F766E',
  gold: '#F59E0B', // decoration only, or with dark text ON it. Never text, never white on it.
  success: '#047857',
  error: '#B91C1C',
  ink: '#111827',
  grey: '#6B7280',
  canvas: '#F7F8FC',
  white: '#FFFFFF',
  cream: '#FFFBF0',
  // Dark mode (§2.3)
  darkCanvas: '#0A0A0F',
  darkCard: '#1F2937',
  darkText: '#F9FAFB',
  darkSecondaryText: '#D1D5DB',
  indigoLight: '#818CF8',
  tealLight: '#2DD4BF',
  successLight: '#34D399',
  errorLight: '#F87171',
} as const;

export type ColorScheme = 'light' | 'dark';

export interface ColorTokens {
  scheme: ColorScheme;
  bg: {
    canvas: string;
    card: string;
    subtle: string;
    brandSubtle: string;
    secondarySubtle: string;
    goldSubtle: string;
  };
  text: {
    primary: string;
    secondary: string;
    /** Secondary text on tinted surfaces (bg.subtle / *Subtle), where #6B7280 drops below 4.5. */
    secondaryOnTint: string;
    onPrimary: string;
    onSecondary: string;
    onGold: string;
    link: string;
    brand: string;
    secondaryBrand: string;
  };
  brand: { primary: string; deep: string; secondary: string };
  accent: { gold: string };
  status: {
    success: string; successBg: string;
    error: string; errorBg: string;
    warning: string; warningBg: string;
    info: string; infoBg: string;
  };
  border: { default: string; strong: string };
  focus: { ring: string };
  chart: { track: string; fill: string; success: string };
  /** Go Pro card: deep indigo surface. Gold only as decoration or a fill under dark text. */
  promo: { bg: string; text: string; textSecondary: string; ctaBg: string; ctaText: string };
  /** Desktop sidebar navigation. */
  nav: { bg: string; activeBg: string; activeText: string; text: string };
}

export interface ColorOptions {
  scheme: ColorScheme;
  highContrast?: boolean;
  /** Existing "cream background" accessibility setting (light only). */
  cream?: boolean;
}

const LIGHT: ColorTokens = {
  scheme: 'light',
  bg: {
    canvas: palette.canvas,
    card: palette.white,
    subtle: '#F1F3F9',
    brandSubtle: '#EEF2FF',
    secondarySubtle: '#F0FDFA',
    goldSubtle: '#FEF3C7',
  },
  text: {
    primary: palette.ink,
    secondary: palette.grey,
    secondaryOnTint: '#4B5563',
    onPrimary: palette.white,
    onSecondary: palette.white,
    onGold: palette.ink,
    link: palette.indigo,
    brand: palette.indigo,
    secondaryBrand: palette.teal,
  },
  brand: { primary: palette.indigo, deep: palette.indigoDeep, secondary: palette.teal },
  accent: { gold: palette.gold },
  status: {
    success: palette.success, successBg: '#D1FAE5',
    error: palette.error, errorBg: '#FEE2E2',
    warning: '#92400E', warningBg: '#FEF3C7',
    info: '#1D4ED8', infoBg: '#DBEAFE',
  },
  border: { default: '#E5E7EB', strong: palette.grey },
  focus: { ring: palette.indigo },
  chart: { track: '#E0E7FF', fill: palette.indigo, success: palette.success },
  promo: { bg: palette.indigoDeep, text: palette.white, textSecondary: '#C7D2FE', ctaBg: palette.white, ctaText: palette.indigoDeep },
  nav: { bg: palette.white, activeBg: '#EEF2FF', activeText: palette.indigo, text: '#4B5563' },
};

const DARK: ColorTokens = {
  scheme: 'dark',
  bg: {
    canvas: palette.darkCanvas,
    card: palette.darkCard,
    subtle: '#111827',
    brandSubtle: '#1E1B4B',
    secondarySubtle: '#042F2E',
    goldSubtle: '#451A03',
  },
  text: {
    primary: palette.darkText,
    secondary: palette.darkSecondaryText,
    secondaryOnTint: palette.darkSecondaryText,
    // White on #818CF8 fails (2.98): dark text on dark-mode primary buttons.
    onPrimary: palette.darkCanvas,
    onSecondary: palette.darkCanvas,
    onGold: palette.ink,
    link: '#A5B4FC',
    brand: '#A5B4FC',
    secondaryBrand: '#5EEAD4',
  },
  brand: { primary: palette.indigoLight, deep: '#C7D2FE', secondary: palette.tealLight },
  accent: { gold: palette.gold },
  status: {
    success: palette.successLight, successBg: '#064E3B',
    error: palette.errorLight, errorBg: '#450A0A',
    warning: '#FBBF24', warningBg: '#451A03',
    info: '#93C5FD', infoBg: '#172554',
  },
  border: { default: '#374151', strong: '#9CA3AF' },
  focus: { ring: '#A5B4FC' },
  chart: { track: '#374151', fill: palette.indigoLight, success: palette.successLight },
  promo: { bg: palette.indigoDeep, text: palette.white, textSecondary: '#C7D2FE', ctaBg: palette.white, ctaText: palette.indigoDeep },
  nav: { bg: '#111827', activeBg: '#1E1B4B', activeText: '#A5B4FC', text: palette.darkSecondaryText },
};

export function buildColorTokens({ scheme, highContrast = false, cream = false }: ColorOptions): ColorTokens {
  const base = scheme === 'dark' ? DARK : LIGHT;
  const t: ColorTokens = {
    ...base,
    bg: { ...base.bg },
    text: { ...base.text },
    border: { ...base.border },
    nav: { ...base.nav },
  };
  if (scheme === 'light' && cream) t.bg.canvas = palette.cream;
  if (highContrast) {
    const strong = scheme === 'dark' ? '#FFFFFF' : '#000000';
    t.text.primary = strong;
    t.text.secondary = strong;
    t.text.secondaryOnTint = strong;
    t.nav.text = strong;
    t.border.default = strong;
    t.border.strong = strong;
  }
  return t;
}

// ─── Pairs that must pass AA (enforced by scripts/lib/designTokens.test.mjs) ─

type Path = string; // e.g. 'text.secondary'
export interface ContrastPair { fg: Path; bg: Path; min: number; note?: string }

const PLAIN_SURFACES = ['bg.canvas', 'bg.card'];
const TINTED_SURFACES = ['bg.subtle', 'bg.brandSubtle', 'bg.secondarySubtle', 'bg.goldSubtle'];

export const CONTRAST_PAIRS: ContrastPair[] = [
  // Body text on every surface a card or screen can use.
  ...[...PLAIN_SURFACES, ...TINTED_SURFACES].map((bg) => ({ fg: 'text.primary', bg, min: 4.5 })),
  ...PLAIN_SURFACES.map((bg) => ({ fg: 'text.secondary', bg, min: 4.5 })),
  ...[...PLAIN_SURFACES, ...TINTED_SURFACES].map((bg) => ({ fg: 'text.secondaryOnTint', bg, min: 4.5 })),
  { fg: 'text.link', bg: 'bg.canvas', min: 4.5 },
  { fg: 'text.link', bg: 'bg.card', min: 4.5 },
  { fg: 'text.brand', bg: 'bg.card', min: 4.5 },
  { fg: 'text.brand', bg: 'bg.canvas', min: 4.5 },
  { fg: 'text.brand', bg: 'bg.brandSubtle', min: 4.5 },
  { fg: 'text.secondaryBrand', bg: 'bg.card', min: 4.5 },
  { fg: 'text.secondaryBrand', bg: 'bg.secondarySubtle', min: 4.5 },
  // Filled controls.
  { fg: 'text.onPrimary', bg: 'brand.primary', min: 4.5, note: 'primary button' },
  { fg: 'text.onPrimary', bg: 'brand.deep', min: 4.5 },
  { fg: 'text.onSecondary', bg: 'brand.secondary', min: 4.5 },
  { fg: 'text.onGold', bg: 'accent.gold', min: 4.5, note: 'streak / Pro badge' },
  // Status text on its tint and on cards.
  { fg: 'status.success', bg: 'status.successBg', min: 4.5 },
  { fg: 'status.success', bg: 'bg.card', min: 4.5 },
  { fg: 'status.error', bg: 'status.errorBg', min: 4.5 },
  { fg: 'status.error', bg: 'bg.card', min: 4.5 },
  { fg: 'status.warning', bg: 'status.warningBg', min: 4.5 },
  { fg: 'status.info', bg: 'status.infoBg', min: 4.5 },
  // Meaningful non-text UI (3:1).
  { fg: 'brand.primary', bg: 'bg.card', min: 3, note: 'icons, active tab, outline button' },
  { fg: 'brand.primary', bg: 'bg.canvas', min: 3 },
  { fg: 'border.strong', bg: 'bg.card', min: 3, note: 'input borders' },
  { fg: 'focus.ring', bg: 'bg.canvas', min: 3 },
  { fg: 'focus.ring', bg: 'bg.card', min: 3 },
  { fg: 'chart.fill', bg: 'chart.track', min: 3, note: 'progress bar fill vs track' },
  { fg: 'chart.success', bg: 'chart.track', min: 3 },
  // Go Pro card.
  { fg: 'promo.text', bg: 'promo.bg', min: 4.5 },
  { fg: 'promo.textSecondary', bg: 'promo.bg', min: 4.5 },
  { fg: 'promo.ctaText', bg: 'promo.ctaBg', min: 4.5 },
  { fg: 'promo.ctaBg', bg: 'promo.bg', min: 3, note: 'CTA shape vs card' },
  { fg: 'text.onGold', bg: 'accent.gold', min: 4.5 },
  // Desktop sidebar.
  { fg: 'nav.text', bg: 'nav.bg', min: 4.5 },
  { fg: 'nav.activeText', bg: 'nav.activeBg', min: 4.5 },
  { fg: 'text.primary', bg: 'nav.bg', min: 4.5 },
];

export function resolveToken(tokens: ColorTokens, path: Path): string {
  const value = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], tokens);
  if (typeof value !== 'string') throw new Error(`Unknown token path: ${path}`);
  return value;
}

// ─── Typography (§2.4) ───────────────────────────────────────────────────────

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'bodySmall' | 'label' | 'caption';
export type FontWeight = 400 | 500 | 600 | 700;

export const typeScale: Record<TextVariant, { size: number; lineHeight: number; weight: FontWeight }> = {
  display:    { size: 28, lineHeight: 34, weight: 700 },
  title:      { size: 22, lineHeight: 28, weight: 700 },
  heading:    { size: 18, lineHeight: 24, weight: 600 },
  body:       { size: 16, lineHeight: 24, weight: 400 },
  bodyStrong: { size: 16, lineHeight: 24, weight: 600 },
  bodySmall:  { size: 14, lineHeight: 20, weight: 400 },
  label:      { size: 14, lineHeight: 20, weight: 600 },
  // Never for essential information.
  caption:    { size: 12, lineHeight: 16, weight: 500 },
};

/** Inter family names as registered by expo-font (see src/design/fonts.ts). */
export const interFamily: Record<FontWeight, string> = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
};

/** Existing in-app Large Text setting multiplier (matches src/theme.ts). */
export const LARGE_TEXT_MULTIPLIER = 1.2;
/** Cap on the OS font-scale multiplier per variant (200% for body copy). */
export const maxFontScale: Record<TextVariant, number> = {
  display: 1.5, title: 1.6, heading: 1.8, body: 2, bodyStrong: 2, bodySmall: 2, label: 1.6, caption: 2,
};

// ─── Shape, spacing, elevation (§2.5) ───────────────────────────────────────

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 } as const;
export const radii = { card: 16, control: 12, pill: 999, tabIndicator: 12 } as const;
export const minTouchTarget = 44;
/** Max content width for the Home column on desktop web. */
export const contentMaxWidth = 1120;
