'use strict';

// Reads ~/.config/clearpass/db.env at runtime and assembles the Supabase
// session-pooler connection URL. Deliberately NOT dotenv.config() (which
// would merge into process.env and leak into every child process this
// script's process later spawns, including the smoke test — see
// CLAUDE.md's "smoke test must never use the database connection" rule) —
// parsed by hand instead, and never written anywhere else.
//
// Session pooler (port 5432) only, never the transaction pooler (6543) —
// db push/dump need a session-scoped connection; the transaction pooler
// multiplexes per-statement and breaks migrations that span statements.
//
// Nothing in this module is safe to console.log, return to a caller that
// might log it, or write to a file. Only lib/runSupabaseCli.js and
// lib/runPsql.js should ever import it.

const fs = require('fs');
const os = require('os');
const path = require('path');

const DB_ENV_PATH = path.join(os.homedir(), '.config', 'clearpass', 'db.env');

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const vars = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

// Returns { url, password } — url has the password already substituted and
// percent-encoded; password is the raw value, kept only so callers can
// scrub it out of subprocess output before printing anything.
function loadDbCredentials() {
  if (!fs.existsSync(DB_ENV_PATH)) {
    throw new Error(`${DB_ENV_PATH} not found. Create it (chmod 600) with SUPABASE_DB_PASSWORD and SUPABASE_DB_URL_TEMPLATE — see CLAUDE.md.`);
  }
  const vars = parseEnvFile(DB_ENV_PATH);

  const password = vars.SUPABASE_DB_PASSWORD;
  const template = vars.SUPABASE_DB_URL_TEMPLATE;

  if (!password) {
    throw new Error(`SUPABASE_DB_PASSWORD is empty in ${DB_ENV_PATH}.`);
  }
  if (!template) {
    throw new Error(`SUPABASE_DB_URL_TEMPLATE is empty in ${DB_ENV_PATH}.`);
  }
  if (!template.includes('[YOUR-PASSWORD]')) {
    throw new Error('SUPABASE_DB_URL_TEMPLATE has no [YOUR-PASSWORD] placeholder to substitute.');
  }
  if (/:6543\b/.test(template)) {
    throw new Error('SUPABASE_DB_URL_TEMPLATE uses the transaction pooler (port 6543) — session pooler (5432) only.');
  }
  if (!/:5432\b/.test(template)) {
    throw new Error('SUPABASE_DB_URL_TEMPLATE does not use port 5432 (session pooler) — refusing to guess.');
  }

  const url = template.replace('[YOUR-PASSWORD]', encodeURIComponent(password));
  return { url, password };
}

module.exports = { loadDbCredentials, DB_ENV_PATH };
