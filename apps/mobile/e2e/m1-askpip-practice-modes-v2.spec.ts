import { test, expect, type Page } from '@playwright/test';
import { FLAG_OFF, isLocalBase, seed, stubBackend, dismissCelebrations } from './support/stubBackend';

/**
 * ClearPass 2.0 (ui_v2): "Ask Pip about this" on the Speed Round, Weak Spots
 * and Battle Mode results screens (incorrect answers only). Sibling of
 * m1-subscription-askpip-mocks-v2.spec.ts, which covers practice results and
 * mock review.
 *
 * STUBBED BACKEND, synthetic data only (e2e/support/stubBackend.ts): runs
 * ONLY against a localhost build (BASE_URL) and answers every non-local
 * request in the browser, so nothing leaves the machine. The tutor's
 * existing /api/explain call is answered with a canned synthetic reply.
 *
 *   BASE_URL=http://127.0.0.1:8131 npx playwright test e2e/m1-askpip-practice-modes-v2.spec.ts
 *
 * With E2E_UI_V2=0 against a flag-off export it checks the results screens
 * are unchanged instead.
 */

test.skip(!isLocalBase, 'runs only against a localhost BASE_URL (never production)');

/** Real question ids whose correct answer is NOT option A, so tapping A is always wrong. */
const WEAK_IDS = ['AB2001', 'AB2003', 'AB2005', 'AB2007', 'AB2008'];
const WEAK_SEED = { '@clearpass/wrong_counts': JSON.stringify(Object.fromEntries(WEAK_IDS.map((id) => [id, 2]))) };

const OPENING = /^Can you explain this question: .+ - The correct answer is .+\. I answered .+\.$/;

async function openPractice(page: Page, extra: Record<string, string> = {}) {
  await seed(page, { progress: { isPro: true }, extra });
  await page.goto('/practice');
  await dismissCelebrations(page);
  await expect(page.getByText('Practice Mode', { exact: true })).toBeVisible({ timeout: 20000 });
}

/** Results screens queue the existing celebration modals a moment after they appear. */
async function settleCelebrations(page: Page) {
  await page.waitForTimeout(2500);
  await dismissCelebrations(page);
}

const tapA = (page: Page) => page.getByText('A', { exact: true }).first().click();

/** Plays a Speed Round tapping A each time; returns how many were wrong (from the "N / 10" score). */
async function playSpeedRound(page: Page): Promise<number> {
  await page.getByText('[>] Speed Round', { exact: true }).click();
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByText(`Q ${i} / 10`, { exact: true })).toBeVisible({ timeout: 10000 });
    await tapA(page);
  }
  await expect(page.getByText('Question Breakdown')).toBeVisible({ timeout: 15000 });
  await settleCelebrations(page);
  const score = (await page.getByText(/^\d+ \/ \d+$/).first().textContent()) ?? '';
  const [right, total] = score.split(' / ').map(Number);
  return total - right;
}

/** Plays Battle Mode tapping A each time; returns how many were wrong (the score only rises on a correct answer). */
async function playBattle(page: Page): Promise<number> {
  await page.getByText('[x] Battle Mode', { exact: true }).click();
  const counter = page.getByText(/^Q \d+ \/ \d+$/).first();
  await expect(counter).toBeVisible({ timeout: 20000 });
  const total = Number(((await counter.textContent()) ?? '').split(' / ')[1]);
  expect(total).toBeGreaterThan(0);
  const scoreEl = page.getByText('SCORE', { exact: true }).locator('xpath=preceding-sibling::*[1]');
  let wrong = 0;
  for (let i = 1; i <= total; i++) {
    await expect(page.getByText(`Q ${i} / ${total}`, { exact: true })).toBeVisible({ timeout: 10000 });
    const before = Number(await scoreEl.textContent());
    await tapA(page);
    await expect(page.getByText('Next question in 1s...')).toBeVisible();
    if (Number(await scoreEl.textContent()) === before) wrong++;
  }
  await expect(page.getByText('Max Combo', { exact: true })).toBeVisible({ timeout: 15000 });
  await settleCelebrations(page);
  return wrong;
}

/** Drills Weak Spots: taps A (always wrong for WEAK_IDS) on `n` questions, then Finish. */
async function playWeakSpots(page: Page, n: number) {
  await page.getByText(`[!] Weak Spots (${WEAK_IDS.length})`, { exact: true }).click();
  const wrongNote = page.getByText('Incorrect - keep going!');
  for (let i = 0; i < n; i++) {
    await expect(page.getByText('WEAK SPOTS', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(wrongNote).toHaveCount(0);
    await tapA(page);
    await expect(wrongNote).toBeVisible();
  }
  await expect(wrongNote).toHaveCount(0, { timeout: 5000 });
  await page.getByText('Finish', { exact: true }).click();
  await expect(page.getByText('WEAK SPOTS DRILL', { exact: true })).toBeVisible({ timeout: 15000 });
  await settleCelebrations(page);
}

async function expectTutorOpened(page: Page, explain: unknown[]) {
  await expect(page).toHaveURL(/\/tutor/);
  await expect(page.getByText('Synthetic Pip reply.').first()).toBeVisible({ timeout: 15000 });
  const body = explain[0] as { messages?: Array<{ role: string; content: string }> };
  return body?.messages?.[0]?.content ?? '';
}

test.describe('ui_v2 on', () => {
  test.skip(FLAG_OFF, 'flag-off build');

  test('Speed Round results: "Ask Pip about this" on each incorrect question opens the tutor prefilled', async ({ page, context }) => {
    test.setTimeout(120_000);
    const contacted: string[] = [];
    const explain: unknown[] = [];
    await stubBackend(context, contacted, { cloudProgress: { isPro: true }, explainRequests: explain });
    await openPractice(page);
    const wrong = await playSpeedRound(page);
    expect(wrong).toBeGreaterThan(0);
    const buttons = page.locator('[data-testid^="ask-pip-about-"]');
    await expect(buttons).toHaveCount(wrong);
    await expect(buttons.first()).toContainText('Ask Pip about this');
    await buttons.first().click();
    expect(await expectTutorOpened(page, explain)).toMatch(OPENING);
  });

  test('Weak Spots results: lists each question missed in the drill, once, and Ask Pip opens the tutor', async ({ page, context }) => {
    test.setTimeout(120_000);
    const contacted: string[] = [];
    const explain: unknown[] = [];
    await stubBackend(context, contacted, { cloudProgress: { isPro: true }, explainRequests: explain });
    await openPractice(page, WEAK_SEED);
    await playWeakSpots(page, 3);
    await expect(page.getByTestId('ask-pip-review')).toContainText('Questions to review');
    const buttons = page.locator('[data-testid^="ask-pip-about-"]');
    await expect(buttons).toHaveCount(3);
    const ids = await buttons.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')!.replace('ask-pip-about-', '')));
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(WEAK_IDS).toContain(id);
    await buttons.first().click();
    const opening = await expectTutorOpened(page, explain);
    expect(opening).toMatch(OPENING);
    expect(opening).not.toMatch(/I answered No answer selected\.$/);
  });

  test('Battle Mode results: "Ask Pip about this" for each incorrect answer opens the tutor prefilled', async ({ page, context }) => {
    test.setTimeout(150_000);
    const contacted: string[] = [];
    const explain: unknown[] = [];
    await stubBackend(context, contacted, { cloudProgress: { isPro: true }, explainRequests: explain });
    await openPractice(page);
    const wrong = await playBattle(page);
    expect(wrong).toBeGreaterThan(0);
    await expect(page.getByTestId('ask-pip-review')).toContainText('Questions to review');
    const buttons = page.locator('[data-testid^="ask-pip-about-"]');
    await expect(buttons).toHaveCount(wrong);
    await buttons.last().click();
    expect(await expectTutorOpened(page, explain)).toMatch(OPENING);
  });
});

test.describe('ui_v2 off (unchanged)', () => {
  test.skip(!FLAG_OFF, 'set E2E_UI_V2=0 against a flag-off export');

  async function expectNoAskPip(page: Page) {
    await expect(page.locator('[data-testid^="ask-pip-about-"]')).toHaveCount(0);
    await expect(page.getByTestId('ask-pip-review')).toHaveCount(0);
    await expect(page.getByText('Questions to review')).toHaveCount(0);
    await expect(page.getByText('Ask Pip about this')).toHaveCount(0);
  }

  test('Speed Round results: no "Ask Pip about this"', async ({ page, context }) => {
    test.setTimeout(120_000);
    await stubBackend(context, [], { cloudProgress: { isPro: true } });
    await openPractice(page);
    expect(await playSpeedRound(page)).toBeGreaterThan(0);
    await expect(page.getByText('Play Again', { exact: true })).toBeVisible();
    await expectNoAskPip(page);
  });

  test('Weak Spots results: no review list', async ({ page, context }) => {
    test.setTimeout(120_000);
    await stubBackend(context, [], { cloudProgress: { isPro: true } });
    await openPractice(page, WEAK_SEED);
    await playWeakSpots(page, 3);
    await expect(page.getByText('Drill Again', { exact: true })).toBeVisible();
    await expectNoAskPip(page);
  });

  test('Battle Mode results: no review list', async ({ page, context }) => {
    test.setTimeout(150_000);
    await stubBackend(context, [], { cloudProgress: { isPro: true } });
    await openPractice(page);
    expect(await playBattle(page)).toBeGreaterThan(0);
    await expect(page.getByText('Play Again', { exact: true })).toBeVisible();
    await expectNoAskPip(page);
  });
});
