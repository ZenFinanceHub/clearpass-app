// Run via: npm run test:scripts
import test from 'node:test';
import assert from 'node:assert';
import {
  resolveAppEnv,
  isProductionHost,
  AppEnvConfigError,
  PRODUCTION_SUPABASE_URL,
  PRODUCTION_SUPABASE_ANON_KEY,
  PRODUCTION_API_URL,
  LOCAL_DEV_API_URL,
} from '../../src/appEnv.ts';

// The literal values the app hardcoded before src/appEnv.ts existed
// (src/supabase.ts:4-5 and src/proxyUrl.ts on origin/main, 2026-11-25).
// Duplicated here on purpose: if someone edits the constants in appEnv.ts,
// this test fails instead of silently moving production.
const LEGACY_SUPABASE_URL = 'https://secavejbaapapvvqbwed.supabase.co';
const LEGACY_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY2F2ZWpiYWFwYXB2dnFid2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjY2NTcsImV4cCI6MjA5MzM0MjY1N30.pu0LhnRdup6ZpQWBgcBYP1Z8tQu-BzPl2JmY50e5zfU';
const LEGACY_RAILWAY = 'https://clearpass-app-production.up.railway.app';

// Supabase CLI's well-known local demo anon key (public default, not a secret).
const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const local = (extra = {}) => ({
  EXPO_PUBLIC_APP_ENV: 'local',
  EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: LOCAL_ANON,
  ...extra,
});

test('APP_ENV unset resolves to exactly the legacy production values (release build)', () => {
  assert.deepStrictEqual(resolveAppEnv({}, { isDev: false }), {
    appEnv: 'production',
    supabaseUrl: LEGACY_SUPABASE_URL,
    supabaseAnonKey: LEGACY_ANON_KEY,
    apiUrl: LEGACY_RAILWAY,
    uiV2: false,
  });
  assert.equal(PRODUCTION_SUPABASE_URL, LEGACY_SUPABASE_URL);
  assert.equal(PRODUCTION_SUPABASE_ANON_KEY, LEGACY_ANON_KEY);
  assert.equal(PRODUCTION_API_URL, LEGACY_RAILWAY);
});

test('APP_ENV unset in a __DEV__ build fails closed (never silently production)', () => {
  assert.throws(() => resolveAppEnv({}, { isDev: true }), /not set in a development build/);
  assert.throws(() => resolveAppEnv({ EXPO_PUBLIC_APP_ENV: '  ' }, { isDev: true }), AppEnvConfigError);
});

test('APP_ENV=production set explicitly in a __DEV__ build keeps the legacy localhost:3001 API', () => {
  const r = resolveAppEnv({ EXPO_PUBLIC_APP_ENV: 'production' }, { isDev: true });
  assert.equal(r.apiUrl, 'http://localhost:3001');
  assert.equal(r.supabaseUrl, LEGACY_SUPABASE_URL);
});

test('empty or whitespace APP_ENV is treated as unset (production)', () => {
  assert.equal(resolveAppEnv({ EXPO_PUBLIC_APP_ENV: '' }, { isDev: false }).appEnv, 'production');
  assert.equal(resolveAppEnv({ EXPO_PUBLIC_APP_ENV: '  ' }, { isDev: false }).appEnv, 'production');
});

test('production ignores URL/key/API overrides (an env var cannot move production)', () => {
  const r = resolveAppEnv(
    {
      EXPO_PUBLIC_SUPABASE_URL: 'https://evil.example.com',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'x',
      EXPO_PUBLIC_API_URL: 'https://clearpass-app.vercel.app',
    },
    { isDev: false },
  );
  assert.equal(r.supabaseUrl, LEGACY_SUPABASE_URL);
  assert.equal(r.supabaseAnonKey, LEGACY_ANON_KEY);
  assert.equal(r.apiUrl, LEGACY_RAILWAY);
  const explicit = resolveAppEnv({ EXPO_PUBLIC_APP_ENV: 'production' }, { isDev: false });
  assert.deepStrictEqual(explicit, resolveAppEnv({}, { isDev: false }));
});

test('uiV2 is never on in production, even with EXPO_PUBLIC_UI_V2=1', () => {
  assert.equal(resolveAppEnv({ EXPO_PUBLIC_UI_V2: '1' }, { isDev: false }).uiV2, false);
  assert.equal(resolveAppEnv({ EXPO_PUBLIC_APP_ENV: 'production', EXPO_PUBLIC_UI_V2: '1' }, { isDev: true }).uiV2, false);
});

test('local resolves its own values and defaults the API to localhost:3001', () => {
  for (const isDev of [true, false]) {
    const r = resolveAppEnv(local(), { isDev });
    assert.deepStrictEqual(r, {
      appEnv: 'local',
      supabaseUrl: 'http://127.0.0.1:55321',
      supabaseAnonKey: LOCAL_ANON,
      apiUrl: LOCAL_DEV_API_URL,
      uiV2: false,
    });
  }
  assert.equal(resolveAppEnv(local({ EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3002/' }), { isDev: true }).apiUrl, 'http://127.0.0.1:3002');
});

test('uiV2 only when EXPO_PUBLIC_UI_V2 is exactly "1" outside production', () => {
  assert.equal(resolveAppEnv(local({ EXPO_PUBLIC_UI_V2: '1' }), { isDev: true }).uiV2, true);
  assert.equal(resolveAppEnv(local({ EXPO_PUBLIC_UI_V2: 'true' }), { isDev: true }).uiV2, false);
  assert.equal(resolveAppEnv(local({ EXPO_PUBLIC_UI_V2: '0' }), { isDev: true }).uiV2, false);
});

test('local/staging fail closed when the Supabase URL or key is missing', () => {
  assert.throws(() => resolveAppEnv(local({ EXPO_PUBLIC_SUPABASE_URL: '' }), { isDev: true }), AppEnvConfigError);
  assert.throws(() => resolveAppEnv(local({ EXPO_PUBLIC_SUPABASE_ANON_KEY: undefined }), { isDev: true }), /ANON_KEY is required/);
  assert.throws(
    () => resolveAppEnv({ EXPO_PUBLIC_APP_ENV: 'staging', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'k' }, { isDev: false }),
    /SUPABASE_URL is required/,
  );
});

test('staging requires its own API URL', () => {
  const base = {
    EXPO_PUBLIC_APP_ENV: 'staging',
    EXPO_PUBLIC_SUPABASE_URL: 'https://stagingref.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'staging-anon',
  };
  assert.throws(() => resolveAppEnv(base, { isDev: false }), /API_URL is required/);
  const r = resolveAppEnv({ ...base, EXPO_PUBLIC_API_URL: 'https://clearpass-staging.up.railway.app' }, { isDev: false });
  assert.equal(r.appEnv, 'staging');
  assert.equal(r.apiUrl, 'https://clearpass-staging.up.railway.app');
});

test('local/staging refuse production hosts and the production key', () => {
  for (const appEnv of ['local', 'staging']) {
    const ok = {
      EXPO_PUBLIC_APP_ENV: appEnv,
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: LOCAL_ANON,
      EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3001',
    };
    assert.doesNotThrow(() => resolveAppEnv(ok, { isDev: false }));
    assert.throws(() => resolveAppEnv({ ...ok, EXPO_PUBLIC_SUPABASE_URL: LEGACY_SUPABASE_URL }, { isDev: false }), /points at production/);
    assert.throws(() => resolveAppEnv({ ...ok, EXPO_PUBLIC_SUPABASE_URL: 'HTTPS://SECAVEJBAAPAPVVQBWED.SUPABASE.CO/' }, { isDev: false }), /points at production/);
    assert.throws(() => resolveAppEnv({ ...ok, EXPO_PUBLIC_API_URL: LEGACY_RAILWAY }, { isDev: false }), /points at production/);
    assert.throws(() => resolveAppEnv({ ...ok, EXPO_PUBLIC_SUPABASE_ANON_KEY: LEGACY_ANON_KEY }, { isDev: false }), /production key/);
    assert.throws(() => resolveAppEnv({ ...ok, EXPO_PUBLIC_SUPABASE_URL: 'not a url' }, { isDev: false }), /not a valid URL/);
  }
});

test('a token whose ref claim is the production project is refused even if re-signed', () => {
  const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const forged = `${b64url({ alg: 'HS256' })}.${b64url({ ref: 'secavejbaapapvvqbwed', role: 'anon' })}.sig`;
  assert.throws(() => resolveAppEnv(local({ EXPO_PUBLIC_SUPABASE_ANON_KEY: forged }), { isDev: true }), /production key/);
});

test('unknown APP_ENV values fail closed', () => {
  assert.throws(() => resolveAppEnv({ EXPO_PUBLIC_APP_ENV: 'Staging' }, { isDev: false }), /must be local, staging or production/);
  assert.throws(() => resolveAppEnv({ EXPO_PUBLIC_APP_ENV: 'prod' }, { isDev: false }), AppEnvConfigError);
});

test('isProductionHost', () => {
  assert.equal(isProductionHost('https://secavejbaapapvvqbwed.supabase.co/rest/v1/x'), true);
  assert.equal(isProductionHost('https://clearpass-app-production.up.railway.app/api/x'), true);
  assert.equal(isProductionHost('http://127.0.0.1:55321'), false);
  assert.equal(isProductionHost('garbage'), false);
});
