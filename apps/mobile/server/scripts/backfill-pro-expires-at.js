'use strict';

// One-off backfill for the proExpiresAt gap: users whose isPro was flipped to
// true by the Stripe webhook before it started stamping proExpiresAt (see
// apps/mobile/server/lib/proExpiry.js) never got an expiry date, so the
// expire-pro cron has nothing to act on for them.
//
// This does NOT backdate to each user's original purchase date — that bug
// wasn't their fault, so everyone gets a fresh "3 months from today" instead
// of losing access to time they already paid for and used.
//
// Usage:
//   node scripts/backfill-pro-expires-at.js            # dry run — lists candidates only
//   node scripts/backfill-pro-expires-at.js --execute   # applies the updates listed above

require('dotenv').config({ path: __dirname + '/../.env' });

const { createClient } = require('@supabase/supabase-js');
const { computeProExpiresAt } = require('../lib/proExpiry');

const EXECUTE = process.argv.includes('--execute');

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set (check server/.env)');
    process.exit(1);
  }

  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const newProExpiresAt = computeProExpiresAt(new Date());

  const { data: rows, error } = await supabaseAdmin
    .from('user_progress')
    .select('id, progress');
  if (error) throw error;

  const candidates = (rows || []).filter(row => {
    const p = row.progress || {};
    return p.isPro === true && (p.proExpiresAt === null || p.proExpiresAt === undefined);
  });

  if (candidates.length === 0) {
    console.log('No candidates found — every isPro:true user already has a proExpiresAt.');
    return;
  }

  console.log(`Found ${candidates.length} candidate(s) with isPro:true and missing proExpiresAt:\n`);
  console.log('id'.padEnd(38), 'current proExpiresAt'.padEnd(24), 'new proExpiresAt');
  console.log('-'.repeat(90));
  for (const row of candidates) {
    const current = row.progress?.proExpiresAt ?? '(missing)';
    console.log(String(row.id).padEnd(38), String(current).padEnd(24), newProExpiresAt);
  }

  if (!EXECUTE) {
    console.log(`\nDry run only — no writes made. Re-run with --execute to apply the ${candidates.length} update(s) above.`);
    return;
  }

  console.log(`\nApplying updates to ${candidates.length} row(s)...`);
  let updated = 0;
  for (const row of candidates) {
    const updatedProgress = { ...row.progress, proExpiresAt: newProExpiresAt };
    const { error: updateError } = await supabaseAdmin
      .from('user_progress')
      .update({ progress: updatedProgress, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updateError) {
      console.error(`  FAILED ${row.id}: ${updateError.message}`);
    } else {
      updated++;
    }
  }
  console.log(`\nDone. Updated ${updated}/${candidates.length} row(s).`);
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
