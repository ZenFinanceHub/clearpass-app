export const Colors = {
  // Brand
  indigo: '#4F46E5',
  indigoDark: '#818CF8',   // dark mode primary — indigo-400, readable on near-black surfaces
  violet: '#7C3AED',

  // Brand tints (for backgrounds/badges)
  indigoBg: '#EDE9FE',
  violetBg: '#F5F3FF',

  // Semantics
  emerald: '#10B981',
  emeraldBg: '#D1FAE5',
  amber: '#F5A623',        // caution/warning states only — low question count, expiry, time alerts
  amberBg: '#FEF3C7',
  orange: '#EA580C',       // gamification rewards — streaks, XP, celebrations
  orangeBg: '#FFF7ED',
  red: '#EF4444',
  redBg: '#FEE2E2',

  // Neutrals
  navy: '#0B1220',
  textPrimary: '#111827',
  textDark: '#374151',
  mutedText: '#6B7280',
  subtleText: '#9CA3AF',
  cardWhite: '#FFFFFF',
  offWhite: '#F7F8FA',
  border: '#E5E7EB',
  surfaceGray: '#F3F4F6',  // light mode card surface
  darkSurface: '#1F2937',  // dark mode card surface — gray-800
};

export type ColorKey = keyof typeof Colors;

export const Typography = {
  screenTitle: 22,
  sectionHeading: 15,
  body: 14,
  bodySmall: 13,
  meta: 12,
  tiny: 11,
  micro: 10,
  nano: 9,
} as const;

export const Radii = {
  card: 16,
  cardSmall: 12,
  chip: 20,
  button: 10,
  tag: 6,
} as const;
