import type { BrowserContext, Page } from '@playwright/test';

/**
 * Shared harness for the ClearPass 2.0 e2e specs: a STUBBED backend and a
 * synthetic signed-in learner. Nothing here ever reaches the network:
 *
 *  - Specs run only against a localhost BASE_URL (isLocalBase).
 *  - stubBackend() answers EVERY non-local request inside the browser with
 *    route.fulfill(); the request is never sent. Each answered host is
 *    recorded in `contacted` so a spec can see what the app tried to reach.
 *  - seed() writes a synthetic session and synthetic local progress into
 *    localStorage before the app loads. All data is made up.
 */

export const BASE = process.env.BASE_URL ?? '';
export const isLocalBase = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(BASE);
export const FLAG_OFF = process.env.E2E_UI_V2 === '0';

export const USER = {
  id: '00000000-0000-4000-8000-000000000e2e',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'synthetic-learner@example.invalid',
  app_metadata: { provider: 'email' },
  user_metadata: { username: 'Synthetic' },
  created_at: '2026-01-01T00:00:00Z',
};

export const PROGRESS = {
  totalQuestionsAnswered: 25,
  totalCorrect: 18,
  studyStreakDays: 0,
  lastStudyDate: null,
  topicScores: { Alertness: 85, Attitude: 78, MotorwayRules: 41, VehicleLoading: 60 },
  mockTestHistory: [],
  hazardPerceptionHistory: [],
};

export interface StubOptions {
  /** Fields merged into the user_progress.progress row the app reads (e.g. entitlement). */
  cloudProgress?: Record<string, unknown> | null;
  /** Records each /api/explain request body (the existing tutor endpoint). */
  explainRequests?: unknown[];
}

export async function stubBackend(context: BrowserContext, contacted: string[], opts: StubOptions = {}) {
  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
    contacted.push(url.hostname); // answered locally below; nothing is sent
    if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ json: USER });
    if (url.pathname.startsWith('/api/explain')) {
      opts.explainRequests?.push(req.postDataJSON());
      return route.fulfill({ json: { content: [{ type: 'text', text: 'Synthetic Pip reply.' }] } });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
      if (url.pathname.startsWith('/rest/v1/profiles')) {
        const row = { id: USER.id, account_type: 'learner', username: 'Synthetic' };
        return route.fulfill({ json: wantsObject ? row : [row] });
      }
      if (url.pathname.startsWith('/rest/v1/user_progress') && req.method() === 'GET' && opts.cloudProgress) {
        const row = { id: USER.id, progress: { ...PROGRESS, ...opts.cloudProgress } };
        return route.fulfill({ json: wantsObject ? row : [row] });
      }
      if (wantsObject) return route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'no rows' } });
      return route.fulfill({ json: [] });
    }
    return route.fulfill({ json: {} });
  });
}

export async function seed(page: Page, opts: { progress?: Record<string, unknown>; extra?: Record<string, string> } = {}) {
  const session = {
    access_token: 'synthetic-access-token',
    refresh_token: 'synthetic-refresh-token',
    token_type: 'bearer',
    expires_in: 3600 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
    user: USER,
  };
  const progress = { ...PROGRESS, ...(opts.progress ?? {}) };
  await page.addInitScript(([s, p, x]) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.setItem('sb-secavejbaapapvvqbwed-auth-token', s);
    localStorage.setItem('@clearpass/hasSeenOnboarding', 'true');
    localStorage.setItem('@clearpass/user_progress', p);
    for (const [k, v] of Object.entries(JSON.parse(x) as Record<string, string>)) localStorage.setItem(k, v);
  }, [JSON.stringify(session), JSON.stringify(progress), JSON.stringify(opts.extra ?? {})] as const);
}

/** A fresh device queues the existing celebration modals: dismiss them. */
export async function dismissCelebrations(page: Page) {
  for (let i = 0; i < 10; i++) {
    const btn = page.getByText('Continue', { exact: true }).first();
    if (!(await btn.isVisible().catch(() => false))) break;
    await btn.click();
    await page.waitForTimeout(500);
  }
}
