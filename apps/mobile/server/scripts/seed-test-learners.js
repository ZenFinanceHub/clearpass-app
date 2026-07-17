'use strict';

// ============================================================================
// TEST-DATA TOOLING — NOT PRODUCTION CODE
// ============================================================================
//
// Seeds a fixed set of fake "test-learner-N@zen-finance.co.uk" accounts,
// linked to a real instructor account, with realistic-looking progress data
// (topic scores, mock test history, streaks, XP, pass-probability inputs) so
// the Instructor Dashboard can be visually evaluated with a believable spread
// of learners instead of empty/synthetic-looking state.
//
// This writes directly to the real Supabase project (there is no separate
// staging environment for this app) via the service-role key — but every
// write is scoped to email addresses matching TEST_LEARNER_EMAIL_RE below.
// It never touches the instructor account beyond reading its id, and never
// touches any other user.
//
// Usage:
//   node scripts/seed-test-learners.js               # create/refresh the 8 test learners
//   node scripts/seed-test-learners.js --reset        # delete existing test learners first, then recreate
//   node scripts/seed-test-learners.js --delete-only  # delete existing test learners, don't recreate
//
// Requires server/.env with SUPABASE_URL / SUPABASE_SERVICE_KEY (see
// backfill-pro-expires-at.js for the same pattern).

require('dotenv').config({ path: __dirname + '/../.env' });

const { createClient } = require('@supabase/supabase-js');

const INSTRUCTOR_EMAIL = 'enquiries+instructor@zen-finance.co.uk';
const TEST_LEARNER_EMAIL_RE = /^test-learner-\d+@zen-finance\.co\.uk$/;

const RESET = process.argv.includes('--reset');
const DELETE_ONLY = process.argv.includes('--delete-only');

// ─── TopicCategory (mirrors packages/core/src/types/TopicCategory.ts) ────────
const TOPICS = [
  'Alertness', 'Attitude', 'SafetyAndYourVehicle', 'SafetyMargins',
  'HazardAwareness', 'VulnerableRoadUsers', 'OtherTypes', 'VehicleHandling',
  'MotorwayRules', 'RulesOfTheRoad', 'RoadAndTrafficSigns',
  'DocumentsAndRegulations', 'AccidentsAndEmergencies', 'VehicleLoading',
];

const TOPIC_LABELS = {
  Alertness: 'Alertness', Attitude: 'Attitude', SafetyAndYourVehicle: 'Safety & Vehicle',
  SafetyMargins: 'Safety Margins', HazardAwareness: 'Hazard Awareness',
  VulnerableRoadUsers: 'Vulnerable Users', OtherTypes: 'Other Vehicles',
  VehicleHandling: 'Vehicle Handling', MotorwayRules: 'Motorway Rules',
  RulesOfTheRoad: 'Rules of the Road', RoadAndTrafficSigns: 'Road Signs',
  DocumentsAndRegulations: 'Documents', AccidentsAndEmergencies: 'Accidents',
  VehicleLoading: 'Vehicle Loading',
};

// Reimplementation of packages/core/src/calculateReadiness.ts — kept in sync
// by hand since this script can't import the RN app's TS source directly.
// Same weights: 50% topic accuracy, 35% recent mock average, 15% volume.
function calculateReadiness({ topicScores, totalQuestionsAnswered, mockTestHistory }) {
  const topicValues = TOPICS.map((cat) => topicScores[cat] ?? 0);
  const avgTopicScore = topicValues.reduce((s, v) => s + v, 0) / topicValues.length;

  const recentMocks = mockTestHistory.slice(-5);
  const avgMockScore = recentMocks.length > 0
    ? recentMocks.reduce((s, t) => s + (t.score / 50) * 100, 0) / recentMocks.length
    : 0;

  const volumeScore = Math.min(totalQuestionsAnswered / 500, 1) * 100;

  const raw = avgTopicScore * 0.5 + avgMockScore * 0.35 + volumeScore * 0.15;
  const score = Math.min(100, Math.max(0, Math.round(raw)));

  const weakTopics = TOPICS.filter((cat) => (topicScores[cat] ?? 0) < 70);

  return { score, weakTopics };
}

function daysAgoIso(days, hour = 18) {
  // For "today" (days === 0), pinning to a fixed clock hour can land in the
  // future relative to whenever this script actually runs (e.g. seeding at
  // 9am with hour=18 produces a timestamp 9 hours from now), which showed up
  // as "Active -1 days ago" on the dashboard. Use a small fixed offset from
  // now instead, so day 0 is always safely in the past regardless of run time.
  if (days === 0) return new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function mockResult(id, score, daysAgo, topicScores) {
  return {
    id,
    score,
    passed: score >= 43,
    takenAt: daysAgoIso(daysAgo, 19),
    timeTakenSeconds: 2400 + Math.round(Math.random() * 600),
    topicBreakdown: topicScores,
  };
}

function freshProgressDefaults(userId) {
  return {
    userId,
    achievements: [],
    dailyChallenge: null,
    testDate: null,
    battleModeHistory: [],
    isPro: false,
    proExpiresAt: null,
    dailyQuestionsAnswered: 0,
    hazardPerceptionHistory: [],
    streakFreezeCount: 0,
    streakFreezeLastReplenished: '',
    trialStartDate: daysAgoIso(60),
  };
}

// ─── Learner definitions ──────────────────────────────────────────────────────
// band is just documentation for the report; the dashboard only reads the
// underlying fields (topicScores, mockTestHistory, studyStreakDays, xp,
// lastStudied, totalQuestionsAnswered, readinessScore).

const LEARNERS = [
  {
    email: 'test-learner-1@zen-finance.co.uk',
    name: 'Priya Kaur',
    band: 'near test-ready',
    topicScores: { Alertness: 92, Attitude: 88, SafetyAndYourVehicle: 85, SafetyMargins: 90, HazardAwareness: 83, VulnerableRoadUsers: 87, OtherTypes: 91, VehicleHandling: 84, MotorwayRules: 78, RulesOfTheRoad: 93, RoadAndTrafficSigns: 89, DocumentsAndRegulations: 86, AccidentsAndEmergencies: 90, VehicleLoading: 81 },
    mocks: [[45, 28], [44, 21], [47, 14], [46, 7], [48, 2]],
    streak: 21, totalQuestionsAnswered: 480, xp: 8200, lastStudiedDaysAgo: 0,
  },
  {
    email: 'test-learner-2@zen-finance.co.uk',
    name: 'Jordan Mensah',
    band: 'near test-ready',
    topicScores: { Alertness: 85, Attitude: 80, SafetyAndYourVehicle: 79, SafetyMargins: 83, HazardAwareness: 76, VulnerableRoadUsers: 81, OtherTypes: 88, VehicleHandling: 77, MotorwayRules: 65, RulesOfTheRoad: 86, RoadAndTrafficSigns: 82, DocumentsAndRegulations: 79, AccidentsAndEmergencies: 84, VehicleLoading: 75 },
    mocks: [[38, 24], [41, 16], [43, 9], [45, 3]],
    streak: 14, totalQuestionsAnswered: 350, xp: 6100, lastStudiedDaysAgo: 1,
  },
  {
    email: 'test-learner-3@zen-finance.co.uk',
    name: 'Amara Okafor',
    band: 'mid-progress',
    topicScores: { Alertness: 78, Attitude: 75, SafetyAndYourVehicle: 73, SafetyMargins: 76, HazardAwareness: 72, VulnerableRoadUsers: 74, OtherTypes: 79, VehicleHandling: 71, MotorwayRules: 58, RulesOfTheRoad: 81, RoadAndTrafficSigns: 75, DocumentsAndRegulations: 70, AccidentsAndEmergencies: 77, VehicleLoading: 62 },
    mocks: [[33, 20], [37, 11], [40, 4]],
    streak: 9, totalQuestionsAnswered: 210, xp: 3400, lastStudiedDaysAgo: 2,
  },
  {
    email: 'test-learner-4@zen-finance.co.uk',
    name: 'Liam Turner',
    band: 'mid-progress',
    topicScores: { Alertness: 74, Attitude: 71, SafetyAndYourVehicle: 70, SafetyMargins: 73, HazardAwareness: 52, VulnerableRoadUsers: 70, OtherTypes: 75, VehicleHandling: 69, MotorwayRules: 48, RulesOfTheRoad: 77, RoadAndTrafficSigns: 72, DocumentsAndRegulations: 61, AccidentsAndEmergencies: 74, VehicleLoading: 68 },
    mocks: [[30, 18], [34, 10], [37, 5]],
    streak: 5, totalQuestionsAnswered: 150, xp: 2200, lastStudiedDaysAgo: 3,
  },
  {
    email: 'test-learner-5@zen-finance.co.uk',
    name: 'Chloe Richards',
    band: 'mid-progress',
    topicScores: { Alertness: 68, Attitude: 63, SafetyAndYourVehicle: 60, SafetyMargins: 66, HazardAwareness: 58, VulnerableRoadUsers: 61, OtherTypes: 70, VehicleHandling: 55, MotorwayRules: 42, RulesOfTheRoad: 72, RoadAndTrafficSigns: 65, DocumentsAndRegulations: 51, AccidentsAndEmergencies: 67, VehicleLoading: 48 },
    mocks: [[28, 15], [32, 6]],
    streak: 6, totalQuestionsAnswered: 130, xp: 1900, lastStudiedDaysAgo: 4,
  },
  {
    email: 'test-learner-6@zen-finance.co.uk',
    name: 'Ryan Bailey',
    band: 'struggling',
    topicScores: { Alertness: 55, Attitude: 48, SafetyAndYourVehicle: 44, SafetyMargins: 50, HazardAwareness: 38, VulnerableRoadUsers: 46, OtherTypes: 52, VehicleHandling: 40, MotorwayRules: 30, RulesOfTheRoad: 58, RoadAndTrafficSigns: 47, DocumentsAndRegulations: 36, AccidentsAndEmergencies: 53, VehicleLoading: 34 },
    mocks: [[20, 12], [26, 5]],
    streak: 2, totalQuestionsAnswered: 70, xp: 900, lastStudiedDaysAgo: 6,
  },
  {
    email: 'test-learner-7@zen-finance.co.uk',
    name: 'Sofia Novak',
    band: 'struggling',
    topicScores: { Alertness: 40, Attitude: 35, SafetyAndYourVehicle: 30, SafetyMargins: 38, HazardAwareness: 25, VulnerableRoadUsers: 33, OtherTypes: 42, VehicleHandling: 28, MotorwayRules: 20, RulesOfTheRoad: 45, RoadAndTrafficSigns: 34, DocumentsAndRegulations: 24, AccidentsAndEmergencies: 39, VehicleLoading: 22 },
    mocks: [[17, 8]],
    streak: 1, totalQuestionsAnswered: 40, xp: 500, lastStudiedDaysAgo: 8,
  },
  {
    email: 'test-learner-8@zen-finance.co.uk',
    name: 'Tyler Hughes',
    band: 'inactive',
    topicScores: { Alertness: 15, Attitude: 10, SafetyAndYourVehicle: 8, SafetyMargins: 12, HazardAwareness: 5, VulnerableRoadUsers: 10, OtherTypes: 14, VehicleHandling: 6, MotorwayRules: 0, RulesOfTheRoad: 18, RoadAndTrafficSigns: 9, DocumentsAndRegulations: 4, AccidentsAndEmergencies: 12, VehicleLoading: 3 },
    mocks: [[14, 24]],
    streak: 0, totalQuestionsAnswered: 15, xp: 120, lastStudiedDaysAgo: 25,
  },
];

// Earnings rows are only added for a couple of learners, per the "optional,
// only if easy" ask — one pending, one paid, so both dashboard states show.
const EARNINGS = [
  { learnerEmail: 'test-learner-1@zen-finance.co.uk', amount: 15.00, status: 'paid' },
  { learnerEmail: 'test-learner-3@zen-finance.co.uk', amount: 15.00, status: 'pending' },
];

async function findUserByEmail(supabaseAdmin, email) {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function deleteTestLearners(supabaseAdmin) {
  console.log('Looking for existing test-learner-* accounts to delete...');
  let page = 1;
  const perPage = 200;
  const toDelete = [];
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email && TEST_LEARNER_EMAIL_RE.test(u.email)) toDelete.push(u);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  if (toDelete.length === 0) {
    console.log('  none found.');
    return;
  }

  for (const u of toDelete) {
    // profiles/user_progress reference auth.users without ON DELETE CASCADE,
    // so they must be removed before the auth user itself.
    await supabaseAdmin.from('user_progress').delete().eq('id', u.id);
    await supabaseAdmin.from('profiles').delete().eq('id', u.id);
    // instructor_relationships / instructor_earnings do cascade, but this
    // keeps the delete order explicit and harmless either way.
    await supabaseAdmin.from('instructor_relationships').delete().eq('learner_id', u.id);
    await supabaseAdmin.from('instructor_earnings').delete().eq('learner_id', u.id);
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
    if (delErr) {
      console.error(`  FAILED to delete ${u.email}: ${delErr.message}`);
    } else {
      console.log(`  deleted ${u.email}`);
    }
  }
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set (check server/.env)');
    process.exit(1);
  }

  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  if (RESET || DELETE_ONLY) {
    await deleteTestLearners(supabaseAdmin);
    if (DELETE_ONLY) {
      console.log('\n--delete-only: done, not recreating.');
      return;
    }
  }

  const instructor = await findUserByEmail(supabaseAdmin, INSTRUCTOR_EMAIL);
  if (!instructor) {
    console.error(`Instructor account not found: ${INSTRUCTOR_EMAIL}`);
    process.exit(1);
  }
  console.log(`Instructor: ${INSTRUCTOR_EMAIL} (${instructor.id})\n`);

  const report = [];

  for (const l of LEARNERS) {
    let user = await findUserByEmail(supabaseAdmin, l.email);

    if (!user) {
      const password = 'Test-' + Math.random().toString(36).slice(2, 10) + '!Aa1';
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: l.email,
        password,
        email_confirm: true,
        user_metadata: { seeded_test_learner: true },
      });
      if (error) {
        console.error(`FAILED to create ${l.email}: ${error.message}`);
        continue;
      }
      user = data.user;
      console.log(`Created auth user ${l.email}`);
    } else {
      console.log(`Reusing existing auth user ${l.email}`);
    }

    await supabaseAdmin.from('profiles').upsert({ id: user.id, username: l.name });

    const mockTestHistory = l.mocks.map(([score, daysAgo], idx) =>
      mockResult(`${user.id}-mock-${idx}`, score, daysAgo, l.topicScores));

    const progressCore = {
      topicScores: l.topicScores,
      totalQuestionsAnswered: l.totalQuestionsAnswered,
      mockTestHistory,
      lastStudied: daysAgoIso(l.lastStudiedDaysAgo),
      studyStreakDays: l.streak,
      xp: l.xp,
    };

    const { score: readinessScore, weakTopics } = calculateReadiness(progressCore);

    const progress = {
      ...freshProgressDefaults(user.id),
      ...progressCore,
      readinessScore,
    };

    await supabaseAdmin.from('user_progress').upsert({ id: user.id, progress });

    const { data: existingRel } = await supabaseAdmin
      .from('instructor_relationships')
      .select('id')
      .eq('instructor_id', instructor.id)
      .eq('learner_id', user.id)
      .maybeSingle();

    if (!existingRel) {
      await supabaseAdmin.from('instructor_relationships').insert({
        instructor_id: instructor.id,
        learner_id: user.id,
        learner_email: l.email,
        learner_name: l.name,
        status: 'accepted',
      });
    } else {
      await supabaseAdmin.from('instructor_relationships').update({ status: 'accepted' }).eq('id', existingRel.id);
    }

    const bestMock = Math.max(...mockTestHistory.map((m) => m.score));
    // Same enum-order filter+slice(0,2) the dashboard itself uses for badges.
    const badges = weakTopics.slice(0, 2).map((t) => TOPIC_LABELS[t]);

    report.push({
      name: l.name,
      email: l.email,
      band: l.band,
      readinessScore,
      streak: l.streak,
      totalQuestionsAnswered: l.totalQuestionsAnswered,
      mocks: mockTestHistory.length,
      bestMock,
      lastStudiedDaysAgo: l.lastStudiedDaysAgo,
      weakTopicCount: weakTopics.length,
      badges,
    });
  }

  for (const e of EARNINGS) {
    const learner = await findUserByEmail(supabaseAdmin, e.learnerEmail);
    if (!learner) continue;
    const { data: existingEarning } = await supabaseAdmin
      .from('instructor_earnings')
      .select('id')
      .eq('instructor_id', instructor.id)
      .eq('learner_id', learner.id)
      .eq('amount', e.amount)
      .eq('status', e.status)
      .maybeSingle();
    if (existingEarning) continue;
    await supabaseAdmin.from('instructor_earnings').insert({
      instructor_id: instructor.id,
      learner_id: learner.id,
      amount: e.amount,
      status: e.status,
    });
  }

  console.log('\n=== Seeded learners ===\n');
  for (const r of report) {
    const active = r.lastStudiedDaysAgo === 0 ? 'active today'
      : r.lastStudiedDaysAgo === 1 ? 'active yesterday'
      : `active ${r.lastStudiedDaysAgo}d ago`;
    const badgeText = r.badges.length ? `weak: ${r.badges.join(', ')}` : 'no weak topics';
    console.log(
      `${r.name.padEnd(16)} ${r.email.padEnd(32)} ${String(r.readinessScore).padStart(3)}%  ` +
      `${String(r.streak).padStart(2)}d streak  ${String(r.mocks)} mocks (best ${r.bestMock}/50)  ` +
      `${active.padEnd(16)} ${badgeText}`
    );
  }
  console.log(`\n${EARNINGS.length} instructor_earnings row(s) added for testing the earnings tab.`);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
