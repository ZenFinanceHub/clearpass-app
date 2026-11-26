/**
 * Reduced Motion (ClearPass 2.0, spec §6.9). PURE: no imports, so plain Node
 * tests it (scripts/lib/reducedMotion.test.mjs).
 *
 * The in-app choice is stored as the optional `reduceMotion` key of the
 * existing accessibility settings (src/AccessibilityContext). Unset means
 * "follow the OS". It is honoured only with `uiV2` on, so with the flag off
 * every animation follows the OS setting exactly as before.
 */
export function resolveReduceMotion({ inApp, os, uiV2 }: { inApp?: boolean | null; os: boolean; uiV2: boolean }): boolean {
  if (!uiV2) return os;
  return typeof inApp === 'boolean' ? inApp : os;
}

/** The Profile › Accessibility row (ui_v2 only). Same shape as the other rows in settings.tsx. */
export const REDUCED_MOTION_SETTING = {
  key: 'reduceMotion',
  label: 'Reduce Motion',
  description: 'Turns off moving animations, such as the road and car on Home. Starts with your device setting.',
  icon: '[ rm ]',
} as const;
