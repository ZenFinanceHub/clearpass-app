const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ABANDONED_THRESHOLD_MS,
  buildAppSignupBackfillRows,
  formatSignupNotification,
  formatAbandonedSignupNotification,
  findUnnotifiedAbandonedSignups,
} = require('./instructorSignups');

test('buildAppSignupBackfillRows: only untracked instructor ids get a row, all sourced app', () => {
  const rows = buildAppSignupBackfillRows(['a', 'b', 'c'], ['b']);
  assert.deepEqual(rows, [
    { user_id: 'a', source: 'app' },
    { user_id: 'c', source: 'app' },
  ]);
});

test('buildAppSignupBackfillRows: nothing to do when every instructor is already tracked', () => {
  assert.deepEqual(buildAppSignupBackfillRows(['a', 'b'], ['a', 'b']), []);
});

test('formatSignupNotification: full row', () => {
  assert.equal(
    formatSignupNotification({ displayName: 'Pat Smith', source: 'web', campaignRef: 'adinjc26', userId: 'u1' }),
    'New instructor signup: Pat Smith, via web, ref adinjc26, user u1',
  );
});

test('formatSignupNotification: falls back to "no name yet" and "none"', () => {
  assert.equal(
    formatSignupNotification({ displayName: null, source: 'app', campaignRef: null, userId: 'u2' }),
    'New instructor signup: no name yet, via app, ref none, user u2',
  );
  assert.equal(
    formatSignupNotification({ displayName: '   ', source: 'app', campaignRef: '  ', userId: 'u3' }),
    'New instructor signup: no name yet, via app, ref none, user u3',
  );
});

test('formatAbandonedSignupNotification', () => {
  assert.equal(
    formatAbandonedSignupNotification({ userId: 'u4' }),
    'Instructor signup not finished after 24h: user u4',
  );
});

test('findUnnotifiedAbandonedSignups: flags an old, incomplete, unflagged step-1 signup', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');
  const users = [
    {
      id: 'abandoned-1',
      created_at: new Date(now.getTime() - ABANDONED_THRESHOLD_MS - 1000).toISOString(),
      user_metadata: { instructor_signup_intent: true },
    },
  ];
  const result = findUnnotifiedAbandonedSignups(users, [], { now });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'abandoned-1');
});

test('findUnnotifiedAbandonedSignups: excludes users under 24h old', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');
  const users = [
    {
      id: 'fresh-1',
      created_at: new Date(now.getTime() - 1000).toISOString(),
      user_metadata: { instructor_signup_intent: true },
    },
  ];
  assert.deepEqual(findUnnotifiedAbandonedSignups(users, [], { now }), []);
});

test('findUnnotifiedAbandonedSignups: excludes users without instructor_signup_intent', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');
  const users = [
    {
      id: 'learner-1',
      created_at: new Date(now.getTime() - ABANDONED_THRESHOLD_MS - 1000).toISOString(),
      user_metadata: {},
    },
  ];
  assert.deepEqual(findUnnotifiedAbandonedSignups(users, [], { now }), []);
});

test('findUnnotifiedAbandonedSignups: excludes users who already completed signup', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');
  const users = [
    {
      id: 'completed-1',
      created_at: new Date(now.getTime() - ABANDONED_THRESHOLD_MS - 1000).toISOString(),
      user_metadata: { instructor_signup_intent: true },
    },
  ];
  assert.deepEqual(findUnnotifiedAbandonedSignups(users, ['completed-1'], { now }), []);
});

test('findUnnotifiedAbandonedSignups: excludes users already flagged as notified', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');
  const users = [
    {
      id: 'already-notified-1',
      created_at: new Date(now.getTime() - ABANDONED_THRESHOLD_MS - 1000).toISOString(),
      user_metadata: { instructor_signup_intent: true, instructor_signup_abandoned_notified: true },
    },
  ];
  assert.deepEqual(findUnnotifiedAbandonedSignups(users, [], { now }), []);
});
