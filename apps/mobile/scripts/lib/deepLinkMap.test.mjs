// Run: node --experimental-strip-types --test scripts/lib/deepLinkMap.test.mjs
// M1 deep-link verification: every documented external link / deep link is
// classified by src/deepLinks.ts as expected and lands on an existing screen.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCUMENTED_DEEP_LINKS } from '../../src/nav/deepLinkMap.ts';
import { handleIncomingUrl, getDeepLinkPath } from '../../src/deepLinks.ts';
import { resolveRouteFile, routeLanding, MAPPED_ROUTES } from '../../src/nav/routeMap.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const appDir = path.join(root, 'app');

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

test('each documented link is classified as documented by src/deepLinks.ts', () => {
  for (const l of DOCUMENTED_DEEP_LINKS) {
    assert.equal(handleIncomingUrl(l.url).type, l.kind, l.url);
    assert.equal(getDeepLinkPath(l.url), l.linkPath, l.url);
  }
});

test('each link lands on an existing screen, outside the tab bar, the same with ui_v2 on and off', () => {
  for (const l of DOCUMENTED_DEEP_LINKS) {
    assert.ok(resolveRouteFile(l.lands, FILES), `${l.url} -> ${l.lands}`);
    for (const flag of [true, false]) {
      const landing = routeLanding(l.lands, FILES, flag);
      assert.equal(landing.redirectTo, null, l.url);
      // None of the external entry points sit under (tabs): the flag can't move them.
      assert.equal(landing.tab, null, `${l.url} (uiV2=${flag})`);
    }
    if (l.webPath) assert.ok(resolveRouteFile(l.webPath, FILES), `${l.url} web path ${l.webPath}`);
  }
});

test('the handler pushes the screens this table says (app/_layout.tsx dispatch)', () => {
  const src = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf8');
  assert.match(src, /link\.type === 'confirmParent'[\s\S]{0,120}pathname: '\/confirm-parent'/);
  assert.match(src, /link\.type === 'referral'[\s\S]{0,120}pathname: '\/auth\/signup'/);
  const byKind = Object.fromEntries(DOCUMENTED_DEEP_LINKS.map((l) => [l.kind, l.lands]));
  assert.equal(byKind.confirmParent, '/confirm-parent');
  assert.equal(byKind.referral, '/auth/signup');
  assert.equal(byKind.authCallback, '/auth/callback');
});

test('covers the scheme, universal/app links and server-sent URLs that app.json and proxy.js declare (read only)', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  const urls = DOCUMENTED_DEEP_LINKS.map((l) => l.url);
  assert.ok(urls.some((u) => u.startsWith(`${app.scheme}://`)), 'custom scheme');
  assert.ok(app.ios.associatedDomains.includes('applinks:getclearpass.co.uk'));
  const androidHttps = app.android.intentFilters.flatMap((f) => f.data ?? []).filter((d) => d.scheme === 'https');
  for (const d of androidHttps) {
    assert.ok(urls.some((u) => u.startsWith(`https://${d.host}${d.path ?? ''}`)), `android app link ${d.host}${d.path ?? ''}`);
  }
  const proxy = fs.readFileSync(path.join(root, 'server/proxy.js'), 'utf8');
  for (const m of proxy.matchAll(/'https:\/\/clearpass-app\.vercel\.app(\/[a-z-]+)/g)) {
    assert.ok(DOCUMENTED_DEEP_LINKS.some((l) => l.webPath && l.webPath.split('?')[0] === m[1]), `proxy.js ${m[1]}`);
  }
});

test('every link that only a phone can open says how to check it on a device', () => {
  for (const l of DOCUMENTED_DEEP_LINKS) {
    if (!l.webPath) assert.ok(l.deviceCheck && /adb|xcrun/.test(l.deviceCheck), l.url);
  }
});

test('web-checkable external entry points are also in MAPPED_ROUTES (visited by route coverage)', () => {
  const mapped = new Set(MAPPED_ROUTES.map((r) => r.path));
  for (const l of DOCUMENTED_DEEP_LINKS) {
    if (l.webPath) assert.ok(mapped.has(l.webPath.split('?')[0]), l.webPath);
  }
});
