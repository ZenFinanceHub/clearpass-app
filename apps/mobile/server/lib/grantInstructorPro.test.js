const test = require('node:test');
const assert = require('node:assert/strict');
const { grantInstructorProForUser } = require('./grantInstructorPro');

function createStubDb({ initial = null, upsertError = null, slackPosted = true } = {}) {
  const calls = { upserts: [], slackMessages: [] };
  return {
    calls,
    async getProgress(id) {
      if (id === 'read-error-user') throw new Error('stub read failure');
      return initial;
    },
    async upsertProgress(id, progress) {
      calls.upserts.push({ id, progress });
      return { error: upsertError };
    },
    async postSlack(text) {
      calls.slackMessages.push(text);
      return slackPosted;
    },
  };
}

test('grantInstructorProForUser: grants from an empty/new progress row, posts Slack with the display name', async () => {
  const db = createStubDb({ initial: null });
  const result = await grantInstructorProForUser('u1', db, { displayName: 'Pat Smith' });

  assert.equal(result.outcome, 'granted');
  assert.equal(db.calls.upserts.length, 1);
  assert.deepEqual(db.calls.upserts[0].progress, { isPro: true, proExpiresAt: null, proSource: 'instructor' });
  assert.deepEqual(db.calls.slackMessages, ['Instructor Pro granted: Pat Smith (u1)']);
});

test('grantInstructorProForUser: falls back to "no name yet" with no/blank display name', async () => {
  const db = createStubDb({ initial: {} });
  await grantInstructorProForUser('u2', db, { displayName: '   ' });
  assert.deepEqual(db.calls.slackMessages, ['Instructor Pro granted: no name yet (u2)']);
});

test('grantInstructorProForUser: already_correct — no write, no Slack post', async () => {
  const db = createStubDb({ initial: { isPro: true, proSource: 'instructor' } });
  const result = await grantInstructorProForUser('u3', db);

  assert.equal(result.outcome, 'already_correct');
  assert.equal(db.calls.upserts.length, 0);
  assert.equal(db.calls.slackMessages.length, 0);
});

test('grantInstructorProForUser: skipped — an existing stripe/comp grant is never overridden', async () => {
  const db = createStubDb({ initial: { isPro: true, proSource: 'stripe', proExpiresAt: '2099-01-01T00:00:00.000Z' } });
  const result = await grantInstructorProForUser('u4', db);

  assert.equal(result.outcome, 'skipped');
  assert.equal(db.calls.upserts.length, 0);
  assert.equal(db.calls.slackMessages.length, 0);
});

test('grantInstructorProForUser: merges into existing progress rather than replacing it', async () => {
  const db = createStubDb({ initial: { xp: 500, streak: 12 } });
  await grantInstructorProForUser('u5', db);
  assert.deepEqual(db.calls.upserts[0].progress, {
    xp: 500, streak: 12, isPro: true, proExpiresAt: null, proSource: 'instructor',
  });
});

test('grantInstructorProForUser: an upsert failure is reported, not thrown, and no Slack post follows', async () => {
  const db = createStubDb({ initial: {}, upsertError: { message: 'stub upsert failure' } });
  const result = await grantInstructorProForUser('u6', db);

  assert.equal(result.outcome, 'error');
  assert.ok(result.error);
  assert.equal(db.calls.slackMessages.length, 0);
});

test('grantInstructorProForUser: a read error propagates (throws) rather than being treated as an empty row', async () => {
  const db = createStubDb();
  await assert.rejects(() => grantInstructorProForUser('read-error-user', db), /stub read failure/);
  assert.equal(db.calls.upserts.length, 0);
});
