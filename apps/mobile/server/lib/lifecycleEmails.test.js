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

// ─── Study reminder emails ──────────────────────────────────────────────────
const { dueStudyNudgeEmail, buildStudyNudgeEmail, NUDGE_EMAIL_DAYS } = require('./lifecycleEmails');

const LAST = '2026-11-01T18:00:00Z'; // last studied, a Sunday evening (UK)
const day = n => new Date(Date.UTC(2026, 10, 1 + n, 10, 0)); // 10:00 UTC, n UK days later
const nudger = over => ({ signedUpAt: '2026-09-01T10:00:00Z', progress: { lastStudied: LAST }, optedOut: false, sent: new Set(), lastEmailAt: null, ...over });

test('study reminder emails follow the schedule from the last study day', () => {
  const steps = [];
  const sent = new Set();
  for (let n = 0; n <= 80; n++) {
    const due = dueStudyNudgeEmail(nudger({ sent }), day(n));
    if (due) { steps.push(n); sent.add(due.key); }
  }
  assert.deepEqual(steps, NUDGE_EMAIL_DAYS);
});

test('nothing on the day they studied or the day after', () => {
  assert.equal(dueStudyNudgeEmail(nudger(), day(0)), null);
  assert.equal(dueStudyNudgeEmail(nudger(), day(1)), null);
  assert.deepEqual(dueStudyNudgeEmail(nudger(), day(2)), { key: 'nudge_2026-11-01_d2', step: 2 });
});

test('a missed run sends the step late inside its window, once', () => {
  // Day 4 is inside the d3 window (3–4); d5 starts the next.
  assert.equal(dueStudyNudgeEmail(nudger({ sent: new Set(['nudge_2026-11-01_d2']) }), day(4)).step, 3);
  assert.equal(dueStudyNudgeEmail(nudger({ sent: new Set(['nudge_2026-11-01_d3']) }), day(4)), null);
});

test('coming back resets the schedule', () => {
  const back = nudger({ progress: { lastStudied: '2026-11-08T09:00:00Z' }, sent: new Set(['nudge_2026-11-01_d2', 'nudge_2026-11-01_d3']) });
  // Studied 8 Nov (day 7): nothing that day or the next, then d2 on 10 Nov.
  assert.equal(dueStudyNudgeEmail(back, day(7)), null);
  assert.equal(dueStudyNudgeEmail(back, day(8)), null);
  assert.equal(dueStudyNudgeEmail(back, day(9)).key, 'nudge_2026-11-08_d2');
});

test('stops after day 60, after the test date, and when opted out', () => {
  assert.equal(dueStudyNudgeEmail(nudger(), day(70)), null);
  assert.equal(dueStudyNudgeEmail(nudger({ progress: { lastStudied: LAST, testDate: '2026-11-04T00:00:00Z' } }), day(5)), null);
  assert.notEqual(dueStudyNudgeEmail(nudger({ progress: { lastStudied: LAST, testDate: '2026-11-06T00:00:00Z' } }), day(5)), null);
  assert.equal(dueStudyNudgeEmail(nudger({ optedOut: true }), day(2)), null);
});

test('never within 20 hours of another email', () => {
  const recent = new Date(day(2).getTime() - 5 * 3_600_000).toISOString();
  assert.equal(dueStudyNudgeEmail(nudger({ lastEmailAt: recent }), day(2)), null);
  const older = new Date(day(2).getTime() - 24 * 3_600_000).toISOString();
  assert.equal(dueStudyNudgeEmail(nudger({ lastEmailAt: older }), day(2)).step, 2);
});

test('falls back to the signup time for someone who never studied', () => {
  const fresh = nudger({ signedUpAt: LAST, progress: {} });
  assert.equal(dueStudyNudgeEmail(fresh, day(2)).key, 'nudge_2026-11-01_d2');
});

test('study reminder copy: varies, Pro-aware, last one says it is the last, unsubscribe in every one', () => {
  const ctx = { name: 'Sam', progress: {}, unsubUrl: 'https://api.example/u', now: day(2) };
  const subjects = NUDGE_EMAIL_DAYS.map(s => buildStudyNudgeEmail(s, ctx).subject);
  for (let i = 1; i < subjects.length; i++) assert.notEqual(subjects[i], subjects[i - 1]);
  assert.match(buildStudyNudgeEmail(2, ctx).subject, /10 free questions/);
  assert.doesNotMatch(buildStudyNudgeEmail(2, { ...ctx, progress: { isPro: true } }).subject, /free/);
  assert.match(buildStudyNudgeEmail(60, ctx).text, /last reminder/);
  for (const s of NUDGE_EMAIL_DAYS) {
    const e = buildStudyNudgeEmail(s, ctx);
    assert.match(e.html, /https:\/\/api\.example\/u/);
    assert.match(e.text, /Unsubscribe: https:\/\/api\.example\/u/);
    assert.ok(e.subject.length > 0 && e.subject.length < 70);
  }
});

// ─── Instructor payouts announcement ─────────────────────────────────────────
const { dueInstructorAnnouncement, INSTRUCTOR_PAYOUTS_ANNOUNCEMENT } = require('./lifecycleEmails');

test('payouts announcement: once, to existing instructors, inside its window', () => {
  const now = new Date('2026-11-05T10:10:00Z');
  const base = { signedUpAt: '2026-09-20T10:00:00Z', optedOut: false, sent: new Set() };
  assert.equal(dueInstructorAnnouncement(base, now), 'instructor_payouts_live');
  assert.equal(dueInstructorAnnouncement({ ...base, sent: new Set(['instructor_payouts_live']) }, now), null);
  assert.equal(dueInstructorAnnouncement({ ...base, optedOut: true }, now), null);
  // Signed up after the announcement: they learn about payouts in the app.
  assert.equal(dueInstructorAnnouncement({ ...base, signedUpAt: '2026-11-06T09:00:00Z' }, now), null);
  // Window closed.
  assert.equal(dueInstructorAnnouncement(base, new Date(INSTRUCTOR_PAYOUTS_ANNOUNCEMENT.sendUntil)), null);
});

test('payouts announcement copy: code, steps, dashboard link, unsubscribe', () => {
  const e = buildLifecycleEmail('instructor_payouts_live', { name: 'Sam', instructorCode: 'ADISAM1', unsubUrl: 'https://api.example/u' });
  assert.equal(e.subject, 'You can now get paid for ClearPass referrals');
  assert.match(e.html, /ADISAM1/);
  assert.match(e.text, /30% of what ClearPass receives/);
  assert.match(e.text, /Set up payouts/);
  assert.match(e.text, /instructors\.getclearpass\.co\.uk\/dashboard/);
  assert.match(e.text, /Unsubscribe: https:\/\/api\.example\/u/);
  const noCode = buildLifecycleEmail('instructor_payouts_live', { unsubUrl: 'https://api.example/u' });
  assert.match(noCode.text, /Your code is on your dashboard/);
});
