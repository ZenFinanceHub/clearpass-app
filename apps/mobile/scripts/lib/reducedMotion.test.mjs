// Run: node --experimental-strip-types --test scripts/lib/reducedMotion.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveReduceMotion, REDUCED_MOTION_SETTING } from '../../src/design/motion.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('flag off: always the OS setting, whatever is stored (unchanged behaviour)', () => {
  for (const inApp of [undefined, null, true, false]) {
    assert.equal(resolveReduceMotion({ inApp, os: false, uiV2: false }), false);
    assert.equal(resolveReduceMotion({ inApp, os: true, uiV2: false }), true);
  }
});

test('flag on, never toggled: defaults to the OS setting', () => {
  assert.equal(resolveReduceMotion({ inApp: undefined, os: false, uiV2: true }), false);
  assert.equal(resolveReduceMotion({ inApp: undefined, os: true, uiV2: true }), true);
  assert.equal(resolveReduceMotion({ inApp: null, os: true, uiV2: true }), true);
});

test('flag on, toggled in the app: the in-app choice wins in both directions', () => {
  assert.equal(resolveReduceMotion({ inApp: true, os: false, uiV2: true }), true);
  assert.equal(resolveReduceMotion({ inApp: false, os: true, uiV2: true }), false);
});

test('the setting is stored with the existing accessibility settings (optional key, no new storage)', () => {
  assert.equal(REDUCED_MOTION_SETTING.key, 'reduceMotion');
  const ctx = read('src/AccessibilityContext.tsx');
  assert.match(ctx, /reduceMotion\?: boolean;/);
  // Not in DEFAULTS: unset means "follow the OS", and stored JSON is unchanged until toggled.
  const defaults = ctx.match(/const DEFAULTS[^}]*}/s)[0];
  assert.doesNotMatch(defaults, /reduceMotion/);
});

test('one hook: the theme and the road animation use useReduceMotion, no parallel OS listener', () => {
  const theme = read('src/design/ThemeProvider.tsx');
  assert.match(theme, /export function useReduceMotion\(\)/);
  assert.match(theme, /resolveReduceMotion\(/);
  const road = read('src/components/RoadmapPath.tsx');
  assert.doesNotMatch(road, /isReduceMotionEnabled|reduceMotionChanged/);
  assert.match(road, /useReduceMotion\(\)/);
  // Only ThemeProvider listens to the OS setting.
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name) && /isReduceMotionEnabled/.test(fs.readFileSync(full, 'utf8'))) {
        offenders.push(path.relative(root, full));
      }
    }
  };
  walk(path.join(root, 'src'));
  walk(path.join(root, 'app'));
  assert.deepEqual(offenders, ['src/design/ThemeProvider.tsx']);
});

test('ui_v2 Home celebrations respect it (no confetti or Pip bounce); other callers unchanged', () => {
  const modal = read('src/components/CelebrationModal.tsx');
  assert.match(modal, /reduceMotion = false,/);
  assert.match(modal, /\{!reduceMotion && pieces\.map/);
  assert.match(read('src/home/HomeV2Screen.tsx'), /<CelebrationModal [^>]*reduceMotion=\{reduceMotion\}/);
  // Flag-off Home still renders it without the prop.
  assert.match(read('app/(tabs)/home.tsx'), /<CelebrationModal(?![^>]*reduceMotion)[^>]*\/>/);
});

test('Profile shows the toggle only with ui_v2 on', () => {
  const settings = read('app/(tabs)/settings.tsx');
  assert.match(settings, /uiV2 \? \[\.\.\.SETTINGS, REDUCED_MOTION_SETTING\] : SETTINGS/);
});
