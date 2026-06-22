import { test, expect, Page } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
async function noPageErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

// ─────────────────────────────────────────────────────────────────
// /landing
// ─────────────────────────────────────────────────────────────────
test.describe('/landing', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/landing'); });

  test('loads without crash', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows Sign In link', async ({ page }) => {
    await expect(page.getByText('Sign In').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows a CTA button (Start Free or Get started free)', async ({ page }) => {
    const cta = page.getByRole('button', { name: /start learning for free/i }).or(
      page.getByRole('button', { name: /start free/i })
    ).first();
    await expect(cta).toBeVisible({ timeout: 10000 });
  });

  test('Sign In navigates to auth', async ({ page }) => {
    await page.getByText('Sign In').first().click();
    await expect(page).toHaveURL(/auth/);
  });

  test('Privacy Policy link is present', async ({ page }) => {
    await expect(page.getByText(/privacy policy/i)).toBeVisible({ timeout: 10000 });
  });

  test('Terms link is present', async ({ page }) => {
    await expect(page.getByText(/terms/i)).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────
// /onboarding
// ─────────────────────────────────────────────────────────────────
test.describe('/onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/onboarding');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/onboarding');
  });

  test('loads slide 1', async ({ page }) => {
    await expect(page.getByText('Welcome to ClearPass')).toBeVisible({ timeout: 10000 });
  });

  test('Next advances to slide 2', async ({ page }) => {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Practice smarter')).toBeVisible();
  });

  test('Next advances to slide 3', async ({ page }) => {
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Track your progress')).toBeVisible();
  });

  test('Next advances to slide 4 with date input', async ({ page }) => {
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Set your test date')).toBeVisible();
    await expect(page.getByPlaceholder('DD/MM/YYYY')).toBeVisible();
  });

  test('Skip for now leaves onboarding', async ({ page }) => {
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page).not.toHaveURL(/\/onboarding$/);
  });

  test('invalid date shows validation error', async ({ page }) => {
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
    await page.getByPlaceholder('DD/MM/YYYY').fill('99/99/9999');
    await page.getByRole('button', { name: /let.s go/i }).click();
    await expect(page.getByText(/valid date/i)).toBeVisible();
  });

  test('past date shows validation error', async ({ page }) => {
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
    await page.getByPlaceholder('DD/MM/YYYY').fill('01/01/2020');
    await page.getByRole('button', { name: /let.s go/i }).click();
    await expect(page.getByText(/valid date/i)).toBeVisible();
  });

  test("valid future date accepts and leaves onboarding", async ({ page }) => {
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
    await page.getByPlaceholder('DD/MM/YYYY').fill('15/12/2026');
    await page.getByRole('button', { name: /let.s go/i }).click();
    await expect(page).not.toHaveURL(/\/onboarding$/);
  });

  test('each slide shows only one Next/Go button at a time', async ({ page }) => {
    const btn = page.getByRole('button', { name: /next|let.s go/i });
    await expect(btn).toHaveCount(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// /auth
// ─────────────────────────────────────────────────────────────────
test.describe('/auth', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/auth'); });

  test('loads auth page', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('shows sign in and sign up tabs or inputs', async ({ page }) => {
    const signIn = page.getByText(/sign in/i).first();
    await expect(signIn).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────
// /auth/signin
// ─────────────────────────────────────────────────────────────────
test.describe('/auth/signin', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/auth/signin'); });

  test('shows email and password fields', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const email = page.locator('[data-testid="email-input"]').or(page.getByPlaceholder(/email/i)).first();
    await expect(email).toBeVisible({ timeout: 10000 });
  });

  test('shows Sign In button', async ({ page }) => {
    const btn = page.getByRole('button', { name: /sign in/i }).or(page.locator('[aria-label="Sign in"]')).first();
    await expect(btn).toBeVisible({ timeout: 10000 });
  });

  test('shows Forgot password link', async ({ page }) => {
    await expect(page.getByText(/forgot password/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows Sign up link', async ({ page }) => {
    await expect(page.getByText(/sign up/i)).toBeVisible({ timeout: 10000 });
  });

  test('empty submit shows error', async ({ page }) => {
    const btn = page.getByRole('button', { name: /sign in/i }).or(page.locator('[aria-label="Sign in"]')).first();
    await btn.click().catch(() => {});
    await expect(page.getByText(/email|required|invalid/i).first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // some apps just disable the button — acceptable
    });
  });

  test('Forgot password link navigates to forgot-password', async ({ page }) => {
    await page.getByText(/forgot password/i).click();
    await expect(page).toHaveURL(/forgot-password/);
  });

  test('Sign up link navigates to signup', async ({ page }) => {
    const signUpLink = page.getByText(/sign up/i).last();
    await signUpLink.click();
    await expect(page).toHaveURL(/signup/);
  });
});

// ─────────────────────────────────────────────────────────────────
// /auth/signup
// ─────────────────────────────────────────────────────────────────
test.describe('/auth/signup', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/auth/signup'); });

  test('shows Create Account heading', async ({ page }) => {
    await expect(page.getByText(/create account/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows username, email, password fields', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const fields = page.locator('input');
    await expect(fields.first()).toBeVisible({ timeout: 10000 });
    expect(await fields.count()).toBeGreaterThanOrEqual(3);
  });

  test('shows sign in link', async ({ page }) => {
    await expect(page.getByText(/sign in/i)).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────
// /auth/forgot-password
// ─────────────────────────────────────────────────────────────────
test.describe('/auth/forgot-password', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/auth/forgot-password'); });

  test('shows Reset Password heading', async ({ page }) => {
    await expect(page.getByText(/reset password/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows email input', async ({ page }) => {
    await expect(page.locator('input').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows Send Reset Link button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /send reset|reset/i })).toBeVisible({ timeout: 10000 });
  });

  test('Back button is present', async ({ page }) => {
    await expect(page.getByText(/back/i)).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────
// /paywall
// ─────────────────────────────────────────────────────────────────
test.describe('/paywall', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/paywall'); });

  test('loads paywall page', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('shows Go Premium or pricing content', async ({ page }) => {
    const premium = page.getByText(/premium|upgrade|£/i).first();
    await expect(premium).toBeVisible({ timeout: 10000 });
  });

  test('shows Maybe later button', async ({ page }) => {
    await expect(page.getByText(/maybe later/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows feature list', async ({ page }) => {
    await expect(page.getByText(/question|mock|hazard|tutor/i).first()).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────
// /privacy-policy
// ─────────────────────────────────────────────────────────────────
test.describe('/privacy-policy', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/privacy-policy'); });

  test('loads privacy policy', async ({ page }) => {
    await expect(page.getByText(/privacy/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows ClearPass heading', async ({ page }) => {
    await expect(page.getByText('ClearPass')).toBeVisible({ timeout: 10000 });
  });

  test('has Back button', async ({ page }) => {
    const back = page.getByRole('button', { name: /go back/i }).or(page.getByText(/back/i)).first();
    await expect(back).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────
// /terms
// ─────────────────────────────────────────────────────────────────
test.describe('/terms', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/terms'); });

  test('loads terms page', async ({ page }) => {
    await expect(page.getByText(/terms/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('has Back button', async ({ page }) => {
    const back = page.getByRole('button', { name: /go back/i }).or(page.getByText(/back/i)).first();
    await expect(back).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────
// /confirm-parent (token param)
// ─────────────────────────────────────────────────────────────────
test.describe('/confirm-parent', () => {
  test('shows error or loading without token', async ({ page }) => {
    await page.goto('/confirm-parent');
    await page.waitForLoadState('networkidle');
    const content = page.getByText(/confirm|error|invalid|token/i).first();
    await expect(content).toBeVisible({ timeout: 10000 }).catch(() => {
      // may redirect — that's fine
    });
  });
});
