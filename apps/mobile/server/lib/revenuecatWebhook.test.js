const test = require('node:test');
const assert = require('node:assert/strict');
const { expirationMsToIso, resolveRevenueCatUpdate } = require('./revenuecatWebhook');

test('expirationMsToIso converts a known epoch-ms value to an ISO 8601 string', () => {
  // 2026-11-14T09:59:34.714Z in epoch ms
  assert.equal(expirationMsToIso(1794650374714), '2026-11-14T09:59:34.714Z');
});

test('expirationMsToIso returns null for null', () => {
  assert.equal(expirationMsToIso(null), null);
});

test('expirationMsToIso returns null for undefined (field absent from payload)', () => {
  assert.equal(expirationMsToIso(undefined), null);
});

test('expirationMsToIso returns null for a non-finite value', () => {
  assert.equal(expirationMsToIso(NaN), null);
  assert.equal(expirationMsToIso('not-a-number'), null);
});

test('resolveRevenueCatUpdate: INITIAL_PURCHASE with a real expiration_at_ms sets proExpiresAt to that value', () => {
  const { progress, warning } = resolveRevenueCatUpdate('INITIAL_PURCHASE', 1794650374714, {});
  assert.deepEqual(progress, { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap' });
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: RENEWAL with a real expiration_at_ms sets proExpiresAt to that value', () => {
  const current = { isPro: true, proExpiresAt: '2026-08-14T00:00:00.000Z', proSource: 'iap' };
  const { progress, warning } = resolveRevenueCatUpdate('RENEWAL', 1794650374714, current);
  assert.deepEqual(progress, { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap' });
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: INITIAL_PURCHASE with missing expiration_at_ms falls back to computeIapExpiresAt with a warning', () => {
  const before = Date.now();
  const { progress, warning } = resolveRevenueCatUpdate('INITIAL_PURCHASE', undefined, {});
  const after = Date.now();
  assert.equal(progress.isPro, true);
  assert.equal(progress.proSource, 'iap');
  const resultMs = new Date(progress.proExpiresAt).getTime();
  const ninetyDaysMs = 1000 * 60 * 60 * 24 * 90;
  assert.ok(resultMs - before >= ninetyDaysMs - 1000);
  assert.ok(resultMs - after <= ninetyDaysMs + 1000);
  assert.match(warning, /missing expiration_at_ms/);
});

test('resolveRevenueCatUpdate: RENEWAL with missing expiration_at_ms falls back with a warning too', () => {
  const { progress, warning } = resolveRevenueCatUpdate('RENEWAL', null, { isPro: true, proSource: 'iap' });
  assert.equal(progress.proSource, 'iap');
  assert.match(warning, /missing expiration_at_ms/);
});

test('resolveRevenueCatUpdate: INITIAL_PURCHASE/RENEWAL still go through shouldApplyProGrant — a later existing stripe expiry blocks a shorter iap one', () => {
  const current = { isPro: true, proExpiresAt: '2027-01-01T00:00:00.000Z', proSource: 'stripe' };
  const { progress, warning } = resolveRevenueCatUpdate('RENEWAL', 1794650374714, current); // 2026-11-14, earlier than 2027-01-01
  assert.equal(progress, null);
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: CANCELLATION sets proExpiresAt to expiration_at_ms and leaves isPro true', () => {
  const current = { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap', xp: 200 };
  const { progress, warning } = resolveRevenueCatUpdate('CANCELLATION', 1794650374714, current);
  assert.deepEqual(progress, { proExpiresAt: '2026-11-14T09:59:34.714Z' });
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: CANCELLATION with missing expiration_at_ms logs a warning and leaves proExpiresAt untouched', () => {
  const current = { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap' };
  const { progress, warning } = resolveRevenueCatUpdate('CANCELLATION', undefined, current);
  assert.equal(progress, null);
  assert.match(warning, /missing expiration_at_ms/);
});

test('resolveRevenueCatUpdate: CANCELLATION for a grant that is no longer iap-sourced is a no-op — must not clobber e.g. a manual comp', () => {
  const current = { isPro: true, proExpiresAt: null, proSource: 'comp' };
  const { progress, warning } = resolveRevenueCatUpdate('CANCELLATION', 1794650374714, current);
  assert.equal(progress, null);
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: EXPIRATION clears isPro/proExpiresAt/proSource for an iap-sourced grant', () => {
  const current = { isPro: true, proExpiresAt: '2026-11-14T09:59:34.714Z', proSource: 'iap', xp: 200 };
  const { progress, warning } = resolveRevenueCatUpdate('EXPIRATION', 1794650374714, current);
  assert.deepEqual(progress, { isPro: false, proExpiresAt: null, proSource: null });
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: EXPIRATION for a grant that is no longer iap-sourced is a no-op', () => {
  const current = { isPro: true, proExpiresAt: null, proSource: 'comp' };
  const { progress, warning } = resolveRevenueCatUpdate('EXPIRATION', null, current);
  assert.equal(progress, null);
  assert.equal(warning, null);
});

test('resolveRevenueCatUpdate: an unhandled event type (e.g. BILLING_ISSUE) is a no-op with no warning', () => {
  const { progress, warning } = resolveRevenueCatUpdate('BILLING_ISSUE', 1794650374714, { isPro: true, proSource: 'iap' });
  assert.equal(progress, null);
  assert.equal(warning, null);
});
