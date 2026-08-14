'use strict';

// One-off backfill for the proSource gap: every isPro:true grant that exists
// today was set by the Stripe webhook, before proSource tracking existed
// (see apps/mobile/server/lib/entitlement.js). There is no other source that
// has ever set isPro, so every candidate here is unambiguously 'stripe'.
//
// Usage:
//   node scripts/backfill-pro-source.js            # dry run — lists candidates only
//   node scripts/backfill-pro-source.js --execute   # applies the updates listed above

require('dotenv').config({ path: __dirname + '/../.env' });

const { createClient } = require('@supabase/supabase-js');

const EXECUTE = process.argv.includes('--execute');

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set (check server/.env)');
    process.exit(1);
  }

  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const { data: rows, error } = await supabaseAdmin
    .from('user_progress')
    .select('id, progress');
  if (error) throw error;

  const candidates = (rows || []).filter(row => {
    const p = row.progress || {};
    return p.isPro === true && !p.proSource;
  });

  if (candidates.length === 0) {
    console.log('No candidates found — every isPro:true user already has a proSource.');
    return;
  }

  console.log(`Found ${candidates.length} candidate(s) with isPro:true and missing proSource:\n`);
  console.log('id'.padEnd(38), 'proExpiresAt');
  console.log('-'.repeat(70));
  for (const row of candidates) {
    console.log(String(row.id).padEnd(38), String(row.progress?.proExpiresAt ?? '(none)'));
  }

  if (!EXECUTE) {
    console.log(`\nDry run only — no writes made. Re-run with --execute to apply the ${candidates.length} update(s) above.`);
    return;
  }

  console.log(`\nApplying updates to ${candidates.length} row(s)...`);
  let updated = 0;
  for (const row of candidates) {
    const updatedProgress = { ...row.progress, proSource: 'stripe' };
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
