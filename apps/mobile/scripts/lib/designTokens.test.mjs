// Run: node --experimental-strip-types --test scripts/lib/designTokens.test.mjs
// Enforces WCAG 2.2 AA for every foreground/background pair the ClearPass
// 2.0 components use (src/design/tokens.ts CONTRAST_PAIRS), in every
// theme variant the app can show.
import test from 'node:test';
import assert from 'node:assert';
import { contrastRatio } from '../../src/design/contrast.ts';
import { buildColorTokens, CONTRAST_PAIRS, resolveToken, palette } from '../../src/design/tokens.ts';

const VARIANTS = [
  { scheme: 'light' },
  { scheme: 'light', cream: true },
  { scheme: 'light', highContrast: true },
  { scheme: 'light', highContrast: true, cream: true },
  { scheme: 'dark' },
  { scheme: 'dark', highContrast: true },
];

test('contrast maths matches the spec table', () => {
  const r = (a, b) => Math.round(contrastRatio(a, b) * 100) / 100;
  assert.equal(r('#FFFFFF', '#4F46E5'), 6.29);
  assert.equal(r('#111827', '#FFFFFF'), 17.74);
  assert.equal(r('#FFFFFF', '#F59E0B'), 2.15);
  assert.equal(r('#0A0A0F', '#818CF8'), 6.62);
  assert.equal(r('#000000', '#FFFFFF'), 21);
});

for (const v of VARIANTS) {
  const name = Object.entries(v).map(([k, val]) => (val === true ? k : val)).join('+');
  test(`AA for every pair: ${name}`, () => {
    const t = buildColorTokens(v);
    const failures = [];
    for (const p of CONTRAST_PAIRS) {
      const fg = resolveToken(t, p.fg);
      const bg = resolveToken(t, p.bg);
      const ratio = contrastRatio(fg, bg);
      if (ratio < p.min) failures.push(`${p.fg} ${fg} on ${p.bg} ${bg} = ${ratio.toFixed(2)} (< ${p.min})`);
    }
    assert.deepEqual(failures, []);
  });

  test(`banned combinations absent: ${name}`, () => {
    const t = buildColorTokens(v);
    for (const [role, hex] of Object.entries(t.text)) {
      assert.notEqual(hex.toUpperCase(), palette.gold, `text.${role} must never be gold`);
      if (v.scheme === 'light') assert.notEqual(hex.toUpperCase(), '#9CA3AF', `text.${role} must never be #9CA3AF`);
    }
    // Never white on gold.
    assert.notEqual(t.text.onGold.toUpperCase(), '#FFFFFF');
    // Old failing status colours are not reused.
    for (const hex of Object.values(t.status)) {
      if (v.scheme === 'light') {
        assert.notEqual(hex.toUpperCase(), '#EF4444');
        assert.notEqual(hex.toUpperCase(), '#10B981');
      }
    }
  });
}

test('every pair references real tokens', () => {
  const t = buildColorTokens({ scheme: 'light' });
  for (const p of CONTRAST_PAIRS) {
    assert.doesNotThrow(() => resolveToken(t, p.fg), p.fg);
    assert.doesNotThrow(() => resolveToken(t, p.bg), p.bg);
  }
  assert.throws(() => resolveToken(t, 'text.nope'));
});
