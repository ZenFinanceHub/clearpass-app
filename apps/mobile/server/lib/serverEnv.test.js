'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveServerEnv } = require('./serverEnv');

test('resolveServerEnv: unset or empty is production (Railway today, unchanged)', () => {
  assert.equal(resolveServerEnv({}), 'production');
  assert.equal(resolveServerEnv({ CLEARPASS_SERVER_ENV: '' }), 'production');
  assert.equal(resolveServerEnv({ CLEARPASS_SERVER_ENV: '  ' }), 'production');
});

test('resolveServerEnv: local, staging and production are accepted', () => {
  for (const v of ['local', 'staging', 'production']) assert.equal(resolveServerEnv({ CLEARPASS_SERVER_ENV: v }), v);
  assert.equal(resolveServerEnv({ CLEARPASS_SERVER_ENV: ' staging ' }), 'staging');
});

test('resolveServerEnv: anything else throws instead of guessing', () => {
  for (const v of ['prod', 'Production', 'dev', 'test']) {
    assert.throws(() => resolveServerEnv({ CLEARPASS_SERVER_ENV: v }), /must be local, staging or production/);
  }
});
