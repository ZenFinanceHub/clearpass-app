// Run: node --experimental-strip-types --test scripts/lib/subscriptionStatus.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  subscriptionView, storeManagementUrl, IOS_MANAGE_URL, ANDROID_PACKAGE, formatProDate,
} from '../../src/profile/subscriptionStatus.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const FREE = { isPro: false, proExpiresAt: null, proSource: null };
const until = '2027-02-12T12:00:00.000Z';

test('store management pages: App Store on iOS, Google Play (this app) on Android, none on web', () => {
  assert.equal(storeManagementUrl('ios'), 'https://apps.apple.com/account/subscriptions');
  assert.equal(IOS_MANAGE_URL, 'https://apps.apple.com/account/subscriptions');
  assert.equal(
    storeManagementUrl('android'),
    `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}`,
  );
  assert.equal(storeManagementUrl('web'), null);
});

test('Android package matches app.json (drift guard; app.json is read, never changed)', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  assert.equal(ANDROID_PACKAGE, appJson.expo.android.package);
});

test('free plan: upgrade goes to the existing paywall; restore offered only where RevenueCat runs', () => {
  for (const platform of ['ios', 'android', 'web']) {
    const v = subscriptionView(FREE, platform);
    assert.equal(v.plan, 'free');
    assert.equal(v.title, 'Free plan');
    assert.deepEqual(v.manage, { kind: 'upgrade', label: 'Upgrade', route: '/paywall' });
    assert.equal(v.canRestore, platform !== 'web');
  }
});

test('app store subscription (iap): Manage subscription opens this platform’s store page', () => {
  const s = { isPro: true, proExpiresAt: until, proSource: 'iap' };
  const ios = subscriptionView(s, 'ios');
  assert.equal(ios.plan, 'pro');
  assert.equal(ios.title, 'ClearPass Pro');
  assert.deepEqual(ios.manage, { kind: 'store', label: 'Manage subscription', url: IOS_MANAGE_URL, store: 'App Store' });
  assert.match(ios.status, /App Store or Google Play/);
  assert.match(ios.status, /12 Feb 2027/);
  assert.equal(ios.canRestore, true);
  const android = subscriptionView(s, 'android');
  assert.equal(android.manage.kind, 'store');
  assert.equal(android.manage.store, 'Google Play');
  assert.equal(android.manage.url, storeManagementUrl('android'));
});

test('app store subscription seen on web: explains where to manage it, no link', () => {
  const v = subscriptionView({ isPro: true, proExpiresAt: until, proSource: 'iap' }, 'web');
  assert.equal(v.manage.kind, 'info');
  assert.match(v.manage.text, /App Store or Google Play/);
  assert.equal('url' in v.manage, false);
  assert.equal(v.canRestore, false);
});

test('web / Stripe one-off purchase: shows what they bought, no recurring-management link on any platform', () => {
  for (const platform of ['web', 'ios', 'android']) {
    const v = subscriptionView({ isPro: true, proExpiresAt: until, proSource: 'stripe' }, platform);
    assert.equal(v.plan, 'pro');
    assert.match(v.status, /One-off card payment/);
    assert.match(v.status, /Pro until 12 Feb 2027/);
    assert.equal(v.manage.kind, 'info');
    assert.match(v.manage.text, /doesn’t renew/);
    assert.equal('url' in v.manage, false);
  }
});

test('free grants (comp, instructor, seat) have nothing to manage', () => {
  for (const proSource of ['comp', 'instructor', 'seat']) {
    const v = subscriptionView({ isPro: true, proExpiresAt: null, proSource }, 'ios');
    assert.equal(v.plan, 'pro');
    assert.equal(v.manage.kind, 'info', proSource);
    assert.ok(v.status.length > 0);
  }
  assert.match(subscriptionView({ isPro: true, proExpiresAt: null, proSource: 'seat' }, 'ios').status, /instructor/);
});

test('Pro with no recorded source: store page on native (harmless if none), guidance on web', () => {
  const s = { isPro: true, proExpiresAt: null, proSource: null };
  assert.equal(subscriptionView(s, 'ios').manage.kind, 'store');
  assert.equal(subscriptionView(s, 'web').manage.kind, 'info');
});

test('missing or broken state reads as the free plan (no entitlement change)', () => {
  assert.equal(subscriptionView(null, 'ios').plan, 'free');
  assert.equal(subscriptionView({ isPro: 'yes' }, 'ios').plan, 'free');
});

test('dates: "12 Feb 2027", empty for missing or invalid', () => {
  assert.equal(formatProDate(until), '12 Feb 2027');
  assert.equal(formatProDate(null), '');
  assert.equal(formatProDate('nope'), '');
});
