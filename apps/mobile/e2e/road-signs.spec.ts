import { test, expect, seedLearner, signInAs } from './support';

// /roadsigns is behind sign-in: run as a synthetic, onboarded learner.
test.beforeEach(async ({ page, network }) => {
  await seedLearner(page);
  await signInAs(page, network);
});

test.describe('Road Signs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/roadsigns');
  });

  test('page loads and shows sign grid', async ({ page }) => {
    await expect(page.getByText('Road Signs')).toBeVisible();
    // At least some signs visible
    const signs = page.locator('img[alt], [accessibilityLabel]');
    await expect(signs.first()).toBeVisible({ timeout: 10000 });
  });

  test('warning signs category visible', async ({ page }) => {
    await expect(page.getByText(/warning/i)).toBeVisible();
  });

  test('signs have images or SVG fallback — no broken images', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const brokenImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      // Only images that finished loading and failed: lazy, off-screen images aren't complete yet.
      return imgs.filter(img => img.complete && img.naturalWidth === 0).map(img => img.src);
    });
    expect(brokenImages).toHaveLength(0);
  });

  test('crossroads sign is visible', async ({ page }) => {
    await expect(page.getByText('Crossroads', { exact: true }).first()).toBeVisible({ timeout: 10000 });
  });

  test('tapping a sign opens its detail', async ({ page }) => {
    await page.getByText('Crossroads', { exact: true }).first().click();
    // Detail view shows the sign's meaning from @clearpass/content.
    await expect(page.getByText(/crossroads junction lies ahead/i).first()).toBeVisible();
  });
});
