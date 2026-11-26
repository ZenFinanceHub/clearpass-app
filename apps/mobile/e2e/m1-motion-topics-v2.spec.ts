import { test, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * ClearPass 2.0 (ui_v2) M1: in-app Reduce Motion toggle and Topic revision.
 *
 * STUBBED BACKEND, synthetic data only. Runs ONLY against a localhost build
 * (BASE_URL) made with EXPO_PUBLIC_APP_ENV=local EXPO_PUBLIC_UI_V2=1. Every
 * request that isn't to localhost is answered by a stub in the browser
 * (route.fulfill) and never leaves the machine. A fake, synthetic session and
 * synthetic local progress are written to localStorage before the app loads.
 *
 *   BASE_URL=http://127.0.0.1:8113 npx playwright test e2e/m1-motion-topics-v2.spec.ts --project=chromium
 *
 * With E2E_UI_V2=0 against a flag-off local export, it checks instead that
 * neither feature appears (the flag-off screens are unchanged).
 */

const BASE = process.env.BASE_URL ?? '';
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(BASE);
test.skip(!isLocal, 'runs only against a localhost BASE_URL (never production)');
const FLAG_OFF = process.env.E2E_UI_V2 === '0';

const USER = {
  id: '00000000-0000-4000-8000-000000000e2e',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'synthetic-learner@example.invalid',
  app_metadata: { provider: 'email' },
  user_metadata: { username: 'Synthetic' },
  created_at: '2026-01-01T00:00:00Z',
};

const PROGRESS = {
  // Under the 30-question mock-ready mark, so Home recommends the weakest topic.
  totalQuestionsAnswered: 25,
  totalCorrect: 18,
  studyStreakDays: 0,
  lastStudyDate: null,
  topicScores: { Alertness: 85, Attitude: 78, MotorwayRules: 41, VehicleLoading: 60 },
  mockTestHistory: [],
  hazardPerceptionHistory: [],
};

async function stubBackend(context: BrowserContext, contacted: string[]) {
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
    contacted.push(url.hostname); // answered locally below; nothing is sent
    if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: USER });
    if (url.pathname.startsWith('/rest/v1/')) {
      const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      if (url.pathname.startsWith('/rest/v1/profiles')) {
        const row = { id: USER.id, account_type: 'learner', username: 'Synthetic' };
        return route.fulfill({ json: wantsObject ? row : [row] });
      }
      if (wantsObject) return route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'no rows' } });
      return route.fulfill({ json: [] });
    }
    return route.fulfill({ json: {} });
  });
}

async function seed(page: Page, extra: Record<string, string> = {}) {
  const session = {
    access_token: 'synthetic-access-token',
    refresh_token: 'synthetic-refresh-token',
    token_type: 'bearer',
    expires_in: 3600 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
    user: USER,
  };
  await page.addInitScript(([s, p, x]) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.setItem('sb-secavejbaapapvvqbwed-auth-token', s);
    localStorage.setItem('@clearpass/hasSeenOnboarding', 'true');
    localStorage.setItem('@clearpass/user_progress', p);
    for (const [k, v] of Object.entries(JSON.parse(x) as Record<string, string>)) localStorage.setItem(k, v);
  }, [JSON.stringify(session), JSON.stringify(PROGRESS), JSON.stringify(extra)] as const);
}

/** The switch in the Reduce Motion row (the innermost element holding both). */
function reduceMotionSwitch(page: Page) {
  return page.locator('div')
    .filter({ has: page.getByText('Reduce Motion', { exact: true }) })
    .filter({ has: page.getByRole('switch') })
    .last()
    .getByRole('switch');
}

async function dismissCelebrations(page: Page) {
  for (let i = 0; i < 10; i++) {
    const btn = page.getByText('Continue', { exact: true }).first();
    if (!(await btn.isVisible().catch(() => false))) break;
    await btn.click();
    await page.waitForTimeout(500);
  }
}

test.describe('ui_v2 on', () => {
  test.skip(FLAG_OFF, 'flag-off build');

  test('Learn: Topic revision opens a picker; a topic starts the existing topic practice', async ({ page, context }) => {
    const contacted: string[] = [];
    await stubBackend(context, contacted);
    await seed(page);
    await page.goto('/learn');
    await dismissCelebrations(page);
    const entry = page.getByTestId('hub-topic-revision');
    await expect(entry).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('topic-picker')).toHaveCount(0);
    await entry.click();
    const picker = page.getByTestId('topic-picker');
    await expect(picker).toBeVisible();
    await expect(picker.getByTestId('topic-pick-MotorwayRules')).toContainText('Weakest');
    await expect(picker.getByTestId('topic-pick-MotorwayRules')).toContainText('41%');
    await expect(picker.getByTestId('topic-pick-HazardAwareness')).toContainText('Not started');
    await picker.getByTestId('topic-pick-HazardAwareness').click();
    await expect(page).toHaveURL(/\/practice/);
    // The existing topic launcher started a session (it leaves the start screen).
    await expect(page.getByText(/Question 1 of|1\s*\/\s*\d+/).first()).toBeVisible({ timeout: 15000 });
  });

  test('Home: weak-topic coach card links to the topic picker', async ({ page, context }) => {
    const contacted: string[] = [];
    await stubBackend(context, contacted);
    await seed(page);
    await page.goto('/home');
    await dismissCelebrations(page);
    const link = page.getByTestId('coach-choose-topic');
    await expect(link).toBeVisible({ timeout: 20000 });
    // Home queues the existing celebration modals for this synthetic progress.
    await page.waitForTimeout(2500);
    await dismissCelebrations(page);
    await link.click();
    await expect(page).toHaveURL(/\/learn/);
    await expect(page.getByTestId('topic-picker')).toBeVisible();
  });

  const storedRm = (page: Page) =>
    page.evaluate(() => JSON.parse(localStorage.getItem('accessibility_settings') ?? '{}').reduceMotion);

  test('Profile: Reduce Motion is off by default, can be turned on, and is saved locally', async ({ page, context }) => {
    const contacted: string[] = [];
    await stubBackend(context, contacted);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await seed(page);
    await page.goto('/settings');
    await dismissCelebrations(page);
    await expect(page.getByText('Reduce Motion', { exact: true })).toBeVisible({ timeout: 20000 });
    const sw = reduceMotionSwitch(page);
    // OS off + nothing stored: off, and the learner can change it.
    await expect(sw).not.toBeChecked();
    await expect(sw).toBeEnabled();
    expect(await storedRm(page)).toBeUndefined();
    await sw.click();
    await expect(sw).toBeChecked();
    expect(await storedRm(page)).toBe(true);
    // Persisted: survives a reload.
    await page.reload();
    await expect(page.getByText('Reduce Motion', { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(reduceMotionSwitch(page)).toBeChecked();
  });

  test('Profile: with the OS setting on, Reduce Motion is on and locked, even if turned off in the app', async ({ page, context }) => {
    const contacted: string[] = [];
    await stubBackend(context, contacted);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // The learner had turned it off in ClearPass: the OS setting still wins.
    await seed(page, { accessibility_settings: JSON.stringify({ reduceMotion: false }) });
    await page.goto('/settings');
    await dismissCelebrations(page);
    await expect(page.getByText('Reduce Motion', { exact: true })).toBeVisible({ timeout: 20000 });
    const sw = reduceMotionSwitch(page);
    await expect(sw).toBeChecked();
    await expect(sw).toBeDisabled();
    await expect(page.getByText("On because your device's Reduce Motion setting is on", { exact: true })).toBeVisible();
    await sw.click({ force: true });
    await expect(sw).toBeChecked();
    expect(await storedRm(page)).toBe(false);
  });
});

test.describe('ui_v2 off (unchanged)', () => {
  test.skip(!FLAG_OFF, 'set E2E_UI_V2=0 against a flag-off export');

  test('no Reduce Motion row in Settings, no Topic revision in the Study hub', async ({ page, context }) => {
    const contacted: string[] = [];
    await stubBackend(context, contacted);
    await seed(page);
    await page.goto('/settings');
    await dismissCelebrations(page);
    await expect(page.getByText('Cream Background', { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Reduce Motion', { exact: true })).toHaveCount(0);
    await page.goto('/learn');
    await page.waitForTimeout(2500);
    await expect(page.getByTestId('learn-hub')).toHaveCount(0);
    await expect(page.getByText('Topic revision', { exact: true })).toHaveCount(0);
  });
});
