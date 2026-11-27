'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  isLoopbackUrl,
  parseAllowedHosts,
  assertSafeSeedTarget,
  shouldLoadDotenv,
  assertLocalServerEnv,
} = require('./envGuard');

const PROD = 'https://secavejbaapapvvqbwed.supabase.co';

test('seed target: loopback is allowed', () => {
  assert.deepStrictEqual(assertSafeSeedTarget('http://127.0.0.1:55321'), { host: '127.0.0.1', kind: 'local' });
  assert.equal(assertSafeSeedTarget('http://localhost:55321').kind, 'local');
});

test('seed target: production is always refused, even if allow-listed', () => {
  assert.throws(() => assertSafeSeedTarget(PROD), /PRODUCTION/);
  assert.throws(() => assertSafeSeedTarget(`${PROD}/`), /PRODUCTION/);
  assert.throws(() => assertSafeSeedTarget('HTTPS://SECAVEJBAAPAPVVQBWED.SUPABASE.CO'), /PRODUCTION/);
  assert.throws(
    () => assertSafeSeedTarget(PROD, { allowedHosts: ['secavejbaapapvvqbwed.supabase.co'] }),
    /PRODUCTION/,
  );
  assert.throws(() => assertSafeSeedTarget('https://secavejbaapapvvqbwed.pooler.supabase.com'), /PRODUCTION/);
  assert.throws(() => assertSafeSeedTarget('https://clearpass-app-production.up.railway.app'), /PRODUCTION/);
});

test('seed target: other remote hosts need the allow-list, and https', () => {
  assert.throws(() => assertSafeSeedTarget('https://stagingref.supabase.co'), /not local/);
  assert.equal(
    assertSafeSeedTarget('https://stagingref.supabase.co', { allowedHosts: ['stagingref.supabase.co'] }).kind,
    'staging',
  );
  assert.throws(
    () => assertSafeSeedTarget('http://stagingref.supabase.co', { allowedHosts: ['stagingref.supabase.co'] }),
    /https/,
  );
  // A lookalike that merely contains "localhost" is not loopback.
  assert.throws(() => assertSafeSeedTarget('http://localhost.evil.example'), /not local/);
});

test('seed target: missing or invalid URL is refused', () => {
  assert.throws(() => assertSafeSeedTarget(undefined), /missing or invalid/);
  assert.throws(() => assertSafeSeedTarget(''), /missing or invalid/);
  assert.throws(() => assertSafeSeedTarget('postgres://127.0.0.1:55322'), /missing or invalid/);
});

test('parseAllowedHosts', () => {
  assert.deepStrictEqual(parseAllowedHosts(' A.supabase.co, ,b.example '), ['a.supabase.co', 'b.example']);
  assert.deepStrictEqual(parseAllowedHosts(undefined), []);
});

test('isLoopbackUrl', () => {
  assert.equal(isLoopbackUrl('http://127.0.0.1:55321'), true);
  assert.equal(isLoopbackUrl(PROD), false);
  assert.equal(isLoopbackUrl(undefined), false);
});

test('server: dotenv still loads unless CLEARPASS_SERVER_ENV=local (production unchanged)', () => {
  assert.equal(shouldLoadDotenv({}), true);
  assert.equal(shouldLoadDotenv({ CLEARPASS_SERVER_ENV: 'production' }), true);
  assert.equal(shouldLoadDotenv({ CLEARPASS_SERVER_ENV: 'local' }), false);
});

test('server: local mode refuses a non-local Supabase or a live Stripe key; otherwise a no-op', () => {
  assert.doesNotThrow(() => assertLocalServerEnv({ SUPABASE_URL: PROD }));
  assert.doesNotThrow(() => assertLocalServerEnv({}));
  assert.doesNotThrow(() => assertLocalServerEnv({ CLEARPASS_SERVER_ENV: 'local', SUPABASE_URL: 'http://127.0.0.1:55321' }));
  assert.throws(() => assertLocalServerEnv({ CLEARPASS_SERVER_ENV: 'local', SUPABASE_URL: PROD }), /Refusing to start/);
  assert.throws(() => assertLocalServerEnv({ CLEARPASS_SERVER_ENV: 'local' }), /Refusing to start/);
  assert.throws(
    () =>
      assertLocalServerEnv({
        CLEARPASS_SERVER_ENV: 'local',
        SUPABASE_URL: 'http://127.0.0.1:55321',
        STRIPE_SECRET_KEY: 'sk_live_x',
      }),
    /live Stripe key/,
  );
});
