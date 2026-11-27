/**
 * ClearPass 2.0 ("Daily Coach") presentation flag.
 *
 * `uiV2` switches on the redesigned screens. It is a BUILD-TIME value:
 * Expo inlines `process.env.EXPO_PUBLIC_*` only when it is referenced
 * statically like this, so keep these as plain property accesses (no
 * destructuring, no dynamic keys).
 *
 * It can never be on in production: both conditions must hold, and a
 * production build has EXPO_PUBLIC_APP_ENV unset (unset = production).
 *
 *   EXPO_PUBLIC_UI_V2=1 EXPO_PUBLIC_APP_ENV=local   -> on
 *   EXPO_PUBLIC_UI_V2=1 EXPO_PUBLIC_APP_ENV=staging -> on
 *   anything else (including production)            -> off
 *
 * With the flag off the app behaves exactly as before: every v2 code path
 * is gated on this constant.
 *
 * TODO: PR #108 introduces `appConfig.uiV2` (environment config for
 * local/staging/production). Once that is merged, this module should
 * re-export it instead of reading env vars itself.
 */
export const uiV2: boolean =
  process.env.EXPO_PUBLIC_UI_V2 === '1' &&
  (process.env.EXPO_PUBLIC_APP_ENV === 'local' || process.env.EXPO_PUBLIC_APP_ENV === 'staging');

/**
 * Dev-only screens (e.g. /dev/home-preview) render in a development build
 * or in a local/staging build. Never in a production export.
 */
export const devScreensEnabled: boolean =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  process.env.EXPO_PUBLIC_APP_ENV === 'local' ||
  process.env.EXPO_PUBLIC_APP_ENV === 'staging';
