/**
 * Reduced Motion (ClearPass 2.0, spec §6.9). PURE: no imports, so plain Node
 * tests it (scripts/lib/reducedMotion.test.mjs).
 *
 * The in-app choice is stored as the optional `reduceMotion` key of the
 * existing accessibility settings (src/AccessibilityContext). The OS setting
 * is a MINIMUM: learners can turn reduced motion on in ClearPass, but cannot
 * override an enabled OS preference (effective = OS || in-app). The in-app
 * value is honoured only with `uiV2` on, so with the flag off every
 * animation follows the OS setting exactly as before.
 */
export function resolveReduceMotion({ inApp, os, uiV2 }: { inApp?: boolean | null; os: boolean; uiV2: boolean }): boolean {
  if (!uiV2) return os;
  return os || inApp === true;
}

export const REDUCED_MOTION_OS_NOTE = "On because your device's Reduce Motion setting is on";

/** The Profile toggle: shown on and locked (with a note) while the OS setting is on. */
export function reduceMotionToggleState({ inApp, os }: { inApp?: boolean | null; os: boolean }): {
  value: boolean; disabled: boolean; note: string | null;
} {
  if (os) return { value: true, disabled: true, note: REDUCED_MOTION_OS_NOTE };
  return { value: inApp === true, disabled: false, note: null };
}

/** The Profile › Accessibility row (ui_v2 only). Same shape as the other rows in settings.tsx. */
export const REDUCED_MOTION_SETTING = {
  key: 'reduceMotion',
  label: 'Reduce Motion',
  description: 'Turns off moving animations, such as the road and car on Home.',
  icon: '[ rm ]',
} as const;
