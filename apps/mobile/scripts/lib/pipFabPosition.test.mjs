// Run via: npm run test:scripts
import test from 'node:test';
import assert from 'node:assert';
import { snapFab, toStored, fromStored, parseStoredFabPos, FAB_SIZE, FAB_EDGE } from '../../src/pipFabPosition.ts';

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
