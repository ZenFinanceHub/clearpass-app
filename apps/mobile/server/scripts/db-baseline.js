'use strict';

// ONE-OFF: reality-checks every existing migration file against the live
// database directly (information_schema/pg_catalog/pg_policies/
// storage.buckets via psql — NOT PostgREST, so this is independent of its
// schema cache, which is exactly what made "does instructor_verification_
// requests actually exist" ambiguous earlier), then reports which
// migrations are safe to baseline as already-applied (`supabase migration
// repair --status applied <version>`) versus which have missing objects.
//
// Read-only. Does not run `migration repair` or `db push` itself — prints
// the exact commands for a human (or a follow-up run of this same script)
// to execute. Not part of the ongoing db:migrate flow; run once to
// establish the baseline, per CLAUDE.md.

const { runPsqlQuery } = require('./lib/runPsql');

// Each check is a { label, sql } pair; sql must be a `select exists (...)`
// returning a single 't'/'f' row.
const MIGRATIONS = [
  {
    version: '20260907150521',
    file: '20260907150521_hazard_clips_require_pro.sql',
    checks: [
      {
        label: `policy "Pro users can read hazard videos" on storage.objects exists`,
        sql: `select exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Pro users can read hazard videos')`,
      },
      {
        label: `policy "Authenticated users can read hazard videos" on storage.objects is gone (dropped by this migration)`,
        sql: `select not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Authenticated users can read hazard videos')`,
      },
      {
        label: `policy "Authenticated users can read active clips" on public.hazard_clips exists`,
        sql: `select exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hazard_clips' and policyname = 'Authenticated users can read active clips')`,
      },
      {
        label: `policy "Public read active clips" on public.hazard_clips is gone (dropped by this migration)`,
        sql: `select not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hazard_clips' and policyname = 'Public read active clips')`,
      },
    ],
  },
  {
    version: '20260910084110',
    file: '20260910084110_protect_user_progress_entitlement_keys.sql',
    checks: [
      {
        label: 'function public.protect_user_progress_entitlement() exists',
        sql: `select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'protect_user_progress_entitlement')`,
      },
      {
        label: 'trigger protect_user_progress_entitlement_trigger on public.user_progress exists',
        sql: `select exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'user_progress' and t.tgname = 'protect_user_progress_entitlement_trigger')`,
      },
    ],
  },
  {
    version: '20260910092237',
    file: '20260910092237_instructor_verifications.sql',
    checks: [
      {
        label: 'table public.instructor_verifications exists',
        sql: `select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'instructor_verifications')`,
      },
    ],
  },
  {
    version: '20260911120000',
    file: '20260911120000_instructor_signups.sql',
    checks: [
      {
        label: 'table public.instructor_signups exists',
        sql: `select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'instructor_signups')`,
      },
    ],
  },
  {
    version: '20260911150000',
    file: '20260911150000_instructor_verification.sql',
    checks: [
      {
        label: 'table public.instructor_verification_requests exists',
        sql: `select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'instructor_verification_requests')`,
      },
      {
        label: 'index instructor_verification_requests_licence_number_normalised_idx exists',
        sql: `select exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'instructor_verification_requests_licence_number_normalised_idx')`,
      },
      {
        label: 'schema admin exists',
        sql: `select exists (select 1 from information_schema.schemata where schema_name = 'admin')`,
      },
      {
        label: 'function admin.verify_instructor exists',
        sql: `select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'admin' and p.proname = 'verify_instructor')`,
      },
      {
        label: 'function admin.reject_instructor exists',
        sql: `select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'admin' and p.proname = 'reject_instructor')`,
      },
    ],
  },
  {
    version: '20260911180000',
    file: '20260911180000_instructor_verification_v2.sql',
    checks: [
      {
        label: 'function admin.revoke_instructor exists',
        sql: `select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'admin' and p.proname = 'revoke_instructor')`,
      },
      {
        label: `storage bucket 'instructor-documents' exists`,
        sql: `select exists (select 1 from storage.buckets where id = 'instructor-documents')`,
      },
      {
        label: 'table public.instructor_payout_proofs exists',
        sql: `select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'instructor_payout_proofs')`,
      },
      {
        label: 'function admin.approve_payout_proof exists',
        sql: `select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'admin' and p.proname = 'approve_payout_proof')`,
      },
      {
        label: 'function admin.reject_payout_proof exists',
        sql: `select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'admin' and p.proname = 'reject_payout_proof')`,
      },
    ],
  },
];

function main() {
  console.log('Migration reality check (direct SQL, independent of PostgREST schema cache)\n');

  const fullyExists = [];
  const notFullyExists = [];

  for (const migration of MIGRATIONS) {
    console.log(`${migration.file}`);
    let allPass = true;
    for (const check of migration.checks) {
      const rows = runPsqlQuery(check.sql);
      const passed = rows[0] === 't';
      if (!passed) allPass = false;
      console.log(`  [${passed ? 'OK' : 'MISSING'}] ${check.label}`);
    }
    console.log(`  => ${allPass ? 'ALL OBJECTS EXIST' : 'NOT FULLY PRESENT'}\n`);
    (allPass ? fullyExists : notFullyExists).push(migration);
  }

  console.log('─'.repeat(70));
  console.log('\nSafe to baseline as already-applied (supabase migration repair --status applied <version>):');
  for (const m of fullyExists) {
    console.log(`  ${m.version}  ${m.file}`);
  }

  console.log('\nNOT fully present — needs review before baselining:');
  if (notFullyExists.length === 0) {
    console.log('  (none)');
  }
  for (const m of notFullyExists) {
    console.log(`  ${m.version}  ${m.file}`);
  }
}

main();
