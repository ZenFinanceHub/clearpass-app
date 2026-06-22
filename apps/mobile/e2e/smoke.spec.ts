import { test, expect } from '@playwright/test';

// Fast smoke tests — verify the app loads and key routes respond

test('homepage loads', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBeLessThan(400);
  await expect(page).toHaveTitle(/ClearPass/i, { timeout: 15000 });
});

test('onboarding route loads', async ({ page }) => {
  const response = await page.goto('/onboarding');
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByText('Welcome to ClearPass')).toBeVisible({ timeout: 10000 });
});

test('road signs route loads', async ({ page }) => {
  const response = await page.goto('/roadsigns');
  expect(response?.status()).toBeLessThan(400);
});

test('no console errors on homepage', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Filter out known third-party noise
  const appErrors = errors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('ResizeObserver') &&
    !e.includes('chrome-extension')
  );
  expect(appErrors).toHaveLength(0);
});
