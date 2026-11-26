#!/usr/bin/env node
'use strict';

// ============================================================================
// SYNTHETIC SEED DATA FOR LOCAL (and, later, hosted STAGING) ONLY
// ============================================================================
//
// Creates a fixed set of synthetic accounts (@example.invalid, a reserved
// domain that can never receive mail) with realistic user_progress blobs, so
// every app state can be exercised without production data:
//
//   new-learner@example.invalid           just signed up, nothing answered
//   free-learner@example.invalid          established free learner
//   pro-learner@example.invalid           Pro, proSource 'comp'
//   near-test-learner@example.invalid     theory test in 3 days
//   no-test-date-learner@example.invalid  progress but no test date
//   instructor@example.invalid            instructor with two linked pupils:
//   pupil-1@example.invalid, pupil-2@example.invalid
//
// Every account: profiles.exclude_from_stats = true, and user_metadata
// { account_class: 'internal', seeded_local: true, e2e: true }, and
// profiles.account_class = 'internal' where that column exists. It exists in
// production but was missing from schema.sql until PR #112, so the update is
// best-effort: skipped with a note on a database replayed without it.
// e2e: true reuses lib/e2e.js so no server Slack post ever fires for these
// accounts.
//
// SAFETY: refuses to run unless SUPABASE_URL is 127.0.0.1/localhost, or a
// host listed in CLEARPASS_SEED_ALLOWED_HOSTS (for the future hosted staging
// project). Production (secavejbaapapvvqbwed.supabase.co) is refused even if
// listed. See lib/envGuard.js (unit-tested).
//
// It deliberately does NOT load server/.env. Run it via
// `npm run db:local:seed` (scripts/local-stack.js passes the local URL and
// the local stack's service-role key).
//
// Password: local stack -> the fixed, documented local password below.
// Any other (allow-listed) target -> CLEARPASS_SEED_PASSWORD is required,
// because this repo is public.

const { createClient } = require('@supabase/supabase-js');
const { assertSafeSeedTarget, parseAllowedHosts } = require('../lib/envGuard');

const LOCAL_PASSWORD = 'ClearPass-local-1';
const DAY = 86400000;

const TOPICS = [
  'Alertness', 'Attitude', 'SafetyAndYourVehicle', 'SafetyMargins',
  'HazardAwareness', 'VulnerableRoadUsers', 'OtherTypes', 'VehicleHandling',
  'MotorwayRules', 'RulesOfTheRoad', 'RoadAndTrafficSigns',
  'DocumentsAndRegulations', 'AccidentsAndEmergencies', 'VehicleLoading',
];

const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString();

// Same weights as packages/core/src/calculateReadiness.ts (and the copy in
// seed-test-learners.js): 50% topic accuracy, 35% recent mocks, 15% volume.
function readiness(topicScores, totalQuestionsAnswered, mockTestHistory) {
  const avgTopic = TOPICS.reduce((s, t) => s + (topicScores[t] ?? 0), 0) / TOPICS.length;
  const recent = mockTestHistory.slice(-5);
  const avgMock = recent.length ? recent.reduce((s, m) => s + (m.score / 50) * 100, 0) / recent.length : 0;
  const volume = Math.min(totalQuestionsAnswered / 500, 1) * 100;
  return Math.min(100, Math.max(0, Math.round(avgTopic * 0.5 + avgMock * 0.35 + volume * 0.15)));
}

// Deterministic topic scores around `level`, so re-seeding is stable.
function scores(level) {
  return Object.fromEntries(TOPICS.map((t, i) => [t, Math.max(0, Math.min(100, level + ((i * 7) % 21) - 10))]));
}

function mocks(userKey, list) {
  return list.map(([score, daysAgo], i) => ({
    id: `${userKey}-mock-${i}`,
    score,
    passed: score >= 43,
    takenAt: iso(-daysAgo),
    timeTakenSeconds: 2400 + i * 60,
  }));
}

function progress({ key, level, answered, mockList, streak, xp, lastStudiedDaysAgo, testDateDays, pro }) {
  const topicScores = answered ? scores(level) : Object.fromEntries(TOPICS.map((t) => [t, 0]));
  const mockTestHistory = mocks(key, mockList);
  return {
    topicScores,
    totalQuestionsAnswered: answered,
    mockTestHistory,
    readinessScore: readiness(topicScores, answered, mockTestHistory),
    lastStudied: lastStudiedDaysAgo === null ? '' : iso(-lastStudiedDaysAgo),
    studyStreakDays: streak,
    xp,
    achievements: [],
    dailyChallenge: null,
    testDate: testDateDays === null ? null : iso(testDateDays),
    battleModeHistory: [],
    isPro: !!pro,
    proExpiresAt: pro ? iso(90) : null,
    ...(pro ? { proSource: 'comp' } : {}),
    dailyQuestionsAnswered: 0,
    hazardPerceptionHistory: [],
    streakFreezeCount: 0,
    streakFreezeLastReplenished: '',
  };
}

const ACCOUNTS = [
  {
    email: 'new-learner@example.invalid', name: 'New Learner', type: 'learner',
    progress: progress({ key: 'new', level: 0, answered: 0, mockList: [], streak: 0, xp: 0, lastStudiedDaysAgo: null, testDateDays: 45 }),
  },
  {
    email: 'free-learner@example.invalid', name: 'Free Learner', type: 'learner',
    progress: progress({ key: 'free', level: 66, answered: 320, mockList: [[34, 12], [38, 5]], streak: 6, xp: 2600, lastStudiedDaysAgo: 1, testDateDays: 30 }),
  },
  {
    email: 'pro-learner@example.invalid', name: 'Pro Learner', type: 'learner',
    progress: progress({ key: 'pro', level: 78, answered: 540, mockList: [[39, 14], [42, 8], [45, 2]], streak: 15, xp: 6100, lastStudiedDaysAgo: 0, testDateDays: 18, pro: true }),
  },
  {
    email: 'near-test-learner@example.invalid', name: 'Near Test Learner', type: 'learner',
    progress: progress({ key: 'near', level: 84, answered: 610, mockList: [[41, 10], [44, 4], [46, 1]], streak: 21, xp: 8200, lastStudiedDaysAgo: 0, testDateDays: 3 }),
  },
  {
    email: 'no-test-date-learner@example.invalid', name: 'No Date Learner', type: 'learner',
    progress: progress({ key: 'nodate', level: 55, answered: 140, mockList: [[29, 6]], streak: 3, xp: 1300, lastStudiedDaysAgo: 2, testDateDays: null }),
  },
  { email: 'instructor@example.invalid', name: 'Local Instructor', type: 'instructor', instructorCode: 'LOCAL01', progress: null },
  {
    email: 'pupil-1@example.invalid', name: 'Pupil One', type: 'learner', pupil: true,
    progress: progress({ key: 'pupil1', level: 72, answered: 260, mockList: [[36, 9], [41, 3]], streak: 8, xp: 3100, lastStudiedDaysAgo: 0, testDateDays: 21 }),
  },
  {
    email: 'pupil-2@example.invalid', name: 'Pupil Two', type: 'learner', pupil: true,
    progress: progress({ key: 'pupil2', level: 41, answered: 90, mockList: [[24, 5]], streak: 1, xp: 700, lastStudiedDaysAgo: 5, testDateDays: 40 }),
  },
];

// A 1x1 transparent PNG: a synthetic placeholder in the public bucket.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

async function findUserByEmail(admin, email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
}

async function check(label, promise) {
  const { error } = await promise;
  if (error) throw new Error(`${label}: ${error.message || error}`);
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const target = assertSafeSeedTarget(url, { allowedHosts: parseAllowedHosts(process.env.CLEARPASS_SEED_ALLOWED_HOSTS) });
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_KEY is not set');
  const password = target.kind === 'local' ? LOCAL_PASSWORD : process.env.CLEARPASS_SEED_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('CLEARPASS_SEED_PASSWORD (12+ chars) is required for a non-local target');
  }
  console.log(`[seed] target ${target.host} (${target.kind})`);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ids = {};
  let accountClassNoted = false;

  for (const a of ACCOUNTS) {
    const metadata = { account_class: 'internal', seeded_local: true, e2e: true, display_name: a.name };
    let user = await findUserByEmail(admin, a.email);
    if (user) {
      const { error } = await admin.auth.admin.updateUserById(user.id, { password, user_metadata: metadata, email_confirm: true });
      if (error) throw new Error(`update ${a.email}: ${error.message}`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email: a.email, password, email_confirm: true, user_metadata: metadata });
      if (error) throw new Error(`create ${a.email}: ${error.message}`);
      user = data.user;
    }
    ids[a.email] = user.id;

    await check(
      `profile ${a.email}`,
      admin.from('profiles').upsert({
        id: user.id,
        username: a.name,
        display_name: a.name,
        account_type: a.type,
        exclude_from_stats: true,
        ...(a.instructorCode ? { instructor_code: a.instructorCode } : {}),
      }),
    );
    {
      const { error } = await admin.from('profiles').update({ account_class: 'internal' }).eq('id', user.id);
      if (error && /account_class/.test(error.message || '')) {
        if (!accountClassNoted) {
          console.log('[seed] profiles.account_class not present in this database (schema.sql before #112); skipped');
          accountClassNoted = true;
        }
      } else if (error) {
        throw new Error(`account_class ${a.email}: ${error.message}`);
      }
    }
    if (a.progress) {
      await check(
        `progress ${a.email}`,
        admin.from('user_progress').upsert({ id: user.id, progress: { userId: user.id, ...a.progress }, updated_at: new Date().toISOString() }),
      );
    }
    console.log(`[seed] ${a.email.padEnd(38)} ${a.type}${a.progress?.isPro ? ' (Pro, comp)' : ''}`);
  }

  const instructorId = ids['instructor@example.invalid'];
  await check('clear relationships', admin.from('instructor_relationships').delete().eq('instructor_id', instructorId));
  for (const a of ACCOUNTS.filter((x) => x.pupil)) {
    const learnerId = ids[a.email];
    await check(
      `relationship ${a.email}`,
      admin.from('instructor_relationships').insert({
        instructor_id: instructorId,
        learner_id: learnerId,
        learner_email: a.email,
        learner_name: a.name,
        status: 'accepted',
      }),
    );
    await check(
      `consent ${a.email}`,
      admin
        .from('progress_sharing_consent')
        .upsert({ learner_id: learnerId, instructor_id: instructorId, consented: true }, { onConflict: 'learner_id,instructor_id' }),
    );
  }
  console.log('[seed] instructor@example.invalid linked to pupil-1 and pupil-2 (accepted, consented)');

  const { error: upErr } = await admin.storage
    .from('question-images')
    .upload('local-placeholder.png', PLACEHOLDER_PNG, { contentType: 'image/png', upsert: true });
  if (upErr) console.warn(`[seed] placeholder upload skipped: ${upErr.message}`);
  else console.log('[seed] question-images/local-placeholder.png uploaded');

  console.log(`\n[seed] done. ${ACCOUNTS.length} accounts${target.kind === 'local' ? `, password "${LOCAL_PASSWORD}" (local only)` : ''}.`);
}

main().catch((err) => {
  console.error(`[seed] FAILED: ${err.message || err}`);
  process.exit(1);
});
