/**
 * /screenshot-mode seeds demo data over the learner's local progress, so it
 * must never be reachable in production. Allowed only in development builds
 * or when EXPO_PUBLIC_APP_ENV is 'local' or 'staging'; unset (production
 * today) or anything else is blocked. Pure, so it can be tested with plain
 * Node (see scripts/lib/screenshotModeGuard.test.mjs).
 */
export function isScreenshotModeAllowed(p: { isDev: boolean; appEnv: string | undefined }): boolean {
  return p.isDev || p.appEnv === 'local' || p.appEnv === 'staging';
}
