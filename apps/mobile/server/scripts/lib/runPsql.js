'use strict';

// Runs one read-only query via `psql` against the session-pooler
// connection from ~/.config/clearpass/db.env — used for the migration
// "reality check" (does the object a migration claims to create actually
// exist, per information_schema/pg_catalog, independent of PostgREST's own
// schema cache, which is exactly what made the earlier cache-vs-missing
// question ambiguous). Same no-shell, captured-and-scrubbed-output
// discipline as runSupabaseCli.js.
//
// query MUST be a read-only SELECT — this file has no guard against a
// caller passing DDL/DML, so every call site is responsible for that; it
// exists specifically so ad-hoc production SQL stays read-only per
// CLAUDE.md.

const { spawnSync } = require('child_process');
const { loadDbCredentials } = require('./dbCreds');

function scrub(text, secrets) {
  if (!text) return text;
  let out = text;
  for (const secret of secrets) {
    if (!secret) continue;
    out = out.split(secret).join('[REDACTED]');
  }
  return out;
}

// Returns trimmed stdout lines (tuples-only, unaligned: -t -A), one per
// row, fields joined with the default '|' separator — simple enough to
// split() in callers without a full SQL result parser.
function runPsqlQuery(query) {
  const { url, password } = loadDbCredentials();
  const result = spawnSync('psql', [url, '-tAc', query], {
    encoding: 'utf8',
    shell: false,
  });

  const secrets = [password, encodeURIComponent(password), url];
  const stdout = scrub(result.stdout, secrets);
  const stderr = scrub(result.stderr, secrets);

  if (result.status !== 0) {
    throw new Error(`psql query failed: ${stderr || '(no stderr)'}`);
  }

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

module.exports = { runPsqlQuery };
