'use strict';

// Ongoing migration-apply flow — see CLAUDE.md. Run via `npm run db:migrate`
// from apps/mobile/server:
//   1. backs up schema + data to ~/clearpass-backups/<timestamp>.sql
//      (outside the repo; keeps the last 10, prunes older ones)
//   2. runs `supabase db push` (applies any migration files not yet in the
//      remote migration history)
//   3. reloads PostgREST's schema cache (NOTIFY pgrst, 'reload schema') —
//      the exact fix for the "table not found in schema cache" issue this
//      whole setup exists to stop needing a person to run by hand
//   4. runs the instructor smoke test as a separate process. It never
//      receives the database connection — lib/dbCreds.js parses
//      ~/.config/clearpass/db.env by hand rather than via dotenv.config(),
//      specifically so nothing here ever ends up in process.env for a
//      child process to inherit — so admin.* functions stay unreachable
//      from automated tests either way (see CLAUDE.md).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { runSupabaseCli } = require('./lib/runSupabaseCli');
const { runPsqlQuery } = require('./lib/runPsql');

const MOBILE_DIR = path.join(__dirname, '..', '..'); // apps/mobile
const BACKUP_DIR = path.join(os.homedir(), 'clearpass-backups');
const KEEP_BACKUPS = 10;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backupDatabase() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const ts = timestamp();
  const schemaPath = path.join(BACKUP_DIR, `.tmp-schema-${ts}.sql`);
  const dataPath = path.join(BACKUP_DIR, `.tmp-data-${ts}.sql`);
  const finalPath = path.join(BACKUP_DIR, `${ts}.sql`);

  console.log('[db:migrate] backing up schema + data...');
  try {
    const schemaResult = runSupabaseCli(['db', 'dump', '--file', schemaPath], { workdir: MOBILE_DIR });
    if (schemaResult.status !== 0) {
      throw new Error(`schema dump failed:\n${schemaResult.stderr}`);
    }
    const dataResult = runSupabaseCli(['db', 'dump', '--data-only', '--file', dataPath], { workdir: MOBILE_DIR });
    if (dataResult.status !== 0) {
      throw new Error(`data dump failed:\n${dataResult.stderr}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const dataSql = fs.readFileSync(dataPath, 'utf8');
    fs.writeFileSync(finalPath, `-- schema dump (${ts})\n${schemaSql}\n\n-- data dump (${ts})\n${dataSql}\n`, {
      mode: 0o600,
    });
    console.log(`[db:migrate] backup written: ${finalPath}`);
  } finally {
    for (const p of [schemaPath, dataPath]) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('.tmp-'))
    .sort();
  const toDelete = files.slice(0, Math.max(0, files.length - KEEP_BACKUPS));
  for (const f of toDelete) {
    fs.unlinkSync(path.join(BACKUP_DIR, f));
    console.log(`[db:migrate] pruned old backup: ${f}`);
  }

  return finalPath;
}

function pushMigrations() {
  console.log('[db:migrate] running supabase db push...');
  const result = runSupabaseCli(['db', 'push'], { workdir: MOBILE_DIR });
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  if (result.status !== 0) {
    throw new Error('supabase db push failed — see output above.');
  }
  return result.stdout || '';
}

function reloadPostgrestSchema() {
  console.log('[db:migrate] reloading PostgREST schema cache...');
  runPsqlQuery(`notify pgrst, 'reload schema'`);
}

function runSmokeTest() {
  console.log('[db:migrate] running instructor smoke test...');
  const result = spawnSync('node', [path.join(__dirname, 'smoke-instructor.js')], {
    encoding: 'utf8',
    stdio: 'inherit',
    env: process.env,
  });
  return result.status === 0;
}

function main() {
  backupDatabase();
  const pushOutput = pushMigrations();
  reloadPostgrestSchema();
  const smokeOk = runSmokeTest();

  console.log('\n[db:migrate] supabase db push output (for reporting the migration name applied):');
  console.log(pushOutput.trim() ? pushOutput : '(no output — likely nothing pending)');

  if (!smokeOk) {
    process.exitCode = 1;
  }
}

main();
