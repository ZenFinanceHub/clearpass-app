import { test, expect, seedLearner, signInAs } from './support';

// Hazard perception. Everything runs against the local export with the
// stubbed backend; there is no real-account sign-in any more (the old
// TEST_EMAIL/TEST_PASSWORD path signed in against production).

// ─────────────────────────────────────────────────────────────────
// Public (no auth required)
// ─────────────────────────────────────────────────────────────────
test.describe('Hazard Perception — public', () => {
  test('/hazard redirects or loads without crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/hazard');
    await page.waitForLoadState('networkidle');
    // Should either redirect to landing/auth or show hazard content — never a blank crash
    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(10);
    expect(errors.filter(e => !e.includes('Warning:'))).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// Signed in (synthetic learner)
// ─────────────────────────────────────────────────────────────────
test.describe('Hazard Perception — signed in', () => {
  test.beforeEach(async ({ page, network }) => {
    await seedLearner(page);
    await signInAs(page, network);
  });

  test('web shows the "Mobile app only" screen', async ({ page }) => {
    await page.goto('/hazard');
    await expect(page.getByText('Mobile app only')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Get it on Google Play')).toBeVisible();
  });

  // Hazard perception is disabled on web (app/(tabs)/hazard.tsx returns the
  // "Mobile app only" screen before any clip is loaded), so clip loading and
  // playback can't be exercised by this web suite. They need a device run.
  test.skip('shows clips — not "coming soon" (web build has no hazard player)', async ({ page }) => {
    await page.goto('/hazard');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Videos coming soon')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/start|begin|practice/i).first()).toBeVisible({ timeout: 10000 });
  });

  test.skip('premium user can start practice and first clip appears (web build has no hazard player)', async ({ page }) => {
    await page.goto('/hazard');
    await page.getByText(/start/i).first().click();
    await expect(page.getByText(/clip 1|hazard 1|get ready/i)).toBeVisible({ timeout: 15000 });
  });
});
