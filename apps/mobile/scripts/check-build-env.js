#!/usr/bin/env node
'use strict';

// Runs before hosted builds (Vercel buildCommand, EAS eas-build-pre-install).
// Exits non-zero, failing the build, when a non-production build would be
// wired to the production backend. Rules: scripts/lib/buildEnvGuard.js.
// Prints only variable names and the context, never values.

const { checkBuildEnv } = require('./lib/buildEnvGuard');

const result = checkBuildEnv(process.env);
if (result.ok) {
  console.log(`[check-build-env] OK (${result.context})`);
} else {
  console.error(`[check-build-env] Refusing to build (${result.context}):`);
  for (const p of result.problems) console.error(`  - ${p}`);
  console.error('  See docs/environments.md');
  process.exit(1);
}
