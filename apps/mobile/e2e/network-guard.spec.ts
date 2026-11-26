import { test, expect, PRODUCTION_HOSTS, SUPABASE_HOST, RAILWAY_HOST } from './support';
import type { Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Proves the harness: every production host is intercepted inside the
// browser and never reaches the network. Hosts without a default stub are
// blocked and would fail the test; the stubbed backends (Supabase, Railway)
// are answered synthetically, and are blocked too once their stub is removed.

/** fetch() from inside the app page; resolves to the HTTP status or 'blocked'. */
async function browserFetch(page: Page, url: string, init?: RequestInit): Promise<number | 'blocked'> {
  return page.evaluate(
    async ({ url, init }) => {
      try {
        const res = await fetch(url, init);
        return res.status;
      } catch {
        return 'blocked' as const;
      }
    },
    { url, init },
  );
}

const STUBBED = new Set<string>([SUPABASE_HOST, RAILWAY_HOST]);

test.beforeEach(async ({ page }) => {
  await page.goto('/privacy-policy');
});

for (const host of PRODUCTION_HOSTS.filter((h) => !STUBBED.has(h))) {
  test(`blocks un-stubbed production host ${host} and flags it`, async ({ page, network }) => {
    const result = await browserFetch(page, `https://${host}/e2e-guard-probe`);
    expect(result).toBe('blocked');
    const flagged = network.acknowledgeUnexpected();
    expect(flagged.map((r) => r.host)).toContain(host);
  });
}

test('Supabase is answered by the synthetic stub, never the network', async ({ page, network }) => {
  const status = await browserFetch(page, `https://${SUPABASE_HOST}/rest/v1/profiles?select=*`);
  expect(status).toBe(200);
  expect(network.requestsTo(SUPABASE_HOST).every((r) => r.stub === 'supabase')).toBe(true);
});

test('Railway is answered by the synthetic stub, never the network', async ({ page, network }) => {
  const status = await browserFetch(page, `https://${RAILWAY_HOST}/api/explain`, { method: 'POST', body: '{}' });
  expect(status).toBe(200);
  expect(network.requestsTo(RAILWAY_HOST).every((r) => r.stub === 'railway')).toBe(true);
});

for (const [name, host] of [
  ['supabase', SUPABASE_HOST],
  ['railway', RAILWAY_HOST],
] as const) {
  test(`with the ${name} stub removed, ${host} is blocked and flagged`, async ({ page, network }) => {
    network.disableDefaultStub(name);
    expect(await browserFetch(page, `https://${host}/e2e-guard-probe`)).toBe('blocked');
    expect(network.acknowledgeUnexpected().map((r) => r.host)).toContain(host);
  });
}

test('navigating the page itself to production is blocked', async ({ page, network }) => {
  await page.goto('https://clearpass-app.vercel.app/').catch(() => {});
  expect(network.acknowledgeUnexpected().map((r) => r.host)).toContain('clearpass-app.vercel.app');
});

test('a WebSocket to an external host is blocked and flagged', async ({ page, network }) => {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const ws = new WebSocket('wss://getclearpass.co.uk/e2e-guard-probe');
        ws.onclose = () => resolve();
        ws.onerror = () => resolve();
        setTimeout(resolve, 3000);
      }),
  );
  expect(network.acknowledgeUnexpected().map((r) => r.host)).toContain('getclearpass.co.uk');
});

// A spec that imports `test` straight from @playwright/test would run with
// no harness at all. Only type imports are allowed from there.
test('every spec imports test from ./support', async () => {
  const dir = __dirname;
  const offenders = readdirSync(dir)
    .filter((f) => f.endsWith('.spec.ts'))
    .filter((f) => /^import\s+(?!type\b)[^;]*from\s+['"]@playwright\/test['"]/m.test(readFileSync(join(dir, f), 'utf8')));
  expect(offenders).toEqual([]);
});

// The teardown check itself: an unacknowledged blocked request must fail the
// test. test.fail() inverts the result, so this passes only if it fails.
test('an un-stubbed request fails the test at teardown', async ({ page }) => {
  test.fail(true, 'expected: the harness fails any test that made an un-stubbed request');
  await browserFetch(page, 'https://api.anthropic.com/v1/messages');
});
