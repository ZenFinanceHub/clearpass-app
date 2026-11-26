import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { MAPPED_ROUTES, routeLanding } from '../src/nav/routeMap';
import { DOCUMENTED_DEEP_LINKS } from '../src/nav/deepLinkMap';
import { FLAG_OFF, isLocalBase, seed, stubBackend, dismissCelebrations } from './support/stubBackend';

/**
 * M1 deep-link verification on a web export. Every route in
 * docs/clearpass-2.0/02-navigation-mapping.md (MAPPED_ROUTES) and every
 * web-openable documented deep link (DOCUMENTED_DEEP_LINKS) is opened as a
 * signed-in synthetic learner, and must land on the screen and tab that
 * routeLanding() predicts (the same function the unit test checks against
 * the route files). Run once against a ui_v2 export and once (E2E_UI_V2=0)
 * against a flag-off export.
 *
 * STUBBED BACKEND, synthetic data only (e2e/support/stubBackend.ts): every
 * non-local request is answered in the browser and never sent.
 *
 *   BASE_URL=http://127.0.0.1:8131 npx playwright test e2e/deep-links-v2.spec.ts
 *   E2E_UI_V2=0 BASE_URL=http://127.0.0.1:8132 npx playwright test e2e/deep-links-v2.spec.ts
 *
 * Links only a phone can open (clearpass://, universal / App Links) carry
 * their adb / xcrun command in src/nav/deepLinkMap.ts.
 */

test.skip(!isLocalBase, 'runs only against a localhost BASE_URL (never production)');

const UI_V2 = !FLAG_OFF;
const appDir = path.resolve(__dirname, '../app');
function routeFiles(): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name) && !e.name.startsWith('_layout') && !e.name.startsWith('+')) {
        out.add(path.relative(appDir, full).replace(/\.tsx?$/, '').split(path.sep).join('/'));
      }
    }
  };
  walk(appDir);
  return out;
}
const FILES = routeFiles();

/** Tab-bar labels (aria-label of each [role=tab]) in each navigator. */
const TAB_LABEL: Record<string, string> = UI_V2
  ? { home: 'Home', learn: 'Learn', tests: 'Tests', progress: 'Progress', profile: 'Profile' }
  : { home: 'Home', practice: 'Practice', mock: 'Mock Test', hazard: 'Hazard', settings: 'Settings' };

test.describe(`every mapped route lands on its screen and tab (ui_v2 ${UI_V2 ? 'on' : 'off'})`, () => {
  for (const r of MAPPED_ROUTES) {
    test(r.path, async ({ page, context }) => {
      // Known, pre-existing (on main too): /aitutor redirects to / on web.
      // Tracked as F5 in docs/clearpass-2.0/04-craig-actions.md. Expected to
      // fail until fixed; Playwright flags it the moment it starts passing.
      test.fail(r.path === '/aitutor', 'F5: /aitutor redirects to / on web');
      const landing = routeLanding(r.path, FILES, UI_V2);
      expect(landing, `${r.path} resolves to a route file`).not.toBeNull();
      const contacted: string[] = [];
      await stubBackend(context, contacted);
      await seed(page);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(r.path);
      await page.waitForTimeout(1500);
      await dismissCelebrations(page);
      await expect(page.getByText('Unmatched Route')).toHaveCount(0);

      if (landing!.file.startsWith('(tabs)/')) {
        const expectedPath = landing!.redirectTo ?? `/${landing!.file.slice('(tabs)/'.length)}`;
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 10000 }).toBe(expectedPath);
        if (landing!.tab) {
          await expect(page.locator('[role="tab"][aria-selected="true"]:visible').filter({ hasText: TAB_LABEL[landing!.tab] })).toHaveCount(1);
          await expect(page.locator('[role="tab"][aria-selected="true"]:visible')).toHaveCount(1);
        } else {
          // A hidden (flag-off) tab: the bar shows, nothing is highlighted.
          await expect(page.locator('[role="tab"]:visible').first()).toBeVisible();
          await expect(page.locator('[role="tab"][aria-selected="true"]:visible')).toHaveCount(0);
        }
      } else if (r.note === 'alias') {
        // Top-level aliases render their screen as a stack page, outside the tab bar.
        await expect.poll(() => new URL(page.url()).pathname).toBe(r.path);
        await expect(page.locator('[role="tab"]:visible')).toHaveCount(0);
      }
      // React #418 (hydration text mismatch) is expected here and pre-existing
      // with the flag on AND off: the static export pre-renders each page
      // signed out, and this spec loads it with a signed-in session already
      // in localStorage. Any other page error fails the test.
      expect(errors.filter((e) => !/Minified React error #418/.test(e))).toEqual([]);
    });
  }
});

test.describe(`documented deep links open on web (ui_v2 ${UI_V2 ? 'on' : 'off'})`, () => {
  for (const l of DOCUMENTED_DEEP_LINKS.filter((x) => x.webPath)) {
    test(l.url, async ({ page, context }) => {
      const contacted: string[] = [];
      await stubBackend(context, contacted);
      await seed(page);
      await page.goto(l.webPath!);
      await page.waitForTimeout(1500);
      await expect(page.getByText('Unmatched Route')).toHaveCount(0);
      const landing = routeLanding(l.lands, FILES, UI_V2);
      expect(landing?.tab).toBeNull();
      // The screen it names, unless that screen itself sends a signed-in
      // learner on (index -> /home; auth/callback finishes sign-in).
      if (l.lands !== '/' && l.lands !== '/auth/callback') {
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 10000 }).toBe(l.lands);
      }
    });
  }
});
