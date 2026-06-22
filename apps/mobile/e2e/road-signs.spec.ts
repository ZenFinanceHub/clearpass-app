import { test, expect } from '@playwright/test';

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
      return imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src);
    });
    expect(brokenImages).toHaveLength(0);
  });

  test('crossroads sign is visible', async ({ page }) => {
    await expect(page.getByText('Crossroads')).toBeVisible({ timeout: 10000 });
  });

  test('tapping a sign shows its name', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    // Click the first sign card
    const firstSign = page.locator('[role="button"]').first();
    if (await firstSign.isVisible()) {
      await firstSign.click();
      // Some kind of detail or label should appear
      await expect(page.locator('text=/[A-Z][a-z]+/')).toBeVisible();
    }
  });
});
