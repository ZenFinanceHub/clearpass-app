import { test, expect } from '@playwright/test';

test.describe('/auth/choose-account-type', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('referral_code'));
  });

  test('shows learner and instructor choice when no referral code is pending', async ({ page }) => {
    await page.goto('/auth/choose-account-type');
    await expect(page.getByText(/how will you use clearpass/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/i'm a learner/i)).toBeVisible();
    await expect(page.getByText(/i'm an instructor/i)).toBeVisible();
  });

  test('skips the choice and redirects to sign in when a referral code is pending but no session exists', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('referral_code', 'TESTCODE'));
    await page.goto('/auth/choose-account-type');
    await expect(page).toHaveURL(/signin/, { timeout: 10000 });
  });
});
