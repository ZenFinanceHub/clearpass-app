#!/usr/bin/env node
'use strict';

// The only supported way to publish a production OTA:
//   npm run ota:production -- "What changed"
//
// 1. Bundles with the EAS *production* environment, so EXPO_PUBLIC_* values
//    (RevenueCat keys, Supabase URL, proxy URL) are inlined. A bare
//    `eas update` without --environment production resolves them from an
//    empty local .env and ships a bundle that cannot sell Pro.
// 2. Refuses to upload unless each platform's bundle contains its own
//    RevenueCat key (scripts/lib/otaKeyCheck.js).
// 3. Uploads exactly the bundle it checked (--skip-bundler --input-dir).

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { checkOtaBundles } = require('./lib/otaKeyCheck');

const appDir = path.resolve(__dirname, '..');
const distDir = path.join(appDir, 'dist-ota');
const message = process.argv.slice(2).join(' ').trim();

if (!message) {
  console.error('Usage: npm run ota:production -- "What changed"');
  process.exit(1);
}

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: appDir, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\nFAILED: ${cmd} exited with ${r.status}. Nothing was published.`);
    process.exit(r.status || 1);
  }
}

fs.rmSync(distDir, { recursive: true, force: true });

run('npx', [
  'eas-cli', 'env:exec', 'production',
  `npx expo export --platform ios --platform android --output-dir ${path.basename(distDir)}`,
]);

const check = checkOtaBundles(distDir);
if (!check.ok) {
  console.error('\nREFUSING TO PUBLISH. The production bundle is missing required keys:');
  check.problems.forEach(p => console.error(`  - ${p}`));
  console.error('Nothing was uploaded. Check the EAS production environment variables.');
  process.exit(1);
}
console.log('\nKey check PASS: iOS bundle has appl_…, Android bundle has goog_…');

run('npx', [
  'eas-cli', 'update',
  '--branch', 'production',
  '--environment', 'production',
  '--skip-bundler',
  '--input-dir', path.basename(distDir),
  '--message', message,
  '--non-interactive',
]);

console.log('\nPublished. Bundle was key-checked before upload.');
