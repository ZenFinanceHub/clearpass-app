import { test, expect, type Page } from '@playwright/test';
import { FLAG_OFF, isLocalBase, seed, stubBackend, dismissCelebrations } from './support/stubBackend';

/**
 * ClearPass 2.0 (ui_v2) M1: Profile subscription card, "Ask Pip about this"
 * on results, and the full scheduled-mock list on the Tests hub.
 *
 * STUBBED BACKEND, synthetic data only (e2e/support/stubBackend.ts): runs
 * ONLY against a localhost build (BASE_URL) and answers every non-local
 * request in the browser, so nothing leaves the machine. The tutor's
 * existing /api/explain call is answered with a canned synthetic reply.
 *
 *   BASE_URL=http://127.0.0.1:8131 npx playwright test e2e/m1-subscription-askpip-mocks-v2.spec.ts
 *
 * With E2E_UI_V2=0 against a flag-off export it checks the old screens are
 * unchanged instead.
 */

test.skip(!isLocalBase, 'runs only against a localhost BASE_URL (never production)');

const PRO_UNTIL = '2027-02-12T12:00:00.000Z';
const inDays = (d: number, h: number) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  x.setHours(h, 0, 0, 0);
  return x.toISOString();
};

async function answerAllWithA(page: Page, maxQuestions: number) {
  for (let i = 0; i < maxQuestions; i++) {
    await page.getByText('A', { exact: true }).first().click();
    const next = page.getByText(/^(Next Question ->|See Results)$/).first();
    await expect(next).toBeVisible();
    const done = (await next.textContent())?.includes('See Results');
    await next.click();
    if (done) return;
  }
}

/** Results screens queue the existing celebration modals a moment after they appear. */
async function settleCelebrations(page: Page) {
  await page.waitForTimeout(2500);
  await dismissCelebrations(page);
}

test.describe('ui_v2 on', () => {
  test.skip(FLAG_OFF, 'flag-off build');

  test('Profile: free plan shows Upgrade (existing paywall); no Restore on web', async ({ page, context }) => {
    const contacted: string[] = [];
    await stubBackend(context, contacted, { cloudProgress: { isPro: false } });
    await seed(page);
    await page.goto('/settings');
    await dismissCelebrations(page);
    const card = page.getByTestId('subscription-card');
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card.getByTestId('subscription-status')).toContainText('Free plan');
    await expect(card.getByTestId('subscription-restore')).toHaveCount(0);
    await expect(card.getByTestId('subscription-manage')).toHaveCount(0);
    await card.getByTestId('subscription-upgrade').click();
    await expect(page).toHaveURL(/\/paywall/);
  });

  test('Profile: a web (Stripe) one-off purchase shows what was bought, with no management link', async ({ page, context }) => {
    const contacted: string[] = [];
    await stubBackend(context, contacted, { cloudProgress: { isPro: true, proSource: 'stripe', proExpiresAt: PRO_UNTIL } });
    await seed(page);
    await page.goto('/settings');
    await dismissCelebrations(page);
    const card = page.getByTestId('subscription-card');
    await expect(card.getByTestId('subscription-status')).toContainText('ClearPass Pro', { timeout: 20000 });
    await expect(card.getByTestId('subscription-status')).toContainText('One-off card payment');
    await expect(card.getByTestId('subscription-status')).toContainText('Pro until 12 Feb 2027');
    await expect(card.getByTestId('subscription-info')).toContainText('doesn’t renew');
    await expect(card.getByTestId('subscription-manage')).toHaveCount(0);
    await expect(card.getByTestId('subscription-upgrade')).toHaveCount(0);
    await expect(card.locator('a[href]')).toHaveCount(0);
  });

  test('Profile: an app-store subscription seen on web says where to manage it (no link)', async ({ page, context }) => {
    const contacted: string[] = [];
    await stubBackend(context, contacted, { cloudProgress: { isPro: true, proSource: 'iap', proExpiresAt: PRO_UNTIL } });
    await seed(page);
    await page.goto('/settings');
    await dismissCelebrations(page);
    const card = page.getByTestId('subscription-card');
    await expect(card.getByTestId('subscription-info')).toContainText('App Store or Google Play', { timeout: 20000 });
    await expect(card.getByTestId('subscription-manage')).toHaveCount(0);
  });

  test('Tests hub: lists every upcoming scheduled mock, soonest first, and the test date', async ({ page, context }) => {
    const contacted: string[] = [];
    await stubBackend(context, contacted);
    const mocks = [
      { id: 'later', dateTimeIso: inDays(5, 9), label: 'Final check', notifId: null },
      { id: 'past', dateTimeIso: inDays(-2, 9), label: 'Old one', notifId: null },
      { id: 'soon', dateTimeIso: inDays(1, 18), label: 'Evening mock', notifId: null },
    ];
    await seed(page, {
      progress: { testDate: new Date(new Date().setHours(0, 0, 0, 0) + 20 * 86_400_000).toISOString() },
      extra: { '@clearpass/scheduled_mock_tests': JSON.stringify(mocks) },
    });
    await page.goto('/tests');
    await dismissCelebrations(page);
    const list = page.getByTestId('scheduled-mocks');
    await expect(list).toBeVisible({ timeout: 20000 });
    await expect(list.getByTestId('scheduled-mock-soon')).toContainText('Evening mock');
    await expect(list.getByTestId('scheduled-mock-soon')).toContainText('Tomorrow at 18:00');
    await expect(list.getByTestId('scheduled-mock-later')).toContainText('Final check');
    await expect(list.getByTestId('scheduled-mock-past')).toHaveCount(0);
    const ids = await list.locator('[data-testid^="scheduled-mock-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(ids.filter((x) => x !== 'scheduled-mock-empty' && x !== 'scheduled-mocks-empty')).toEqual(['scheduled-mock-soon', 'scheduled-mock-later']);
    await expect(list.getByTestId('scheduled-test-date')).toContainText('20 days to go');
    await list.getByTestId('scheduled-mock-soon').click();
    await expect(page).toHaveURL(/\/mock/);
  });

  test('Tests hub: empty state when nothing is scheduled', async ({ page, context }) => {
    const contacted: string[] = [];
    await stubBackend(context, contacted);
    await seed(page);
    await page.goto('/tests');
    await dismissCelebrations(page);
    await expect(page.getByTestId('scheduled-mocks-empty')).toContainText('No mock tests scheduled', { timeout: 20000 });
  });

  test('Practice results: "Ask Pip about this" on each incorrect question opens the tutor prefilled', async ({ page, context }) => {
    test.setTimeout(120_000);
    const contacted: string[] = [];
    const explain: unknown[] = [];
    await stubBackend(context, contacted, { cloudProgress: { isPro: true }, explainRequests: explain });
    await seed(page, { progress: { isPro: true } });
    await page.goto('/practice?topic=Alertness&t=1');
    await dismissCelebrations(page);
    await expect(page.getByText(/Question 1 of/).first()).toBeVisible({ timeout: 20000 });
    await answerAllWithA(page, 15);
    await expect(page.getByText('Question Breakdown')).toBeVisible({ timeout: 15000 });
    await settleCelebrations(page);
    const buttons = page.locator('[data-testid^="ask-pip-about-"]');
    // One button per incorrect question: total minus the "N / 10" score.
    const score = (await page.getByText(/^\d+ \/ \d+$/).first().textContent()) ?? '';
    const [right, total] = score.split(' / ').map(Number);
    expect(total - right).toBeGreaterThan(0);
    await expect(buttons).toHaveCount(total - right);
    await buttons.first().click();
    await expect(page).toHaveURL(/\/tutor/);
    await expect(page.getByText('Synthetic Pip reply.').first()).toBeVisible({ timeout: 15000 });
    // The existing tutor opening message, built from the question we tapped.
    const body = explain[0] as { messages?: Array<{ role: string; content: string }> };
    expect(body?.messages?.[0]?.content ?? '').toMatch(/^Can you explain this question: .+ - The correct answer is .+\. I answered .+\.$/);
  });

  test('Mock review: "Ask Pip about this" on incorrect questions opens the tutor prefilled', async ({ page, context }) => {
    test.setTimeout(120_000);
    const contacted: string[] = [];
    const explain: unknown[] = [];
    await stubBackend(context, contacted, { cloudProgress: { isPro: true }, explainRequests: explain });
    await seed(page, { progress: { isPro: true } });
    await page.goto('/mock');
    await dismissCelebrations(page);
    await page.getByText(/^Start (Free )?Quick Mock$/).first().click({ timeout: 20000 });
    // Leave everything unanswered: every question is then incorrect.
    for (let i = 0; i < 30; i++) {
      const submit = page.getByText('Submit Test', { exact: true });
      if (await submit.isVisible().catch(() => false)) break;
      await page.getByText('Next >', { exact: true }).click();
    }
    await page.getByText('Submit Test', { exact: true }).click();
    await expect(page.getByText('Review Answers', { exact: true }).first()).toBeVisible({ timeout: 20000 });
    await settleCelebrations(page);
    await page.getByText('Review Answers', { exact: true }).first().click();
    const buttons = page.locator('[data-testid^="ask-pip-about-"]');
    await expect(buttons).toHaveCount(25);
    await buttons.nth(2).click();
    await expect(page).toHaveURL(/\/tutor/);
    await expect(page.getByText('Synthetic Pip reply.').first()).toBeVisible({ timeout: 15000 });
    const body = explain[0] as { messages?: Array<{ role: string; content: string }> };
    expect(body?.messages?.[0]?.content ?? '').toMatch(/I answered No answer selected\.$/);
  });
});

test.describe('ui_v2 off (unchanged)', () => {
  test.skip(!FLAG_OFF, 'set E2E_UI_V2=0 against a flag-off export');

  test('Settings keeps the old subscription card; Tests hub redirects Home', async ({ page, context }) => {
    const contacted: string[] = [];
    await stubBackend(context, contacted, { cloudProgress: { isPro: true, proSource: 'stripe', proExpiresAt: PRO_UNTIL } });
    await seed(page);
    await page.goto('/settings');
    await dismissCelebrations(page);
    await expect(page.getByText('★ ClearPass Pro', { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Manage', { exact: true })).toBeVisible();
    await expect(page.getByTestId('subscription-card')).toHaveCount(0);
    await page.goto('/tests');
    await expect(page).toHaveURL(/\/home/, { timeout: 20000 });
    await expect(page.getByTestId('scheduled-mocks')).toHaveCount(0);
  });

  test('Mock review keeps the old per-question Ask Pip only (no "Ask Pip about this")', async ({ page, context }) => {
    test.setTimeout(120_000);
    const contacted: string[] = [];
    await stubBackend(context, contacted, { cloudProgress: { isPro: true } });
    await seed(page, { progress: { isPro: true } });
    await page.goto('/mock');
    await dismissCelebrations(page);
    await page.getByText(/^Start (Free )?Quick Mock$/).first().click({ timeout: 20000 });
    for (let i = 0; i < 30; i++) {
      const submit = page.getByText('Submit Test', { exact: true });
      if (await submit.isVisible().catch(() => false)) break;
      await page.getByText('Next >', { exact: true }).click();
    }
    await page.getByText('Submit Test', { exact: true }).click();
    await expect(page.getByText('Review Answers', { exact: true }).first()).toBeVisible({ timeout: 20000 });
    await settleCelebrations(page);
    await page.getByText('Review Answers', { exact: true }).first().click();
    await expect(page.getByText('Q1', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid^="ask-pip-about-"]')).toHaveCount(0);
    await expect(page.getByText('Ask Pip about this')).toHaveCount(0);
  });
});
