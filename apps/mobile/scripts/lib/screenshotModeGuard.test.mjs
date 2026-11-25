// Run via: npm run test:scripts
import test from 'node:test';
import assert from 'node:assert';
import { isScreenshotModeAllowed } from '../../src/screenshotModeGuard.ts';

test('allowed in development builds', () => {
  assert.equal(isScreenshotModeAllowed({ isDev: true, appEnv: undefined }), true);
  assert.equal(isScreenshotModeAllowed({ isDev: true, appEnv: 'production' }), true);
});

test('allowed in local and staging builds', () => {
  assert.equal(isScreenshotModeAllowed({ isDev: false, appEnv: 'local' }), true);
  assert.equal(isScreenshotModeAllowed({ isDev: false, appEnv: 'staging' }), true);
});

test('blocked in production, and when the env var is unset (production today)', () => {
  assert.equal(isScreenshotModeAllowed({ isDev: false, appEnv: 'production' }), false);
  assert.equal(isScreenshotModeAllowed({ isDev: false, appEnv: undefined }), false);
  assert.equal(isScreenshotModeAllowed({ isDev: false, appEnv: '' }), false);
});

test('blocked for anything unexpected', () => {
  assert.equal(isScreenshotModeAllowed({ isDev: false, appEnv: 'Staging ' }), false);
  assert.equal(isScreenshotModeAllowed({ isDev: false, appEnv: 'dev' }), false);
});
