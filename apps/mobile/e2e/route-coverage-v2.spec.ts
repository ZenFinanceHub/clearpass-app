import { test, expect, type BrowserContext } from '@playwright/test';
import { MAPPED_ROUTES, V2_TAB_ORDER } from '../src/nav/routeMap';

/**
 * P2-2 route coverage (ClearPass 2.0, ui_v2). Visits every route in
 * docs/clearpass-2.0/02-navigation-mapping.md (MAPPED_ROUTES) and checks it
 * renders or redirects, never hitting Expo Router's "Unmatched Route" page,
 * and that the five tabs work.
 *
 * SAFETY: runs ONLY against a localhost build (BASE_URL), and aborts every
 * request that isn't to localhost, so it can never touch production. Use a
 * local web export built with EXPO_PUBLIC_APP_ENV=local EXPO_PUBLIC_UI_V2=1
 * against the local Supabase stack (`npm run db:local:start` + seed in
 * apps/mobile/server). Set E2E_EMAIL / E2E_PASSWORD to a seeded learner to
 * cover the signed-in routes; without them those are skipped.
 *
 *   BASE_URL=http://127.0.0.1:8112 E2E_EMAIL=free-learner@example.invalid \
 *   E2E_PASSWORD=... npx playwright test e2e/route-coverage-v2.spec.ts --project=chromium
 */

const BASE = process.env.BASE_URL ?? '';
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(BASE);
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.skip(!isLocal, 'route-coverage-v2 runs only against a localhost BASE_URL (never production)');

async function localOnly(context: BrowserContext, blocked: string[]) {
  await context.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return route.continue();
    blocked.push(host);
    return route.abort();
  });
}

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/auth/signin');
  await page.getByTestId('email-input').fill(EMAIL!);
  await page.getByTestId('password-input').fill(PASSWORD!);
  await page.getByText('Sign In', { exact: true }).last().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth/signin'), { timeout: 20000 });
  await page.waitForTimeout(4000);
  // A fresh device queues the existing celebration modals: dismiss them.
  for (let i = 0; i < 10; i++) {
    const btn = page.getByText('Continue', { exact: true }).first();
    if (!(await btn.isVisible().catch(() => false))) break;
    await btn.click();
    await page.waitForTimeout(800);
  }
}

test.describe('every mapped route resolves (signed out)', () => {
  for (const r of MAPPED_ROUTES.filter((x) => x.expect === 'public')) {
    test(`${r.path}`, async ({ page, context }) => {
      const blocked: string[] = [];
      await localOnly(context, blocked);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(r.path);
      await page.waitForTimeout(1500);
      await expect(page.getByText('Unmatched Route')).toHaveCount(0);
      // Known, pre-existing: /taster logs a React #418 hydration warning in a
      // static web export with the flag OFF too (taster.tsx is untouched here).
      const known = r.path === '/taster' ? errors.filter((e) => !/Minified React error #418/.test(e)) : errors;
      expect(known).toEqual([]);
      expect(blocked).toEqual([]);
    });
  }
});

test.describe('signed-in routes and the five tabs', () => {
  test.skip(!EMAIL || !PASSWORD, 'set E2E_EMAIL and E2E_PASSWORD to a seeded local learner');

  test('every mapped route renders or redirects', async ({ page, context }) => {
    test.setTimeout(240_000);
    const blocked: string[] = [];
    await localOnly(context, blocked);
    await signIn(page);
    for (const r of MAPPED_ROUTES) {
      await page.goto(r.path);
      await page.waitForTimeout(1200);
      await expect(page.getByText('Unmatched Route'), r.path).toHaveCount(0);
    }
    expect(blocked).toEqual([]);
  });

  test('tab bar: five tabs, each selectable', async ({ page, context }) => {
    const blocked: string[] = [];
    await localOnly(context, blocked);
    await signIn(page);
    await page.goto('/home');
    const labels = { home: 'Home', learn: 'Learn', tests: 'Tests', progress: 'Progress', profile: 'Profile' } as const;
    for (const key of V2_TAB_ORDER) {
      await page.locator(`[role="tab"][aria-label="${labels[key]}"]`).first().click();
      await expect(page.locator(`[role="tab"][aria-label="${labels[key]}"][aria-selected="true"]`).first()).toBeVisible();
    }
    expect(blocked).toEqual([]);
  });
});
