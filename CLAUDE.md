# ClearPass — repo instructions

## After a server deploy

After any push that deploys the Railway server, run `npm run smoke:instructor` from `apps/mobile/server` and report only the PASS/FAIL summary. Fix failures before telling Craig it's done. Never ask Craig to test manually, log in, or share credentials or tokens.

## Supabase migrations

Supabase: apply migrations yourself with `npm run db:migrate` (from `apps/mobile/server`). Never ask Craig to paste SQL. Read each migration first: if it contains DROP, TRUNCATE, DELETE, ALTER COLUMN ... TYPE, DISABLE ROW LEVEL SECURITY or REVOKE on existing objects, or touches any table ClearPass doesn't own (Zen Footy shares this database), stop and ask Craig. Otherwise apply without asking. Ad-hoc SQL against production is read-only. Never print the database password or connection string. The smoke test must never use the database connection, so `admin.*` functions stay unreachable from automated tests. Afterwards, report only the migration name and the smoke test PASS/FAIL lines.

Setup this relies on (already done once, 2026-09-11): `~/.config/clearpass/db.env` (chmod 600, outside the repo) holds `SUPABASE_DB_PASSWORD` and `SUPABASE_DB_URL_TEMPLATE` (the session-pooler connection string — port 5432 only, never the transaction pooler on 6543 — with a literal `[YOUR-PASSWORD]` placeholder). `apps/mobile/server/scripts/lib/dbCreds.js` reads that file directly (never via `dotenv.config()`, so its values never land in `process.env` for a child process — e.g. the smoke test — to inherit) and builds the URL at runtime; `lib/runSupabaseCli.js` and `lib/runPsql.js` pass it via `--db-url`/as a `psql` arg (never through a shell string) and scrub it out of any captured output before printing. `supabase` itself is a local devDependency of `apps/mobile/server` (global `npm install -g supabase` is blocked by the CLI itself) — no Supabase access token anywhere; account-wide tokens were deliberately ruled out.
