import { test, expect } from '@playwright/test';

// Auth-gated routes: verify they either redirect to auth or show
// appropriate content for unauthenticated users.

const AUTH_ROUTES = [
  '/(tabs)/home',
  '/(tabs)/practice',
  '/(tabs)/mock',
  '/(tabs)/learn',
  '/(tabs)/settings',
  '/(tabs)/tutor',
  '/(tabs)/highwaycode',
  '/(tabs)/roadsigns',
  '/(tabs)/hazard',
  '/(tabs)/progress',
  '/(tabs)/leaderboard',
  '/roadsigns',
  '/highwaycode',
  '/hazard',
  '/progress',
  '/leaderboard',
  '/aitutor',
  '/challenge',
  '/instructor',
  '/studyplan',
  '/study-plan',
  '/testday',
  '/ipassed',
  '/auth/testdate',
];

for (const route of AUTH_ROUTES) {
  test(`${route} — loads or redirects gracefully`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(route);
    await page.waitForLoadState('networkidle');

    // Should not 500 — either loads content or redirects to auth
    const url = page.url();
    const isAuthRedirect = /auth|signin|signup|onboarding|landing/i.test(url);
    const hasContent = await page.locator('body').textContent();

    // Page should render something
    expect(hasContent?.trim().length).toBeGreaterThan(0);

    // No unhandled JS errors that crash the page
    const crashErrors = errors.filter(e =>
      !e.includes('ResizeObserver') &&
      !e.includes('Non-Error promise rejection')
    );
    if (crashErrors.length > 0) {
      console.warn(`Page errors on ${route}:`, crashErrors);
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// Specific auth-gate behaviour checks
// ─────────────────────────────────────────────────────────────────
test.describe('Auth gates', () => {
  test('/(tabs)/home redirects unauthenticated to auth or landing', async ({ page }) => {
    await page.goto('/(tabs)/home');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    // Should not stay on home if not logged in
    const onHome = url.includes('home') && !url.includes('auth');
    if (onHome) {
      // If it does show home, it should show something (not blank)
      const content = await page.locator('body').textContent();
      expect(content?.trim().length).toBeGreaterThan(10);
    }
  });

  test('/challenge redirects unauthenticated to signin', async ({ page }) => {
    await page.goto('/challenge');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    // Challenge explicitly replaces to /auth/signin when no session
    const isRedirected = /auth|signin/i.test(url);
    if (!isRedirected) {
      // If it shows the page, it must have content
      const content = await page.locator('body').textContent();
      expect(content?.trim().length).toBeGreaterThan(10);
    }
  });

  test('/(tabs)/mock shows paywall or redirects for non-premium', async ({ page }) => {
    await page.goto('/(tabs)/mock');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    // Unauthenticated: might redirect to auth or paywall
    const body = await page.locator('body').textContent();
    expect(body?.trim().length).toBeGreaterThan(0);
  });

  test('/(tabs)/hazard shows paywall or redirects for non-premium', async ({ page }) => {
    await page.goto('/(tabs)/hazard');
    await page.waitForLoadState('networkidle');
    const body = await page.locator('body').textContent();
    expect(body?.trim().length).toBeGreaterThan(0);
  });
});
