'use strict';

// One-off backfill for the proSource gap, resolved by email rather than a
// blanket 'stripe' stamp: the Stripe dashboard shows zero real payments (two
// transactions, both refunded, both the founder's own test/unrelated
// charges) — every isPro:true grant in production today is either a real
// instructor, a manually comp'd account (reviewers/partners/beta testers),
// or test data to delete outright.
//
// Every isPro:true candidate found in the database MUST appear in exactly
// one of STAMP_BY_EMAIL or DELETE_EMAILS below. Any candidate that doesn't
// is reported as UNMAPPED and left completely untouched — and --execute
// refuses to run at all while any UNMAPPED candidate exists, so a future
// Pro grant this list doesn't yet know about can't be silently skipped or
// guessed at.
//
// Usage:
//   node scripts/backfill-pro-source.js            # dry run — lists candidates only
//   node scripts/backfill-pro-source.js --execute   # applies the stamps and deletions listed above

require('dotenv').config({ path: __dirname + '/../.env' });

const { createClient } = require('@supabase/supabase-js');

const EXECUTE = process.argv.includes('--execute');

const STAMP_BY_EMAIL = {
  'enquiries+instructor@zen-finance.co.uk': 'instructor',

  'david.burgess@dvsa.gov.uk': 'comp',
  'pass@colin-driving.com': 'comp',
  'review@getclearpass.co.uk': 'comp',
  'dvsa-review2@getclearpass.co.uk': 'comp',
  'mariawpos83@gmail.com': 'comp',
  'hayleywpossy05@icloud.com': 'comp',
  'camisonlimited@gmail.com': 'comp',
  // Same batch grant (identical proExpiresAt millisecond) as the three
  // 'comp' emails above — confirmed as an omission, not a real purchase.
  'craig@zen-finance.co.uk': 'comp',
};

const DELETE_EMAILS = [
  'money@money.com',
  'pip@pip.com',
  'craig+test@zen-finance.co.uk',
];

// Mirrors the cleanup order in POST /api/delete-account (proxy.js) — every
// table that can reference this user id, deleted before the user_progress/
// profiles/auth.users rows themselves.
async function deleteAccountCompletely(supabaseAdmin, id) {
  await Promise.allSettled([
    supabaseAdmin.from('parent_email_subscriptions').delete().eq('learner_id', id),
    supabaseAdmin.from('instructor_lesson_notes').delete().eq('instructor_id', id),
    supabaseAdmin.from('pass_stories').delete().eq('user_id', id),
    supabaseAdmin.from('instructor_earnings').delete().or(`instructor_id.eq.${id},learner_id.eq.${id}`),
    supabaseAdmin.from('instructor_relationships').delete().or(`instructor_id.eq.${id},learner_id.eq.${id}`),
    supabaseAdmin.from('challenges').delete().or(`challenger_id.eq.${id},challenged_id.eq.${id}`),
  ]);
  await supabaseAdmin.from('user_progress').delete().eq('id', id);
  await supabaseAdmin.from('profiles').delete().eq('id', id);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) throw error;
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set (check server/.env)');
    process.exit(1);
  }

  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) throw authErr;
  const emailById = Object.fromEntries((authData.users || []).map(u => [u.id, u.email]));

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

  const toStamp = [];
  const toDelete = [];
  const unmapped = [];

  for (const row of candidates) {
    const email = emailById[row.id] || null;
    if (email && DELETE_EMAILS.includes(email)) {
      toDelete.push({ ...row, email });
    } else if (email && STAMP_BY_EMAIL[email]) {
      toStamp.push({ ...row, email, targetSource: STAMP_BY_EMAIL[email] });
    } else {
      unmapped.push({ ...row, email });
    }
  }

  console.log(`Found ${candidates.length} candidate(s) with isPro:true and missing proSource.\n`);

  console.log(`STAMP (${toStamp.length}):`);
  console.log('id'.padEnd(38), 'email'.padEnd(38), 'proSource');
  console.log('-'.repeat(90));
  for (const row of toStamp) {
    console.log(String(row.id).padEnd(38), String(row.email).padEnd(38), row.targetSource);
  }

  console.log(`\nDELETE (${toDelete.length}):`);
  console.log('id'.padEnd(38), 'email');
  console.log('-'.repeat(76));
  for (const row of toDelete) {
    console.log(String(row.id).padEnd(38), String(row.email));
  }

  if (unmapped.length > 0) {
    console.log(`\n⚠ UNMAPPED (${unmapped.length}) — found in production but not in STAMP_BY_EMAIL or DELETE_EMAILS. NOT touched:`);
    console.log('id'.padEnd(38), 'email', 'proExpiresAt');
    console.log('-'.repeat(76));
    for (const row of unmapped) {
      console.log(String(row.id).padEnd(38), String(row.email ?? '(no auth user found)'), String(row.progress?.proExpiresAt ?? '(none)'));
    }
  }

  if (!EXECUTE) {
    console.log(`\nDry run only — no writes made.`);
    if (unmapped.length > 0) {
      console.log(`${unmapped.length} unmapped candidate(s) above must be added to STAMP_BY_EMAIL or DELETE_EMAILS before --execute will run.`);
    } else {
      console.log(`Re-run with --execute to apply ${toStamp.length} stamp(s) and ${toDelete.length} deletion(s) above.`);
    }
    return;
  }

  if (unmapped.length > 0) {
    console.error(`\nRefusing to --execute: ${unmapped.length} unmapped candidate(s) found (see above). Resolve them in STAMP_BY_EMAIL or DELETE_EMAILS first — no writes made.`);
    process.exit(1);
  }

  console.log(`\nApplying ${toStamp.length} stamp(s)...`);
  let stamped = 0;
  for (const row of toStamp) {
    const updatedProgress = { ...row.progress, proSource: row.targetSource };
    const { error: updateError } = await supabaseAdmin
      .from('user_progress')
      .update({ progress: updatedProgress, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updateError) {
      console.error(`  FAILED to stamp ${row.id} (${row.email}): ${updateError.message}`);
    } else {
      stamped++;
    }
  }
  console.log(`Stamped ${stamped}/${toStamp.length} row(s).`);

  console.log(`\nApplying ${toDelete.length} deletion(s)...`);
  let deleted = 0;
  for (const row of toDelete) {
    try {
      await deleteAccountCompletely(supabaseAdmin, row.id);
      deleted++;
    } catch (e) {
      console.error(`  FAILED to delete ${row.id} (${row.email}): ${e.message || e}`);
    }
  }
  console.log(`Deleted ${deleted}/${toDelete.length} account(s).`);

  console.log(`\nDone. Stamped ${stamped}/${toStamp.length}, deleted ${deleted}/${toDelete.length}.`);
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
