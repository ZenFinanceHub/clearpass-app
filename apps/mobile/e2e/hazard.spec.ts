import { test, expect, Page } from '@playwright/test';

// Hazard perception tests
// Public tests run always. Auth tests require TEST_EMAIL + TEST_PASSWORD + TEST_IS_PREMIUM=1 env vars.

const EMAIL = process.env.TEST_EMAIL ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';
const IS_PREMIUM = process.env.TEST_IS_PREMIUM === '1';

async function signIn(page: Page) {
  await page.goto('/auth/signin');
  await page.locator('[data-testid="email-input"]').fill(EMAIL);
  await page.locator('[data-testid="password-input"]').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(tabs\/)?home/, { timeout: 15000 });
}

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
// Authenticated — skipped when TEST_EMAIL is not set
// ─────────────────────────────────────────────────────────────────
test.describe('Hazard Perception — authenticated', () => {
  test.skip(!EMAIL || !PASSWORD, 'Set TEST_EMAIL + TEST_PASSWORD to run auth tests');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('hazard info screen loads', async ({ page }) => {
    await page.goto('/hazard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Hazard Perception').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows clips from Supabase — not "coming soon"', async ({ page }) => {
    await page.goto('/hazard');
    await page.waitForLoadState('networkidle');

    // Wait for loading spinner to disappear (clips are fetching)
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 15000 });

    // "coming soon" means DB returned 0 clips — this is the bug we're catching
    const comingSoon = page.getByText('Videos coming soon');
    await expect(comingSoon).not.toBeVisible({ timeout: 5000 });

    // At least a clip count or start button should be visible
    const startBtn = page.getByRole('button', { name: /start|begin|practice/i });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
  });

  test.skip(!IS_PREMIUM, 'Requires a premium test account');
  test('premium user can start practice and first clip appears', async ({ page }) => {
    await page.goto('/hazard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Loading...')).not.toBeVisible({ timeout: 15000 });

    const startBtn = page.getByRole('button', { name: /start/i }).first();
    await startBtn.click();

    // Should move past the info screen into pre-clip or player phase
    await expect(page.getByText(/clip 1|hazard 1|get ready/i)).toBeVisible({ timeout: 15000 });
  });
});
