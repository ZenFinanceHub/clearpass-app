'use strict';

// ============================================================================
// SMOKE TEST — runs against PRODUCTION (there is no staging environment for
// this project). Exercises the live instructor verification v2 + payout-
// proof flow end to end via the real Railway API, using two throwaway auth
// users it creates and always deletes again, in a finally block, regardless
// of outcome.
//
// Run after any push that deploys the Railway server:
//   npm run smoke:instructor   (from apps/mobile/server)
//
// Prints one PASS/FAIL line per check and exits non-zero if any failed.
// Never prints tokens, keys, or the throwaway accounts' email addresses.
// ============================================================================

require('dotenv').config({ path: __dirname + '/../.env' });

const { createClient } = require('@supabase/supabase-js');
const { deleteInstructorDocuments } = require('../lib/instructorDocuments');

// Same project URL and anon key as apps/mobile/src/supabase.ts — the anon
// key is meant to be public and embedded client-side (access is enforced
// by RLS, not by keeping this value secret; that file commits it in
// plaintext for exactly this reason), so hardcoding it here too, rather
// than requiring a new entry in the gitignored server/.env, is consistent
// with how this key is already treated everywhere else in this codebase.
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

const results = [];
function record(name, passed, detail) {
  results.push({ name, passed });
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`);
}

// 8 random digits — well within the 4-12 normalised-length rule
// (lib/instructorVerification.js) and vanishingly unlikely to collide with
// a leftover row from any previous run (cleanup runs in a finally block
// below regardless of outcome, so there normally isn't one).
function randomLicenceNumber() {
  return String(Math.floor(10000000 + Math.random() * 89999999));
}

// A syntactically valid, minimal 1x1 transparent PNG — deliberately not a
// real certificate. Used only to exercise the upload/storage/Claude-check
// path end to end; the point of check (f) is that a non-document image
// lands on pending_review, not approved.
const BLANK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function createE2EInstructor(n) {
  const email = `e2e+${Date.now()}-${n}@getclearpass.co.uk`;
  const password = `Smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { e2e: true },
  });
  if (createErr) throw new Error(`createUser failed: ${createErr.message}`);
  const userId = created.user.id;

  const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
    id: userId,
    username: `e2e_smoke_${Date.now()}_${n}`,
    account_type: 'instructor',
  });
  if (profileErr) throw new Error(`profile insert failed: ${profileErr.message}`);

  // A real access token via the anon client — the same login path a real
  // client uses — not a service-role-minted one, so these checks exercise
  // verifyAuth exactly as a real instructor's session would.
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: signedIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`sign-in failed: ${signInErr.message}`);

  return { userId, accessToken: signedIn.session.access_token };
}

async function cleanupUser(userId) {
  if (!userId) return;
  try {
    const docsResult = await deleteInstructorDocuments(supabaseAdmin.storage.from('instructor-documents'), userId);
    if (docsResult.error) {
      console.error('  cleanup: instructor-documents failed for', userId, docsResult.error.message || docsResult.error);
    }
  } catch (err) {
    console.error('  cleanup: instructor-documents threw for', userId, err.message || err);
  }
  await Promise.allSettled([
    supabaseAdmin.from('instructor_payout_proofs').delete().eq('user_id', userId),
    supabaseAdmin.from('instructor_verification_requests').delete().eq('user_id', userId),
    supabaseAdmin.from('instructor_verifications').delete().eq('user_id', userId),
    supabaseAdmin.from('instructor_signups').delete().eq('user_id', userId),
    supabaseAdmin.from('user_progress').delete().eq('id', userId),
    supabaseAdmin.from('profiles').delete().eq('id', userId),
  ]);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('  cleanup: deleteUser failed for', userId, error.message);
  }
}

async function apiFetch(path, { method = 'GET', token, json, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (formData !== undefined) {
    body = formData; // fetch sets its own multipart Content-Type + boundary
  }
  const res = await fetch(`${API_URL}${path}`, { method, headers, body });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body — leave data null, callers check status too
  }
  return { status: res.status, data };
}

async function isVerifiedInstructorPro(userId) {
  const { data } = await supabaseAdmin.from('user_progress').select('progress').eq('id', userId).maybeSingle();
  return data?.progress?.isPro === true && data?.progress?.proSource === 'instructor';
}

async function main() {
  let user1 = null;
  let user2 = null;

  try {
    user1 = await createE2EInstructor(1);
    user2 = await createE2EInstructor(2);

    // (a) GET verification -> none
    {
      const { status, data } = await apiFetch('/api/instructor/verification', { token: user1.accessToken });
      record(
        'GET verification (fresh account) -> none',
        status === 200 && data?.status === 'none',
        `got ${status} ${JSON.stringify(data)}`
      );
    }

    // (b) POST without declaration -> 400
    {
      const { status, data } = await apiFetch('/api/instructor/verification', {
        token: user1.accessToken,
        method: 'POST',
        json: { licenceType: 'adi', licenceNumber: randomLicenceNumber() },
      });
      record(
        'POST verification without declaration -> 400',
        status === 400 && data?.error === 'declaration_required',
        `got ${status} ${JSON.stringify(data)}`
      );
    }

    // (c) POST a fresh, non-duplicate valid number with declaration -> auto-verified + Pro granted
    const licenceNumber = randomLicenceNumber();
    {
      const { status, data } = await apiFetch('/api/instructor/verification', {
        token: user1.accessToken,
        method: 'POST',
        json: { licenceType: 'adi', licenceNumber, declaration: true },
      });
      const okResponse = status === 200 && data?.status === 'verified';
      const proGranted = okResponse && (await isVerifiedInstructorPro(user1.userId));
      record(
        'POST verification (fresh, valid) -> auto-verified + Pro granted',
        okResponse && proGranted,
        `response ${status} ${JSON.stringify(data)}, proGranted=${proGranted}`
      );
    }

    // (d) user 2 posts the SAME number -> pending (duplicate), no Pro
    {
      const { status, data } = await apiFetch('/api/instructor/verification', {
        token: user2.accessToken,
        method: 'POST',
        json: { licenceType: 'adi', licenceNumber, declaration: true },
      });
      const okResponse = status === 200 && data?.status === 'pending';
      const noPro = okResponse && !(await isVerifiedInstructorPro(user2.userId));
      record(
        'POST verification (duplicate number, user 2) -> pending, no Pro',
        okResponse && noPro,
        `response ${status} ${JSON.stringify(data)}, noPro=${noPro}`
      );
    }

    // (e) payout request, verified but no proof -> 403 with the upload message
    {
      const { status, data } = await apiFetch('/api/instructor/payout-request', {
        token: user1.accessToken,
        method: 'POST',
      });
      const expectedMessage = 'Upload your ADI certificate or trainee licence on your dashboard to unlock payouts';
      record(
        'POST payout-request (verified, no proof) -> 403 with the upload message',
        status === 403 && data?.message === expectedMessage,
        `got ${status} ${JSON.stringify(data)}`
      );
    }

    // (f) POST payout-proof with a generated blank PNG -> pending_review
    {
      const buffer = Buffer.from(BLANK_PNG_BASE64, 'base64');
      const formData = new FormData();
      formData.append('file', new Blob([buffer], { type: 'image/png' }), 'blank.png');
      const { status, data } = await apiFetch('/api/instructor/payout-proof', {
        token: user1.accessToken,
        method: 'POST',
        formData,
      });
      record(
        'POST payout-proof (blank PNG) -> pending_review',
        status === 200 && data?.status === 'pending_review',
        `got ${status} ${JSON.stringify(data)}`
      );
    }

    // (g) revoke — admin.revoke_instructor is deliberately unreachable via
    // the API (not exposed as a PostgREST schema, execute revoked from
    // anon/authenticated) and this script has no direct Postgres
    // connection on purpose — see the migration and BACKLOG.md. Not a
    // skipped check so much as confirmation that path stays closed.
    console.log('SKIP: admin functions are unreachable by design (no direct Postgres connection; admin schema not exposed via the API)');
  } finally {
    await cleanupUser(user1 && user1.userId);
    await cleanupUser(user2 && user2.userId);
  }

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(`\n${failed.length}/${results.length} checks failed.`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nAll ${results.length} checks passed.`);
}

main().catch((err) => {
  console.error('FATAL:', err.message || err);
  process.exitCode = 1;
});
