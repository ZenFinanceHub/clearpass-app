'use strict';

// Runs the local `supabase` CLI (apps/mobile/server/node_modules/.bin/
// supabase) with --db-url appended, built at call time from
// ~/.config/clearpass/db.env — never composed into a shell string, never
// passed through a shell (spawnSync with an argv array, shell: false), and
// never logged: stdout/stderr are captured (not inherited) and scrubbed of
// both the raw and percent-encoded password, and of the full URL, before
// anything is written back out.

const path = require('path');
const { spawnSync } = require('child_process');
const { loadDbCredentials } = require('./dbCreds');

const SUPABASE_BIN = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'supabase');

function scrub(text, secrets) {
  if (!text) return text;
  let out = text;
  for (const secret of secrets) {
    if (!secret) continue;
    out = out.split(secret).join('[REDACTED]');
  }
  return out;
}

// args: CLI args BEFORE --db-url (e.g. ['migration', 'list']).
// workdir: apps/mobile (where supabase/migrations lives) by default.
// Returns { status, stdout, stderr } — both already scrubbed, safe to
// print or parse.
function runSupabaseCli(args, { workdir } = {}) {
  const { url, password } = loadDbCredentials();
  const fullArgs = [...args, '--db-url', url];
  if (workdir) fullArgs.push('--workdir', workdir);

  const result = spawnSync(SUPABASE_BIN, fullArgs, {
    encoding: 'utf8',
    shell: false,
  });

  const secrets = [password, encodeURIComponent(password), url];
  return {
    status: result.status,
    stdout: scrub(result.stdout, secrets),
    stderr: scrub(result.stderr, secrets),
    error: result.error,
  };
}

module.exports = { runSupabaseCli };
