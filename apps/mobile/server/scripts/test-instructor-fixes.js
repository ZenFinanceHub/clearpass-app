'use strict';

// ============================================================================
// Automated regression tests for the three instructor fixes shipped in
// 1a22d3d (linked-instructors.tsx: instructor_code lookup requires
// account_type='instructor'), 13cda51 (signup.tsx: already-registered email
// offers a magic link), and 0dae847 (proxy.js: switch-to-learner clears
// instructor_code/referral_code).
//
// RUNS AGAINST PRODUCTION SUPABASE — same project as scripts/smoke-
// instructor.js, for the same reason: there is no staging environment for
// this project (see that file's own header comment). Reads
// SUPABASE_SERVICE_KEY from apps/mobile/server/.env (gitignored) to create
// and tear down fixtures via the admin API — same convention as
// smoke-instructor.js. The one assertion that needs to see auth.users
// directly (PostgREST doesn't expose that schema) goes through the
// read-only psql helper at scripts/lib/runPsql.js, per CLAUDE.md's "ad-hoc
// SQL against production is read-only" rule — it requires
// ~/.config/clearpass/db.env (see CLAUDE.md's Supabase migrations section).
//
// TEST 4 additionally calls the live Railway API
// (https://clearpass-app-production.up.railway.app by default, override
// with SMOKE_API_URL) — it only reflects 0dae847 once that commit is
// actually deployed there; it will fail against an older deployment for
// that reason, not because the fix itself is wrong.
//
// Every fixture email uses the e2e-fixtest+ local part (distinct from
// smoke-instructor.js's plain e2e+ prefix, so anything orphaned by *this*
// suite is trivially greppable on its own:
//   select email from auth.users where email like 'e2e-fixtest+%';
// ) and carries user_metadata.e2e = true (lib/e2e.js's isE2EUser
// convention), so nothing here is mistaken for a real signup or triggers a
// Slack notification. Every test cleans up its own auth.users / profiles /
// user_progress / instructor_relationships rows in a finally block
// regardless of pass/fail.
//
// Run (from apps/mobile/server):  npm run test:instructor-fixes
// ============================================================================

require('dotenv').config({ path: __dirname + '/../.env' });

const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const { runPsqlQuery } = require('./lib/runPsql');
const { isAlreadyRegisteredError } = require('../lib/authErrors');

// Same project URL and anon key as scripts/smoke-instructor.js and
// apps/mobile/src/supabase.ts — see that script's comment for why this is
// safe to hardcode (the anon key is meant to be public; access is enforced
// by RLS).
const SUPABASE_URL = 'https://secavejbaapapvvqbwed.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY2F2ZWpiYWFwYXB2dnFid2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjY2NTcsImV4cCI6MjA5MzM0MjY1N30.pu0LhnRdup6ZpQWBgcBYP1Z8tQu-BzPl2JmY50e5zfU';

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const API_URL = process.env.SMOKE_API_URL || 'https://clearpass-app-production.up.railway.app';

if (!SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_KEY not set (check apps/mobile/server/.env)');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const RUN_ID = Date.now();
function testEmail(label) {
  return `e2e-fixtest+${RUN_ID}-${label}@getclearpass.co.uk`;
}

function newAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Mirrors src/accountCodes.ts's alphabet — this is test-data shape only
// (what an instructor_code/referral_code looks like), not the generator
// under test.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function fakeCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

// ── fixture helpers ─────────────────────────────────────────────────────

// Mirrors proxy.js's POST /api/instructor/signup step 1 exactly (see that
// handler's own comment for why it's admin.createUser with no password and
// email_confirm: false) — the passwordless account a web instructor signup
// leaves behind before step 2 ever runs.
async function createPasswordlessUser(label) {
  const email = testEmail(label);
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: {
      instructor_signup_intent: true,
      signup_ref: null,
      e2e: true,
      e2e_suite: 'instructor-fixes',
    },
  });
  if (error) throw new Error(`createUser (passwordless) failed: ${error.message}`);
  return { userId: data.user.id, email };
}

// A full account with a real password + session, used wherever a test needs
// to act as a specific authenticated user (not the service role) — the same
// way a real client would, so RLS is actually exercised.
async function createUserWithSession(label, profileFields) {
  const email = testEmail(label);
  const password = `Fix-${RUN_ID}-${Math.random().toString(36).slice(2)}`;
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { e2e: true, e2e_suite: 'instructor-fixes' },
  });
  if (createErr) throw new Error(`createUser failed: ${createErr.message}`);
  const userId = created.user.id;

  const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
    id: userId,
    username: `e2efix_${RUN_ID}_${label}`,
    ...profileFields,
  });
  if (profileErr) throw new Error(`profile insert failed: ${profileErr.message}`);

  const client = newAnonClient();
  const { data: signedIn, error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);

  return { userId, email, client, accessToken: signedIn.session.access_token };
}

async function countAuthUsersByEmail(email) {
  const rows = runPsqlQuery(`select count(*) from auth.users where email = '${email}'`);
  return Number(rows[0]);
}

// Deletes every row this suite could plausibly have written for these user
// ids, across every table touched by any of the four tests, then the
// auth.users rows themselves. Safe to call from any test's finally block
// regardless of which of these tables that test actually touched.
async function cleanupUsers(userIds) {
  const ids = userIds.filter(Boolean);
  if (ids.length === 0) return;
  for (const id of ids) {
    await Promise.allSettled([
      supabaseAdmin.from('instructor_relationships').delete().eq('instructor_id', id),
      supabaseAdmin.from('instructor_relationships').delete().eq('learner_id', id),
      supabaseAdmin.from('user_progress').delete().eq('id', id),
      supabaseAdmin.from('profiles').delete().eq('id', id),
    ]);
  }
  for (const id of ids) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) console.error('  cleanup: deleteUser failed for', id, error.message);
  }
}

// ── TEST 1 — already-registered email produces a magic link, not a dead end

test('TEST 1 — already-registered email produces a magic link, not a dead end', async () => {
  const created = [];
  try {
    const { userId, email } = await createPasswordlessUser('t1');
    created.push(userId);

    assert.equal(await countAuthUsersByEmail(email), 1, 'sanity: exactly one auth.users row after createUser');

    // Same call site as app/auth/signup.tsx's handleSignUp().
    const anon = newAnonClient();
    const { error: signUpError } = await anon.auth.signUp({ email, password: 'Whatever-Not-Used-123' });

    assert.ok(signUpError, 'expected supabase.auth.signUp to error for an already-registered email');
    assert.ok(
      isAlreadyRegisteredError(signUpError),
      `isAlreadyRegisteredError() did not recognise this error — code=${signUpError.code} status=${signUpError.status} message=${signUpError.message}`
    );

    // Same call site as signup.tsx's new handleSendMagicLink().
    const otpClient = newAnonClient();
    const { error: otpError } = await otpClient.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    assert.equal(otpError, null, `signInWithOtp should succeed for an existing address, got: ${otpError?.message}`);

    assert.equal(await countAuthUsersByEmail(email), 1, 'signUp + signInWithOtp must not create a second auth.users row');
  } finally {
    await cleanupUsers(created);
  }
});

// ── TEST 2 — normal signup is unregressed

test('TEST 2 — normal signup is unregressed', async () => {
  const created = [];
  try {
    const email = testEmail('t2');
    const password = `Fix-${RUN_ID}-normal`;
    const anon = newAnonClient();

    // Mirrors app/auth/signup.tsx:67-70 for the no-referral-code case (no
    // profile insert there) followed by app/auth/choose-account-type.tsx's
    // finish('learner', null), which is the real profile insert — that's
    // the actual two-screen path a plain learner signup takes.
    const { data: signUpData, error: signUpError } = await anon.auth.signUp({ email, password });
    assert.equal(signUpError, null, `signUp failed: ${signUpError?.message}`);

    const userId = signUpData.session?.user?.id ?? signUpData.user?.id;
    assert.ok(userId, 'expected a user id back from signUp');
    created.push(userId);

    const username = `e2efix_${RUN_ID}_t2`;
    const { error: profileError } = await anon.from('profiles').insert({
      id: userId,
      username,
      account_type: 'learner',
    });
    assert.equal(profileError, null, `profile insert failed: ${profileError?.message}`);

    const { data: authUser, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    assert.equal(getUserErr, null);
    assert.equal(authUser.user.email, email, 'auth user was created with the right email');

    const { data: profileRow, error: readErr } = await supabaseAdmin
      .from('profiles')
      .select('account_type, username')
      .eq('id', userId)
      .single();
    assert.equal(readErr, null);
    assert.equal(profileRow.account_type, 'learner');
    assert.equal(profileRow.username, username);
  } finally {
    await cleanupUsers(created);
  }
});

// ── TEST 3 — stale instructor codes cannot create a relationship

test('TEST 3 — stale instructor codes cannot create a relationship (negative + positive)', async () => {
  const created = [];
  try {
    // Negative case: a learner profile carrying an instructor-shaped code
    // it has no business having — exactly what switch-to-learner used to
    // leave behind (root cause fixed in 0dae847; this test covers the
    // *consuming* side fixed in 1a22d3d).
    const staleCode = fakeCode();
    const staleLearner = await createUserWithSession('t3-stale-learner', {
      account_type: 'learner',
      instructor_code: staleCode,
    });
    created.push(staleLearner.userId);

    // Same query shape as app/linked-instructors.tsx's handleEnterCode
    // post-1a22d3d, run as the learner's own authenticated client.
    const negLookup = await staleLearner.client
      .from('profiles')
      .select('id, username, display_name')
      .eq('instructor_code', staleCode)
      .eq('account_type', 'instructor')
      .single();

    assert.ok(negLookup.error || !negLookup.data, 'a non-instructor profile must not match the instructor_code lookup');

    const { count: relCountNeg } = await supabaseAdmin
      .from('instructor_relationships')
      .select('*', { count: 'exact', head: true })
      .eq('learner_id', staleLearner.userId);
    assert.equal(relCountNeg, 0, 'no instructor_relationships row should exist for the negative case');

    // Positive case: a real instructor's own code still links.
    const realCode = fakeCode();
    const instructor = await createUserWithSession('t3-real-instructor', {
      account_type: 'instructor',
      instructor_code: realCode,
    });
    created.push(instructor.userId);

    const learner = await createUserWithSession('t3-linking-learner', { account_type: 'learner' });
    created.push(learner.userId);

    const posLookup = await learner.client
      .from('profiles')
      .select('id, username, display_name')
      .eq('instructor_code', realCode)
      .eq('account_type', 'instructor')
      .single();
    assert.equal(posLookup.error, null, `expected the real instructor's code to match: ${posLookup.error?.message}`);
    assert.equal(posLookup.data.id, instructor.userId);

    // Same insert shape as linked-instructors.tsx's handleEnterCode, run as
    // the learner — this also exercises the real RLS insert policy.
    const insertResult = await learner.client.from('instructor_relationships').insert({
      instructor_id: instructor.userId,
      learner_id: learner.userId,
      learner_name: `e2efix_${RUN_ID}_t3-linking-learner`,
      status: 'accepted',
      invite_code: realCode,
    });
    assert.equal(insertResult.error, null, `relationship insert failed: ${insertResult.error?.message}`);

    const { data: relRow, error: relReadErr } = await supabaseAdmin
      .from('instructor_relationships')
      .select('instructor_id, learner_id, status')
      .eq('instructor_id', instructor.userId)
      .eq('learner_id', learner.userId)
      .single();
    assert.equal(relReadErr, null);
    assert.equal(relRow.status, 'accepted');
  } finally {
    await cleanupUsers(created);
  }
});

// ── TEST 4 — switch-to-learner leaves no stale codes

test('TEST 4 — switch-to-learner leaves no stale codes', async () => {
  const created = [];
  try {
    const instructor = await createUserWithSession('t4-instructor', {
      account_type: 'instructor',
      instructor_code: fakeCode(),
      referral_code: fakeCode(),
    });
    created.push(instructor.userId);

    const { error: progressErr } = await supabaseAdmin.from('user_progress').upsert({
      id: instructor.userId,
      progress: { isPro: true, proExpiresAt: null, proSource: 'instructor' },
      updated_at: new Date().toISOString(),
    });
    assert.equal(progressErr, null);

    console.log(
      `  note: this test calls the live Railway API (${API_URL}) — it only reflects 0dae847 once that commit is deployed there.`
    );

    const res = await fetch(`${API_URL}/api/instructor/switch-to-learner`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${instructor.accessToken}` },
    });
    const body = await res.json().catch(() => null);
    assert.equal(res.status, 200, `switch-to-learner returned ${res.status}: ${JSON.stringify(body)}`);
    assert.equal(body?.switched, true);

    const { data: profileRow, error: profileReadErr } = await supabaseAdmin
      .from('profiles')
      .select('account_type, instructor_code, referral_code')
      .eq('id', instructor.userId)
      .single();
    assert.equal(profileReadErr, null);
    assert.equal(profileRow.account_type, 'learner');
    assert.equal(profileRow.instructor_code, null, 'instructor_code should be cleared');
    assert.equal(profileRow.referral_code, null, 'referral_code should be cleared');

    const { data: progressRow, error: progressReadErr } = await supabaseAdmin
      .from('user_progress')
      .select('progress')
      .eq('id', instructor.userId)
      .single();
    assert.equal(progressReadErr, null);
    assert.equal(progressRow.progress.isPro, false, 'instructor-sourced Pro grant should be cleared');
    assert.equal(progressRow.progress.proSource, null);
  } finally {
    await cleanupUsers(created);
  }
});
