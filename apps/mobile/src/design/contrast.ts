/**
 * WCAG 2.x contrast maths. Pure, no React Native imports, so it runs under
 * plain Node (scripts/lib/designTokens.test.mjs).
 */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance of a #RRGGBB colour. */
export function luminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error(`Not a #RRGGBB colour: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Contrast ratio between two #RRGGBB colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2.2 AA minimums. */
export const AA = {
  text: 4.5,
  largeText: 3,
  nonText: 3,
} as const;
