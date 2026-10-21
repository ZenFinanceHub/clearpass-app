'use strict';

const fs = require('fs');
const path = require('path');

// RevenueCat public SDK keys are prefixed by store. A production bundle
// that lacks its platform's key cannot sell Pro at all: purchases.ts reports
// 'missing_api_key' and the paywall shows "Pro isn't available". That is
// exactly what the 17 Sep 2026 update did to every 1.1.2 install, because it
// was published without --environment production. This check runs before
// any upload, so a keyless bundle never reaches phones again.
const REQUIRED_KEY_PREFIX = { ios: 'appl_', android: 'goog_' };

function listBundles(distDir, platform) {
  const dir = path.join(distDir, '_expo', 'static', 'js', platform);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.hbc') || f.endsWith('.js'))
    .map(f => path.join(dir, f));
}

/** Returns { ok, problems[] }. Reads bundles as latin1 so Hermes bytecode
 *  string tables are searchable without decoding. Never prints key values. */
function checkOtaBundles(distDir, platforms = ['ios', 'android']) {
  const problems = [];
  for (const platform of platforms) {
    const bundles = listBundles(distDir, platform);
    if (bundles.length === 0) {
      problems.push(`${platform}: no bundle found in ${path.join(distDir, '_expo/static/js', platform)}`);
      continue;
    }
    const prefix = REQUIRED_KEY_PREFIX[platform];
    const found = bundles.some(file => fs.readFileSync(file).toString('latin1').includes(prefix));
    if (!found) problems.push(`${platform}: RevenueCat key (${prefix}…) missing from bundle`);
  }
  return { ok: problems.length === 0, problems };
}

module.exports = { REQUIRED_KEY_PREFIX, checkOtaBundles, listBundles };
