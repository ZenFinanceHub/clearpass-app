import { test, expect, seedLearner, signInAs, json, RAILWAY_HOST } from './support';

// Ask Pip end to end against the stubbed Railway /api/explain.
test.describe('Ask Pip (stubbed)', () => {
  test.beforeEach(async ({ page, network }) => {
    await seedLearner(page);
    await signInAs(page, network);
  });

  test('sends a question and shows the synthetic reply', async ({ page, network }) => {
    network.pipReply = 'Synthetic Pip says: check your mirrors.';
    await page.goto('/(tabs)/tutor');
    // Starter prompts send straight away (the input is multiline, so Enter adds a newline).
    await page.getByText('How does hazard perception work?').click();
    await expect(page.getByText('Synthetic Pip says: check your mirrors.')).toBeVisible({ timeout: 10000 });

    const calls = network.requestsTo(RAILWAY_HOST).filter((r) => r.url.endsWith('/api/explain'));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((r) => r.stub === 'railway')).toBe(true);
  });

  test('a per-test stub override can simulate the daily limit (429)', async ({ page, network }) => {
    network.stub({
      name: 'explain-429',
      match: (url) => url.hostname === RAILWAY_HOST && url.pathname === '/api/explain',
      handle: (route) => json(route, 429, { isPro: false }),
    });
    await page.goto('/(tabs)/tutor');
    await page.getByText('How does hazard perception work?').click();
    await expect.poll(() => network.requestsTo(RAILWAY_HOST).some((r) => r.stub === 'explain-429')).toBe(true);
    await expect(page.getByText(/synthetic ask pip reply/i)).toHaveCount(0);
  });
});
