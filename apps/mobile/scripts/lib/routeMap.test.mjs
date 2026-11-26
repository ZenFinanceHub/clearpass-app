// Run: node --experimental-strip-types --test scripts/lib/routeMap.test.mjs
// Optional: MAPPING_DOC=/path/to/02-navigation-mapping.md also checks the doc's routes are all covered.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  V2_TAB_ORDER, TAB_ROUTE, ROUTE_TAB, V2_HEADER_TITLE, tabForRoute, withTapNonce,
  LEARN_HUB, TESTS_HUB, PROGRESS_LINKS, MAPPED_ROUTES, resolveRouteFile, DOC_PATHS_NOT_APP_ROUTES,
} from '../../src/nav/routeMap.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '../../app');

/** Route files under app/, relative, without extension (layouts excluded). */
function routeFiles() {
  const out = new Set();
  const walk = (dir) => {
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
const tabsFiles = [...FILES].filter((f) => f.startsWith('(tabs)/')).map((f) => f.slice('(tabs)/'.length));

test('five tabs in order, each opening a (tabs) route that belongs to it', () => {
  assert.deepEqual([...V2_TAB_ORDER], ['home', 'learn', 'tests', 'progress', 'profile']);
  for (const tab of V2_TAB_ORDER) {
    const route = TAB_ROUTE[tab];
    assert.ok(FILES.has(`(tabs)/${route}`), `${tab} -> (tabs)/${route} exists`);
    assert.equal(ROUTE_TAB[route], tab);
  }
  assert.equal(TAB_ROUTE.profile, 'settings'); // Profile keeps the settings file
});

test('every (tabs) route file is declared (none auto-added as a stray tab) and has a header rule', () => {
  assert.deepEqual([...tabsFiles].sort(), Object.keys(ROUTE_TAB).sort());
  for (const name of tabsFiles) assert.ok(name in V2_HEADER_TITLE, name);
});

test('tab highlight: each screen lights up the tab it lives under', () => {
  const cases = {
    home: 'home', learn: 'learn', practice: 'learn', roadsigns: 'learn', highwaycode: 'learn', tutor: 'learn',
    tests: 'tests', mock: 'tests', hazard: 'tests', progress: 'progress', leaderboard: 'progress', settings: 'profile',
  };
  for (const [route, tab] of Object.entries(cases)) assert.equal(tabForRoute(route), tab, route);
  assert.equal(tabForRoute(undefined), 'home');
  assert.equal(tabForRoute('nope'), 'home');
});

test('every route in the navigation mapping resolves to a route file', () => {
  const missing = MAPPED_ROUTES.filter((r) => !resolveRouteFile(r.path, FILES)).map((r) => r.path);
  assert.deepEqual(missing, []);
  // Explicit (tabs) paths resolve to the (tabs) file, aliases to their own file.
  assert.equal(resolveRouteFile('/(tabs)/progress', FILES), '(tabs)/progress');
  assert.equal(resolveRouteFile('/progress', FILES), 'progress');
  assert.equal(resolveRouteFile('/aitutor', FILES), 'aitutor');
  assert.equal(resolveRouteFile('/', FILES), 'index');
  assert.equal(resolveRouteFile('/does-not-exist', FILES), null);
});

test('the external entry points are all covered', () => {
  const paths = new Set(MAPPED_ROUTES.map((r) => r.path));
  for (const p of ['/paywall', '/payment-success', '/confirm-parent', '/connect-return', '/connect-refresh', '/privacy-policy', '/terms', '/contact', '/auth/callback']) {
    assert.ok(paths.has(p), p);
  }
});

test('every hub entry opens an existing screen', () => {
  for (const e of [...LEARN_HUB, ...TESTS_HUB, ...PROGRESS_LINKS]) {
    assert.ok(resolveRouteFile(e.route, FILES), `${e.id}: ${e.route}`);
  }
});

test('discoverability: Battle, Challenge, the AI study plan, Bookmarks and Ask Pip are in the Learn hub', () => {
  const routes = LEARN_HUB.map((e) => e.route);
  assert.ok(routes.includes('/(tabs)/practice?launch=battle'));
  assert.ok(routes.includes('/challenge'));
  assert.ok(routes.includes('/studyplan'));
  assert.ok(routes.includes('/(tabs)/practice?mode=bookmarked'));
  assert.ok(routes.includes('/(tabs)/tutor'));
  assert.ok(routes.includes('/study-plan'));
  // Spec §6.2 contents that exist as screens today.
  for (const id of ['practice', 'road-signs', 'highway-code', 'speed-round', 'weak-spots', 'ask-pip']) {
    assert.ok(LEARN_HUB.some((e) => e.id === id), id);
  }
  assert.ok(PROGRESS_LINKS.some((e) => e.route === '/(tabs)/leaderboard'));
});

test('Tests hub shows the real mock formats (drift guard against mock.tsx)', () => {
  const src = fs.readFileSync(path.join(appDir, '(tabs)/mock.tsx'), 'utf8');
  const num = (name) => Number(src.match(new RegExp(`const ${name} = (\\d+)`))[1]);
  const full = TESTS_HUB.find((e) => e.id === 'full-mock').subtitle;
  const quick = TESTS_HUB.find((e) => e.id === 'quick-mock').subtitle;
  assert.equal(full, `${num('TOTAL_QUESTIONS')} questions · ${num('TIME_LIMIT_SECONDS')} minutes · pass mark ${num('PASS_MARK')}`);
  assert.equal(quick, `${num('QUICK_QUESTIONS')} questions · ${num('QUICK_TIME_SECONDS')} minutes · pass mark ${num('QUICK_PASS_MARK')}`);
  assert.equal(quick, '25 questions · 28 minutes · pass mark 22');
  assert.ok(TESTS_HUB.find((e) => e.id === 'hazard').nativeOnly);
});

test('tap nonce only for per-tap launch routes', () => {
  assert.equal(withTapNonce('/(tabs)/practice?launch=battle', 5), '/(tabs)/practice?launch=battle&t=5');
  assert.equal(withTapNonce('/(tabs)/practice?topic=Alertness', 5), '/(tabs)/practice?topic=Alertness&t=5');
  assert.equal(withTapNonce('/(tabs)/practice?mode=bookmarked', 5), '/(tabs)/practice?mode=bookmarked');
  assert.equal(withTapNonce('/challenge', 5), '/challenge');
});

test('mapping doc coverage (when MAPPING_DOC is set)', { skip: !process.env.MAPPING_DOC }, () => {
  const doc = fs.readFileSync(process.env.MAPPING_DOC, 'utf8');
  const covered = new Set(MAPPED_ROUTES.map((r) => r.path.split('?')[0]));
  const inDoc = new Set();
  for (const m of doc.matchAll(/`(\/[^`\s]*)`/g)) {
    const p = m[1];
    // Patterns and placeholders, not concrete routes.
    if (p.includes('*') || p.includes('...') || p.startsWith('//')) continue;
    inDoc.add(p.split('?')[0]);
  }
  const missing = [...inDoc].filter((p) => !covered.has(p) && !(p in DOC_PATHS_NOT_APP_ROUTES));
  assert.deepEqual(missing, [], `doc routes not in MAPPED_ROUTES: ${missing.join(', ')}`);
});
