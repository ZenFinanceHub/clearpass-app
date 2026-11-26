// Run: node --experimental-strip-types --test scripts/lib/reducedMotion.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveReduceMotion, reduceMotionToggleState, REDUCED_MOTION_SETTING, REDUCED_MOTION_OS_NOTE } from '../../src/design/motion.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('flag off: always the OS setting, whatever is stored (unchanged behaviour)', () => {
  for (const inApp of [undefined, null, true, false]) {
    assert.equal(resolveReduceMotion({ inApp, os: false, uiV2: false }), false);
    assert.equal(resolveReduceMotion({ inApp, os: true, uiV2: false }), true);
  }
});

test('flag on: the OS setting is a minimum (effective = OS || in-app)', () => {
  // OS off + user unset => off
  assert.equal(resolveReduceMotion({ inApp: undefined, os: false, uiV2: true }), false);
  assert.equal(resolveReduceMotion({ inApp: null, os: false, uiV2: true }), false);
  // OS off + user on => on
  assert.equal(resolveReduceMotion({ inApp: true, os: false, uiV2: true }), true);
  // OS off + user off => off
  assert.equal(resolveReduceMotion({ inApp: false, os: false, uiV2: true }), false);
  // OS on + user off => on (an enabled OS preference cannot be overridden)
  assert.equal(resolveReduceMotion({ inApp: false, os: true, uiV2: true }), true);
  // OS on + user unset / on => on
  assert.equal(resolveReduceMotion({ inApp: undefined, os: true, uiV2: true }), true);
  assert.equal(resolveReduceMotion({ inApp: true, os: true, uiV2: true }), true);
});

test('toggle state: on and locked while the OS setting is on, with a note', () => {
  assert.deepEqual(reduceMotionToggleState({ inApp: false, os: true }), { value: true, disabled: true, note: REDUCED_MOTION_OS_NOTE });
  assert.deepEqual(reduceMotionToggleState({ inApp: undefined, os: true }), { value: true, disabled: true, note: REDUCED_MOTION_OS_NOTE });
  assert.deepEqual(reduceMotionToggleState({ inApp: true, os: false }), { value: true, disabled: false, note: null });
  assert.deepEqual(reduceMotionToggleState({ inApp: undefined, os: false }), { value: false, disabled: false, note: null });
  assert.deepEqual(reduceMotionToggleState({ inApp: false, os: false }), { value: false, disabled: false, note: null });
  assert.equal(REDUCED_MOTION_OS_NOTE, "On because your device's Reduce Motion setting is on");
});

test('the setting is stored with the existing accessibility settings (optional key, no new storage)', () => {
  assert.equal(REDUCED_MOTION_SETTING.key, 'reduceMotion');
  const ctx = read('src/AccessibilityContext.tsx');
  assert.match(ctx, /reduceMotion\?: boolean;/);
  // Not in DEFAULTS: unset means "off unless the OS says on", and stored JSON is unchanged until toggled.
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
  assert.match(settings, /reduceMotionToggleState\(/);
  assert.match(settings, /disabled=\{/);
});
