// Run via: npm run test:scripts
import test from 'node:test';
import assert from 'node:assert';
import {
  snapFab, toStored, fromStored, parseStoredFabPos, fabBounds, shouldHideFab,
  FAB_SIZE, FAB_EDGE, HEADER_CLEARANCE, DEFAULT_FAB_POS,
} from '../../src/pipFabPosition.ts';

const b = { width: 390, minY: 55, maxY: 650 };

test('snaps to the nearer side', () => {
  assert.equal(snapFab(10, 300, b).side, 'left');
  assert.equal(snapFab(10, 300, b).x, FAB_EDGE);
  const r = snapFab(300, 300, b);
  assert.equal(r.side, 'right');
  assert.equal(r.x, 390 - FAB_SIZE - FAB_EDGE);
});

test('keeps it off the status bar and tab bar', () => {
  assert.equal(snapFab(300, -40, b).y, 55);
  assert.equal(snapFab(300, 2000, b).y, 650);
});

test('stored position survives a different screen size', () => {
  const s = toStored({ side: 'left', y: 650 }, b);
  assert.deepEqual(s, { side: 'left', yRatio: 1 });
  const small = { width: 320, minY: 40, maxY: 400 };
  assert.deepEqual(fromStored(s, small), { x: FAB_EDGE, y: 400 });
});

test('rejects junk in storage', () => {
  assert.equal(parseStoredFabPos(null), null);
  assert.equal(parseStoredFabPos('nope'), null);
  assert.equal(parseStoredFabPos('{"side":"up","yRatio":0.5}'), null);
  assert.deepEqual(parseStoredFabPos('{"side":"right","yRatio":7}'), { side: 'right', yRatio: 1 });
});

// ── Keeping clear of the header (titles read "…ce" / "…ttings" at 390px) ──

const web390 = fabBounds({ width: 390, height: 844, insetTop: 0, insetBottom: 0 });
const notchPhone = fabBounds({ width: 390, height: 844, insetTop: 47, insetBottom: 34 });

test('top bound sits below the header, under the safe area', () => {
  assert.equal(web390.minY, HEADER_CLEARANCE);
  assert.equal(notchPhone.minY, 47 + HEADER_CLEARANCE);
  assert.ok(HEADER_CLEARANCE >= 64, 'clears a 64px header bar');
});

test('bottom bound keeps clear of the tab bar and home indicator', () => {
  assert.ok(notchPhone.maxY + FAB_SIZE <= 844 - 34 - 64);
  assert.ok(web390.maxY + FAB_SIZE <= 844 - 64);
});

test('a tiny or not-yet-measured window never yields maxY above minY', () => {
  const z = fabBounds({ width: 0, height: 0, insetTop: 0, insetBottom: 0 });
  assert.equal(z.maxY, z.minY);
});

test('default position: right edge, just below the header, at any size', () => {
  for (const b of [web390, notchPhone, fabBounds({ width: 1440, height: 900, insetTop: 0, insetBottom: 0 })]) {
    const p = fromStored(DEFAULT_FAB_POS, b);
    assert.equal(p.y, b.minY);
    assert.equal(p.x, b.width - FAB_SIZE - FAB_EDGE);
  }
});

test('dragging onto the title snaps back below the header', () => {
  assert.equal(snapFab(10, 0, web390).y, HEADER_CLEARANCE);
  assert.equal(snapFab(10, 20, notchPhone).y, 47 + HEADER_CLEARANCE);
});

test('a previously stored position (saved under the old bounds) lands in the allowed area', () => {
  // Old builds stored yRatio 0 for the very top of the screen (minY = insets.top + 8).
  for (const raw of ['{"side":"left","yRatio":0}', '{"side":"right","yRatio":-3}', '{"side":"right","yRatio":9}']) {
    const p = fromStored(parseStoredFabPos(raw), web390);
    assert.ok(p.y >= web390.minY && p.y <= web390.maxY, raw);
  }
});

test('hidden on the tutor screens and when a screen asks (hazard clip playback, mock test)', () => {
  assert.equal(shouldHideFab(['(tabs)', 'home'], false), false);
  assert.equal(shouldHideFab(['(tabs)', 'tutor'], false), true);
  assert.equal(shouldHideFab(['aitutor'], false), true);
  assert.equal(shouldHideFab(['(tabs)', 'hazard'], true), true);
  assert.equal(shouldHideFab(['(tabs)', 'practice'], false), false);
});
