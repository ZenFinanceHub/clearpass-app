const test = require('node:test');
const assert = require('node:assert/strict');
const { isE2EUser } = require('./e2e');

test('isE2EUser: true only when user_metadata.e2e is exactly true', () => {
  assert.equal(isE2EUser({ e2e: true }), true);
});

test('isE2EUser: false for missing, falsy, or non-boolean-true metadata', () => {
  assert.equal(isE2EUser(undefined), false);
  assert.equal(isE2EUser(null), false);
  assert.equal(isE2EUser({}), false);
  assert.equal(isE2EUser({ e2e: false }), false);
  assert.equal(isE2EUser({ e2e: 'true' }), false);
  assert.equal(isE2EUser({ e2e: 1 }), false);
});
