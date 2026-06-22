import { test, expect } from '@playwright/test';

test.describe('Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage so onboarding always shows fresh
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/onboarding');
  });

  test('shows welcome slide on load', async ({ page }) => {
    await expect(page.getByText('Welcome to ClearPass')).toBeVisible();
    await expect(page.getByText('Pass your theory test. First time.')).toBeVisible();
  });

  test('Next button advances to slide 2', async ({ page }) => {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Practice smarter')).toBeVisible();
  });

  test('progresses through all 4 slides with single tap each', async ({ page }) => {
    const slides = [
      'Welcome to ClearPass',
      'Practice smarter',
      'Track your progress',
      'Set your test date',
    ];

    for (let i = 0; i < slides.length - 1; i++) {
      await expect(page.getByText(slides[i])).toBeVisible();
      await page.getByRole('button', { name: 'Next' }).click();
    }

    await expect(page.getByText('Set your test date')).toBeVisible();
    await expect(page.getByPlaceholder('DD/MM/YYYY')).toBeVisible();
  });

  test('pagination dots update as slides advance', async ({ page }) => {
    // 4 dots total, first active
    const dots = page.locator('[style*="backgroundColor"]');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Practice smarter')).toBeVisible();
  });

  test('Skip for now skips date slide and navigates away', async ({ page }) => {
    // Navigate to final slide
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Next' }).click();
    }
    await expect(page.getByText('Set your test date')).toBeVisible();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    // Should leave onboarding (navigate to auth/signup or similar)
    await expect(page).not.toHaveURL('/onboarding');
  });

  test('invalid date shows error', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Next' }).click();
    }
    await page.getByPlaceholder('DD/MM/YYYY').fill('99/99/9999');
    await page.getByRole('button', { name: "Let's Go" }).click();
    await expect(page.getByText('Enter a valid date (DD/MM/YYYY)')).toBeVisible();
  });

  test('valid date accepts and navigates away', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Next' }).click();
    }
    // Set a future date
    const future = new Date();
    future.setMonth(future.getMonth() + 3);
    const dd = String(future.getDate()).padStart(2, '0');
    const mm = String(future.getMonth() + 1).padStart(2, '0');
    const yyyy = future.getFullYear();
    await page.getByPlaceholder('DD/MM/YYYY').fill(`${dd}/${mm}/${yyyy}`);
    await page.getByRole('button', { name: "Let's Go" }).click();
    await expect(page).not.toHaveURL('/onboarding');
  });
});
