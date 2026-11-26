const test = require('node:test');
const assert = require('node:assert/strict');
const { requireCronAuth } = require('./cronAuth');
const { createWeeklyParentEmailsHandler } = require('./weeklyParentEmails');

// Minimal Express-shaped response stand-in.
function createRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

// Stub Supabase client: one confirmed subscription, progress + profile rows.
// Counts every from() call so a test can assert the DB was never touched.
function createStubSupabase() {
  const calls = [];
  const rows = {
    parent_email_subscriptions: [{ parent_email: 'parent@example.test', learner_id: 'learner-1' }],
    user_progress: { progress: { readinessScore: 72, totalQuestionsAnswered: 400, studyStreakDays: 5, mockTestHistory: [{ score: 44 }] } },
    profiles: { username: 'Sam' },
  };
  const client = {
    from(table) {
      calls.push(table);
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        single: async () => ({ data: rows[table], error: null }),
        then(resolve, reject) {
          return Promise.resolve({ data: rows[table], error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client, calls };
}

function setup(env) {
  const supa = createStubSupabase();
  const sent = [];
  let adminCalls = 0;
  const handler = createWeeklyParentEmailsHandler({
    getSupabaseAdmin: () => { adminCalls++; return supa.client; },
    sendEmail: async (msg) => { sent.push(msg); },
    env,
  });
  return { handler, supa, sent, adminCallCount: () => adminCalls };
}

const SECRET = 'test-cron-secret-not-real';

test('weekly parent emails: CRON_SECRET unset, no header -> 401, no DB or email', async () => {
  const { handler, supa, sent, adminCallCount } = setup({});
  const res = createRes();
  await handler({ headers: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Unauthorized' });
  assert.equal(adminCallCount(), 0);
  assert.equal(supa.calls.length, 0);
  assert.equal(sent.length, 0);
});

test('weekly parent emails: CRON_SECRET unset, header present -> 401', async () => {
  const { handler, sent, adminCallCount } = setup({});
  for (const value of ['anything', '', 'undefined']) {
    const res = createRes();
    await handler({ headers: { 'x-cron-secret': value } }, res);
    assert.equal(res.statusCode, 401, `header ${JSON.stringify(value)}`);
  }
  assert.equal(adminCallCount(), 0);
  assert.equal(sent.length, 0);
});

test('weekly parent emails: CRON_SECRET empty string counts as unset -> 401', async () => {
  const { handler, adminCallCount } = setup({ CRON_SECRET: '' });
  const res = createRes();
  await handler({ headers: { 'x-cron-secret': '' } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(adminCallCount(), 0);
});

test('weekly parent emails: CRON_SECRET set, header missing -> 401', async () => {
  const { handler, adminCallCount } = setup({ CRON_SECRET: SECRET });
  const res = createRes();
  await handler({ headers: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(adminCallCount(), 0);
});

test('weekly parent emails: wrong secret -> 401, no DB or email', async () => {
  const { handler, sent, adminCallCount } = setup({ CRON_SECRET: SECRET });
  const res = createRes();
  await handler({ headers: { 'x-cron-secret': 'wrong-secret' } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(adminCallCount(), 0);
  assert.equal(sent.length, 0);
});

test('weekly parent emails: correct secret -> 200, emails the confirmed subscriber', async () => {
  const { handler, supa, sent } = setup({ CRON_SECRET: SECRET });
  const res = createRes();
  await handler({ headers: { 'x-cron-secret': SECRET } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { sent: 1, failed: 0 });
  assert.ok(supa.calls.includes('parent_email_subscriptions'));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'parent@example.test');
  assert.equal(sent[0].subject, 'ClearPass weekly update for Sam');
  assert.match(sent[0].html, /72%/);
  assert.match(sent[0].html, /44 \/ 50/);
});

test('requireCronAuth: fails closed when CRON_SECRET is unset, regardless of header', () => {
  for (const headers of [{}, { 'x-cron-secret': undefined }, { 'x-cron-secret': 'x' }]) {
    const res = createRes();
    assert.equal(requireCronAuth({ headers }, res, {}), false);
    assert.equal(res.statusCode, 401);
  }
});

test('requireCronAuth: accepts only the exact secret', () => {
  const env = { CRON_SECRET: SECRET };
  assert.equal(requireCronAuth({ headers: { 'x-cron-secret': SECRET } }, createRes(), env), true);
  assert.equal(requireCronAuth({ headers: { 'x-cron-secret': SECRET + ' ' } }, createRes(), env), false);
  assert.equal(requireCronAuth({ headers: { 'x-cron-secret': [SECRET] } }, createRes(), env), false);
  assert.equal(requireCronAuth({ headers: {} }, createRes(), env), false);
});
