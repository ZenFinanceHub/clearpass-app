'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { quoteArg, exportCommand, updateCommand } = require('./otaCommands');

test('export command passes the inner expo command to env:exec as ONE quoted argument', () => {
  assert.equal(
    exportCommand('dist-ota'),
    'npx eas-cli env:exec production "npx expo export --platform ios --platform android --output-dir dist-ota"',
  );
});

test('update command quotes the message so spaces do not split it', () => {
  assert.equal(
    updateCommand('dist-ota', 'Log store-unavailable events to daily stats'),
    'npx eas-cli update --branch production --environment production --skip-bundler --input-dir "dist-ota" --message "Log store-unavailable events to daily stats" --non-interactive',
  );
});

test('quoteArg rejects characters a shell would still interpret', () => {
  for (const bad of ['say "hi"', '100%', '$HOME', 'a`b`', 'wow!', 'a\\b', 'two\nlines']) {
    assert.throws(() => quoteArg(bad), /Unsupported character/);
  }
});

test('quoteArg accepts ordinary release-note text', () => {
  assert.equal(quoteArg("Fix paywall copy, add monthly plan (v1.1.3) - Craig's build"), "\"Fix paywall copy, add monthly plan (v1.1.3) - Craig's build\"");
});
