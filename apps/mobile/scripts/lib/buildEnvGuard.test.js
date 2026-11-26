'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { checkBuildEnv } = require('./buildEnvGuard');

const PROD_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY2F2ZWpiYWFwYXB2dnFid2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjY2NTcsImV4cCI6MjA5MzM0MjY1N30.pu0LhnRdup6ZpQWBgcBYP1Z8tQu-BzPl2JmY50e5zfU';
// Supabase CLI's public local demo anon key.
const LOCAL_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const staging = (extra = {}) => ({
  EXPO_PUBLIC_APP_ENV: 'staging',
  EXPO_PUBLIC_SUPABASE_URL: 'https://stagingref.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: LOCAL_KEY,
  EXPO_PUBLIC_API_URL: 'https://clearpass-staging.up.railway.app',
  ...extra,
});

test('Vercel production with APP_ENV unset is allowed (today\'s production build)', () => {
  assert.equal(checkBuildEnv({ VERCEL_ENV: 'production' }).ok, true);
});

test('Vercel preview with NO env vars at all fails closed', () => {
  const r = checkBuildEnv({ VERCEL_ENV: 'preview' });
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /must be "staging" or "local"/);
});

test('Vercel preview/development with APP_ENV=production fails', () => {
  assert.equal(checkBuildEnv({ VERCEL_ENV: 'preview', EXPO_PUBLIC_APP_ENV: 'production' }).ok, false);
  assert.equal(checkBuildEnv({ VERCEL_ENV: 'development' }).ok, false);
});

test('Vercel preview with APP_ENV=staging but missing values fails, listing each', () => {
  const r = checkBuildEnv({ VERCEL_ENV: 'preview', EXPO_PUBLIC_APP_ENV: 'staging' });
  assert.equal(r.ok, false);
  assert.equal(r.problems.length, 3);
});

test('Vercel preview with complete staging values passes', () => {
  assert.equal(checkBuildEnv({ VERCEL_ENV: 'preview', ...staging() }).ok, true);
});

test('staging pointed at production URL, API or key fails', () => {
  for (const extra of [
    { EXPO_PUBLIC_SUPABASE_URL: 'https://secavejbaapapvvqbwed.supabase.co' },
    { EXPO_PUBLIC_API_URL: 'https://clearpass-app-production.up.railway.app' },
    { EXPO_PUBLIC_SUPABASE_ANON_KEY: PROD_KEY },
  ]) {
    assert.equal(checkBuildEnv({ VERCEL_ENV: 'preview', ...staging(extra) }).ok, false, JSON.stringify(Object.keys(extra)));
  }
});

test('Vercel production carrying a staging APP_ENV fails', () => {
  assert.equal(checkBuildEnv({ VERCEL_ENV: 'production', ...staging() }).ok, false);
});

test('EAS: production profile production, preview must be staging, development allowed', () => {
  assert.equal(checkBuildEnv({ EAS_BUILD_PROFILE: 'production' }).ok, true);
  assert.equal(checkBuildEnv({ EAS_BUILD_PROFILE: 'preview' }).ok, false);
  assert.equal(checkBuildEnv({ EAS_BUILD_PROFILE: 'preview', ...staging() }).ok, true);
  assert.equal(checkBuildEnv({ EAS_BUILD_PROFILE: 'development' }).ok, true);
  assert.equal(checkBuildEnv({ EAS_BUILD_PROFILE: 'production', ...staging() }).ok, false);
});

test('unknown APP_ENV value fails everywhere', () => {
  assert.equal(checkBuildEnv({ EXPO_PUBLIC_APP_ENV: 'prod' }).ok, false);
});

test('local machine with no signal and no APP_ENV is allowed (production export, e.g. ota:production)', () => {
  assert.equal(checkBuildEnv({}).ok, true);
});
