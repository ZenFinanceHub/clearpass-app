import type { Page } from '@playwright/test';

/**
 * Reach a route the way in-app navigation does, after the root layout's
 * one-shot cold-start routing (app/_layout.tsx bootstrap) has run.
 *
 * Some screens (e.g. /landing) are never kept on a cold load for a
 * signed-out visitor — bootstrap redirects them to /onboarding or
 * /auth/signin — but they are reachable from inside the app (app/index.tsx,
 * sign-out in settings). This boots on a PUBLIC route (no redirect), lets
 * bootstrap finish, then performs a client-side history navigation.
 */
export async function clientNavigate(page: Page, path: string): Promise<void> {
  await page.goto('/privacy-policy');
  await page.waitForLoadState('networkidle');
  await page.getByText(/privacy/i).first().waitFor();
  await page.evaluate((to) => {
    history.pushState({}, '', to);
    dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, path);
  await page.waitForURL((u) => u.pathname === path.split('?')[0]);
}
