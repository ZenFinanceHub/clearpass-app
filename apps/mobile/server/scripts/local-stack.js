#!/usr/bin/env node
'use strict';

// LOCAL Supabase stack for ClearPass (Docker). Never touches production:
// every command here is pinned to the local stack defined in
// apps/mobile/supabase-local/supabase/config.toml (ports 553xx), and every
// SQL statement goes to the hardcoded loopback database URL below.
//
//   npm run db:local:start   start the stack (first run pulls Docker images)
//   npm run db:local:reset   wipe the local DB, apply schema.sql + migrations
//                            + local-only setup (buckets), then seed
//   npm run db:local:seed    (re)create the synthetic seed accounts
//   npm run db:local:stop    stop the stack (data volume is kept)
//   npm run db:local:status  print local URLs and the local demo keys
//   npm run server:local     run proxy.js against the local stack, without
//                            server/.env and without any third-party keys
//   npm run web:local        run the Expo web app against the local stack
//                            (port 8120; pass another as an argument)
//
// See docs/environments.md.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, spawn } = require('child_process');
const { isLoopbackUrl } = require('../lib/envGuard');

const SERVER_DIR = path.join(__dirname, '..');
const MOBILE_DIR = path.join(SERVER_DIR, '..');
const LOCAL_WORKDIR = path.join(MOBILE_DIR, 'supabase-local');
const SCHEMA_SQL = path.join(MOBILE_DIR, 'supabase', 'schema.sql');
const MIGRATIONS_DIR = path.join(MOBILE_DIR, 'supabase', 'migrations');
const LOCAL_SETUP_SQL = path.join(LOCAL_WORKDIR, 'local-setup.sql');
const SUPABASE_BIN = path.join(SERVER_DIR, 'node_modules', '.bin', 'supabase');

// The local stack's Postgres (config.toml [db] port). Local default
// credentials, not a secret. Hardcoded so nothing here can ever be pointed
// at a remote database.
const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

function supabase(args, { capture = false } = {}) {
  const r = spawnSync(SUPABASE_BIN, [...args, '--workdir', LOCAL_WORKDIR], {
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    shell: false,
  });
  if (r.error) throw r.error;
  return r;
}

function must(r, what) {
  if (r.status !== 0) {
    if (r.stderr) process.stderr.write(r.stderr);
    console.error(`[local-stack] ${what} failed (exit ${r.status})`);
    process.exit(r.status || 1);
  }
  return r;
}

/** Parses `supabase status -o env` (KEY="value" lines). */
function localStatus() {
  const r = supabase(['status', '-o', 'env'], { capture: true });
  if (r.status !== 0) {
    console.error('[local-stack] local Supabase is not running. Start it with: npm run db:local:start');
    process.exit(1);
  }
  const env = {};
  for (const line of r.stdout.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  if (!isLoopbackUrl(env.API_URL)) {
    console.error(`[local-stack] unexpected API_URL from supabase status: ${env.API_URL}`);
    process.exit(1);
  }
  return {
    apiUrl: env.API_URL,
    anonKey: env.ANON_KEY,
    serviceRoleKey: env.SERVICE_ROLE_KEY,
    studioUrl: env.STUDIO_URL,
    mailUrl: env.INBUCKET_URL || env.MAILPIT_URL,
  };
}

function psqlFile(file) {
  const r = spawnSync('psql', [LOCAL_DB_URL, '-v', 'ON_ERROR_STOP=1', '-q', '-X', '-f', file], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: false,
  });
  if (r.error) throw r.error;
  return r;
}

function migrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();
}

function applySchema() {
  const files = [SCHEMA_SQL, ...migrationFiles().map((f) => path.join(MIGRATIONS_DIR, f)), LOCAL_SETUP_SQL];
  for (const file of files) {
    const label = path.relative(MOBILE_DIR, file);
    const r = psqlFile(file);
    if (r.status !== 0) {
      process.stderr.write(r.stderr);
      console.error(`[local-stack] FAILED applying ${label}`);
      process.exit(1);
    }
    const notices = (r.stderr || '').split('\n').filter((l) => /ERROR|WARNING/.test(l));
    console.log(`[local-stack] applied ${label}${notices.length ? ` (${notices.length} warnings)` : ''}`);
  }
}

function runSeed() {
  const s = localStatus();
  const r = spawnSync(process.execPath, [path.join(__dirname, 'seed-local.js')], {
    stdio: 'inherit',
    shell: false,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, SUPABASE_URL: s.apiUrl, SUPABASE_SERVICE_KEY: s.serviceRoleKey },
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

function printStatus() {
  const s = localStatus();
  console.log(`API (Supabase) URL : ${s.apiUrl}`);
  console.log(`Studio             : ${s.studioUrl}`);
  console.log(`Mail (local inbox) : ${s.mailUrl}`);
  console.log(`Database           : ${LOCAL_DB_URL}`);
  console.log('\nFor the app (local demo keys, public defaults of the Supabase CLI):');
  console.log('  EXPO_PUBLIC_APP_ENV=local');
  console.log(`  EXPO_PUBLIC_SUPABASE_URL=${s.apiUrl}`);
  console.log(`  EXPO_PUBLIC_SUPABASE_ANON_KEY=${s.anonKey}`);
  console.log('  EXPO_PUBLIC_API_URL=http://localhost:3001');
}

// Builds the server's environment from scratch: nothing is inherited from
// the caller's shell or from server/.env, so no production key can leak in.
// Third-party integrations stay unset on purpose (see docs/environments.md
// for how each one degrades).
function serverEnv() {
  const s = localStatus();
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'development',
    CLEARPASS_SERVER_ENV: 'local',
    SUPABASE_URL: s.apiUrl,
    SUPABASE_SERVICE_KEY: s.serviceRoleKey,
    PUBLIC_API_URL: 'http://localhost:3001',
    // Random per run so the cron endpoints are never open locally.
    CRON_SECRET: crypto.randomBytes(24).toString('hex'),
  };
}

function runServer() {
  const child = spawn(process.execPath, [path.join(SERVER_DIR, 'proxy.js')], {
    stdio: 'inherit',
    shell: false,
    env: serverEnv(),
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

function runWeb(port) {
  const s = localStatus();
  const env = {
    ...process.env,
    EXPO_PUBLIC_APP_ENV: 'local',
    EXPO_PUBLIC_SUPABASE_URL: s.apiUrl,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: s.anonKey,
    EXPO_PUBLIC_API_URL: 'http://localhost:3001',
  };
  const child = spawn('npx', ['expo', 'start', '--web', '--port', String(port)], {
    cwd: MOBILE_DIR,
    stdio: 'inherit',
    shell: false,
    env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

const cmd = process.argv[2];
switch (cmd) {
  case 'start':
    must(supabase(['start']), 'supabase start');
    printStatus();
    break;
  case 'stop':
    must(supabase(['stop']), 'supabase stop');
    break;
  case 'status':
    printStatus();
    break;
  case 'reset':
    localStatus(); // refuses unless the local stack is running
    must(supabase(['db', 'reset', '--local']), 'supabase db reset');
    applySchema();
    if (!process.argv.includes('--no-seed')) runSeed();
    break;
  case 'apply':
    localStatus();
    applySchema();
    break;
  case 'seed':
    runSeed();
    break;
  case 'server':
    runServer();
    break;
  case 'web':
    runWeb(Number(process.argv[3]) || 8120);
    break;
  default:
    console.error('Usage: node scripts/local-stack.js start|stop|status|reset [--no-seed]|apply|seed|server|web [port]');
    process.exit(1);
}
