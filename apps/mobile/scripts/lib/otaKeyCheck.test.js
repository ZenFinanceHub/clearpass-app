'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkOtaBundles } = require('./otaKeyCheck');

function makeDist(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

test('passes when each platform bundle has its own RevenueCat key', () => {
  const dist = makeDist({
    '_expo/static/js/ios/index-abc.hbc': 'xx appl_TESTKEY yy',
    '_expo/static/js/android/index-def.hbc': 'xx goog_TESTKEY yy',
  });
  assert.deepEqual(checkOtaBundles(dist), { ok: true, problems: [] });
});

test('fails when the iOS bundle has no appl_ key (the 17 Sep failure)', () => {
  const dist = makeDist({
    '_expo/static/js/ios/index-abc.hbc': 'no key here',
    '_expo/static/js/android/index-def.hbc': 'goog_TESTKEY',
  });
  const r = checkOtaBundles(dist);
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /^ios: RevenueCat key/);
});

test('fails when a platform bundle is missing entirely', () => {
  const dist = makeDist({ '_expo/static/js/ios/index-abc.hbc': 'appl_TESTKEY' });
  const r = checkOtaBundles(dist);
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /^android: no bundle found/);
});

test('never includes key values in problem messages', () => {
  const dist = makeDist({
    '_expo/static/js/ios/index-abc.hbc': 'appl_SECRETVALUE',
    '_expo/static/js/android/index-def.hbc': 'nothing',
  });
  const r = checkOtaBundles(dist);
  assert.ok(r.problems.every(p => !p.includes('SECRETVALUE')));
});
