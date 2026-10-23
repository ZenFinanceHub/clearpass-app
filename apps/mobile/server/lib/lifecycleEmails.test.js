const test = require('node:test');
const assert = require('node:assert/strict');
const {
  dueLearnerEmail,
  dueInstructorEmail,
  unsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeUrl,
  buildLifecycleEmail,
  LEARNER_STEPS,
  INSTRUCTOR_STEPS,
} = require('./lifecycleEmails');

const SIGNUP = '2026-10-25T10:00:00Z';
const at = days => new Date(new Date(SIGNUP).getTime() + days * 86_400_000 + 3600_000);
const learner = over => ({ signedUpAt: SIGNUP, progress: { lastStudied: SIGNUP }, optedOut: false, sent: new Set(), ...over });
const instructor = over => ({ signedUpAt: SIGNUP, pupils: 0, seatsBought: 0, optedOut: false, sent: new Set(), ...over });

test('learner gets the welcome on day 0 and nothing twice', () => {
  assert.equal(dueLearnerEmail(learner(), at(0)), 'learner_welcome');
  assert.equal(dueLearnerEmail(learner({ sent: new Set(['learner_welcome']) }), at(0)), null);
});

test('learner comeback only if they have not studied on a later day', () => {
  assert.equal(dueLearnerEmail(learner({ sent: new Set(['learner_welcome']) }), at(2)), 'learner_comeback');
  const back = learner({ sent: new Set(['learner_welcome']), progress: { lastStudied: at(1).toISOString() } });
  assert.equal(dueLearnerEmail(back, at(2)), null);
});

test('a missed step is skipped, not sent late', () => {
  // Day 6: comeback window (2–4) has passed, mock (5–8) is due.
  assert.equal(dueLearnerEmail(learner(), at(6)), 'learner_mock');
  assert.equal(dueLearnerEmail(learner(), at(30)), null);
});

test('mock email skipped once a mock is done; Pro learners get nothing but the welcome', () => {
  assert.equal(dueLearnerEmail(learner({ progress: { mockTestHistory: [{}] } }), at(6)), null);
  const pro = learner({ progress: { isPro: true } });
  assert.equal(dueLearnerEmail(pro, at(0)), 'learner_welcome');
  for (const d of [2, 6, 10]) assert.equal(dueLearnerEmail(pro, at(d)), null);
});

test('learner Pro offer on day 9', () => {
  assert.equal(dueLearnerEmail(learner(), at(9)), 'learner_pro');
});

test('opted out or signed up before the cohort start: nothing', () => {
  assert.equal(dueLearnerEmail(learner({ optedOut: true }), at(0)), null);
  assert.equal(dueLearnerEmail(learner({ signedUpAt: '2026-10-01T10:00:00Z' }), new Date('2026-10-01T12:00:00Z')), null);
  assert.equal(dueInstructorEmail(instructor({ optedOut: true }), at(0)), null);
});

test('instructor sequence follows pupils and seats', () => {
  assert.equal(dueInstructorEmail(instructor(), at(0)), 'instructor_welcome');
  assert.equal(dueInstructorEmail(instructor(), at(3)), 'instructor_share');
  assert.equal(dueInstructorEmail(instructor({ pupils: 2 }), at(3)), null);
  assert.equal(dueInstructorEmail(instructor({ pupils: 2 }), at(7)), 'instructor_seats');
  assert.equal(dueInstructorEmail(instructor({ pupils: 0 }), at(7)), null);
  assert.equal(dueInstructorEmail(instructor({ pupils: 2, seatsBought: 1 }), at(7)), null);
  assert.equal(dueInstructorEmail(instructor(), at(14)), 'instructor_checkin');
  assert.equal(dueInstructorEmail(instructor({ seatsBought: 1 }), at(14)), null);
});

test('instructors from before the automated welcome skip it but get the rest', () => {
  const early = instructor({ signedUpAt: '2026-10-22T11:15:00Z' });
  assert.equal(dueInstructorEmail(early, new Date('2026-10-23T09:00:00Z')), null);
  assert.equal(dueInstructorEmail(early, new Date('2026-10-25T12:00:00Z')), 'instructor_share');
  const later = instructor({ signedUpAt: '2026-10-22T19:54:00Z' });
  assert.equal(dueInstructorEmail(later, new Date('2026-10-23T09:00:00Z')), 'instructor_welcome');
});

test('unsubscribe tokens verify only for the right user and key', () => {
  const id = '11111111-2222-3333-4444-555555555555';
  const t = unsubscribeToken(id, 'key-a');
  assert.equal(t.length, 32);
  assert.ok(verifyUnsubscribeToken(id, t, 'key-a'));
  assert.ok(!verifyUnsubscribeToken(id, t, 'key-b'));
  assert.ok(!verifyUnsubscribeToken('11111111-2222-3333-4444-555555555556', t, 'key-a'));
  assert.ok(!verifyUnsubscribeToken(id, 'short', 'key-a'));
  assert.ok(!verifyUnsubscribeToken('not-a-uuid', t, 'key-a'));
  assert.match(unsubscribeUrl('https://api.example', id, 'key-a'), /\/api\/email\/unsubscribe\?u=.+&t=.{32}$/);
});

test('every email builds, escapes names and carries an unsubscribe link', () => {
  const keys = [...LEARNER_STEPS, ...INSTRUCTOR_STEPS].map(([k]) => k);
  for (const key of keys) {
    const e = buildLifecycleEmail(key, {
      name: '<b>Sam</b>',
      progress: { testDate: '2026-11-20' },
      instructorCode: 'ABC123',
      pupils: 2,
      unsubUrl: 'https://api.example/api/email/unsubscribe?u=x&t=y',
      now: new Date('2026-10-25T10:00:00Z'),
    });
    assert.ok(e.subject.length > 5, key);
    assert.ok(e.html.includes('https://api.example/api/email/unsubscribe'), key);
    assert.ok(e.text.includes('Unsubscribe: https://api.example'), key);
    assert.ok(!e.html.includes('<b>Sam</b>'), `${key} must escape the name`);
    assert.ok(e.html.includes('&lt;b&gt;Sam&lt;/b&gt;'), key);
  }
  assert.throws(() => buildLifecycleEmail('nope', {}));
});
