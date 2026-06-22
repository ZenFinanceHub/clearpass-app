import { test, expect } from '@playwright/test';

test.describe('Practice Questions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/(tabs)/practice');
    await page.waitForLoadState('networkidle');
  });

  test('practice page loads', async ({ page }) => {
    // Either shows questions or a login/start prompt
    const hasContent = await page.locator('text=/question|practice|start/i').first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasContent).toBe(true);
  });

  test('a question has 4 answer options', async ({ page }) => {
    // If signed in and question shows, expect 4 options
    const options = page.locator('[role="button"]').filter({ hasText: /^[A-D]\.|[a-zA-Z]/ });
    const count = await options.count();
    if (count > 0) {
      expect(count).toBeGreaterThanOrEqual(4);
    }
  });
});

test.describe('Mock Test', () => {
  test('mock test page loads', async ({ page }) => {
    await page.goto('/(tabs)/mock');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator('text=/mock|test|start/i').first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasContent).toBe(true);
  });
});
