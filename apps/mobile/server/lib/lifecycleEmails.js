'use strict';

// Lifecycle emails: the short sequence every new learner and instructor gets
// after signing up. Pure functions only (which email is due, what it says,
// unsubscribe tokens) so they can be tested with plain Node; the sending,
// logging and Supabase reads live in proxy.js (POST /api/cron/lifecycle-emails).
//
// How a run works: once a day the cron looks at everyone who signed up since
// the cohort start, works out the single email (if any) due for each of them,
// and sends it. public.email_log records every send, so a step is never sent
// twice, however often the cron runs. Each step has a window (e.g. days 2–4
// after signup); a step missed inside its window is skipped, never sent late,
// so a cron outage can't cause a burst of stale emails.
//
// PECR: these rely on the "soft opt-in" (similar products, opt-out offered at
// signup and in every message). Anyone opted out (email_preferences, or
// user_metadata.marketing_opt_out ticked at signup) gets nothing from here.

const crypto = require('crypto');

const DAY_MS = 86_400_000;

// Nobody who signed up before the sequence existed is enrolled, so switching
// it on doesn't email the whole back catalogue at once.
const LEARNER_COHORT_START = '2026-10-22T00:00:00Z';
const INSTRUCTOR_COHORT_START = '2026-10-22T00:00:00Z';
// The first web instructor of 22 Oct already had a hand-written welcome at
// 12:15 BST; the automated welcome starts after that.
const INSTRUCTOR_WELCOME_START = '2026-10-22T13:00:00Z';

const SITE_URL = 'https://getclearpass.co.uk';
const WEB_APP_URL = 'https://clearpass-app.vercel.app';
const INSTRUCTOR_DASHBOARD_URL = 'https://instructors.getclearpass.co.uk/dashboard';

// [key, firstDay, lastDay] — days since signup, inclusive.
const LEARNER_STEPS = [
  ['learner_welcome', 0, 1],
  ['learner_comeback', 2, 4],
  ['learner_mock', 5, 8],
  ['learner_pro', 9, 13],
];
const INSTRUCTOR_STEPS = [
  ['instructor_welcome', 0, 2],
  ['instructor_share', 3, 6],
  ['instructor_seats', 7, 13],
  ['instructor_checkin', 14, 20],
];

function daysSince(iso, now) {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS);
}

function londonDay(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

function inWindow(steps, key, day) {
  const s = steps.find(([k]) => k === key);
  return !!s && day >= s[1] && day <= s[2];
}

/**
 * The learner email due now, or null.
 * learner: { signedUpAt, progress, optedOut, sent: Set<string> }
 */
function dueLearnerEmail(learner, now) {
  if (learner.optedOut) return null;
  if (new Date(learner.signedUpAt) < new Date(LEARNER_COHORT_START)) return null;
  const day = daysSince(learner.signedUpAt, now);
  const p = learner.progress || {};
  const isPro = p.isPro === true;
  // lastStudied starts out as the account's creation time, so "came back" means
  // studied on a later (UK) day than the one they signed up on.
  const cameBack = !!p.lastStudied && londonDay(p.lastStudied) > londonDay(learner.signedUpAt);
  const hasMock = Array.isArray(p.mockTestHistory) && p.mockTestHistory.length > 0;

  const eligible = {
    learner_welcome: true,
    learner_comeback: !cameBack && !isPro,
    learner_mock: !hasMock && !isPro,
    learner_pro: !isPro,
  };
  for (const [key] of LEARNER_STEPS) {
    if (learner.sent.has(key)) continue;
    if (inWindow(LEARNER_STEPS, key, day) && eligible[key]) return key;
  }
  return null;
}

/**
 * The instructor email due now, or null.
 * instructor: { signedUpAt, pupils, seatsBought, optedOut, sent: Set<string> }
 */
function dueInstructorEmail(instructor, now) {
  if (instructor.optedOut) return null;
  if (new Date(instructor.signedUpAt) < new Date(INSTRUCTOR_COHORT_START)) return null;
  const day = daysSince(instructor.signedUpAt, now);
  const pupils = instructor.pupils || 0;
  const seats = instructor.seatsBought || 0;

  const eligible = {
    instructor_welcome: new Date(instructor.signedUpAt) >= new Date(INSTRUCTOR_WELCOME_START),
    instructor_share: pupils === 0,
    // Seats only make sense to someone who already has pupils on ClearPass.
    instructor_seats: pupils > 0 && seats === 0,
    instructor_checkin: seats === 0,
  };
  for (const [key] of INSTRUCTOR_STEPS) {
    if (instructor.sent.has(key)) continue;
    if (inWindow(INSTRUCTOR_STEPS, key, day) && eligible[key]) return key;
  }
  return null;
}

// ─── Study reminder emails ─────────────────────────────────────────────────
// For learners who have stopped studying, on web or phone. Runs alongside the
// welcome sequence above (which always wins on the day it has something due)
// and covers everyone, not just the 22 Oct cohort, as long as they studied
// (or signed up) in the last two months.
//
// Days since they last studied (UK days). Each step has a window up to the
// next one, so a missed cron run sends the step late within its window, and
// a learner who comes back resets the whole schedule (the key includes the
// day they last studied). After day 60 we stop.
const NUDGE_EMAIL_DAYS = [2, 3, 5, 7, 10, 14, 21, 30, 45, 60];
const NUDGE_EMAIL_LAST_WINDOW_END = 67;
// Never two emails to the same person within this long, whatever sent them.
const MIN_HOURS_BETWEEN_EMAILS = 20;

function londonDayIndex(dateOrIso) {
  const [y, m, d] = londonDay(dateOrIso).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/**
 * The study reminder email due now, or null.
 * learner: { signedUpAt, progress, optedOut, sent: Set<string>, lastEmailAt?: string|null }
 * Returns { key, step } — key is unique per break (e.g. nudge_2026-11-01_d3).
 */
function dueStudyNudgeEmail(learner, now) {
  if (learner.optedOut) return null;
  const p = learner.progress || {};
  const lastActive = p.lastStudied || learner.signedUpAt;
  if (!lastActive || isNaN(new Date(lastActive).getTime())) return null;

  // Nothing once the test has been and gone.
  if (p.testDate && !isNaN(new Date(p.testDate).getTime()) && londonDayIndex(p.testDate) < londonDayIndex(now)) return null;

  if (learner.lastEmailAt && now.getTime() - new Date(learner.lastEmailAt).getTime() < MIN_HOURS_BETWEEN_EMAILS * 3_600_000) return null;

  const inactive = londonDayIndex(now) - londonDayIndex(lastActive);
  let i = -1;
  for (let j = 0; j < NUDGE_EMAIL_DAYS.length; j++) if (NUDGE_EMAIL_DAYS[j] <= inactive) i = j;
  if (i === -1) return null;
  const windowEnd = NUDGE_EMAIL_DAYS[i + 1] ?? NUDGE_EMAIL_LAST_WINDOW_END;
  if (inactive >= windowEnd) return null;

  const step = NUDGE_EMAIL_DAYS[i];
  const key = `nudge_${londonDay(lastActive)}_d${step}`;
  if (learner.sent.has(key)) return null;
  return { key, step };
}

// ─── Unsubscribe tokens ─────────────────────────────────────────────────────
// Derived from the service key rather than a separate secret, so there is no
// extra variable to manage. Rotating the service key invalidates old links,
// which only means an old email's link shows "this link has expired".

function unsubscribeToken(userId, serviceKey) {
  if (!serviceKey) throw new Error('service key missing');
  const key = crypto.createHmac('sha256', serviceKey).update('clearpass-unsubscribe-v1').digest();
  return crypto.createHmac('sha256', key).update(String(userId)).digest('base64url').slice(0, 32);
}

function verifyUnsubscribeToken(userId, token, serviceKey) {
  if (typeof userId !== 'string' || typeof token !== 'string' || token.length !== 32) return false;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false;
  const expected = unsubscribeToken(userId, serviceKey);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

function unsubscribeUrl(apiBase, userId, serviceKey) {
  return `${apiBase}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId, serviceKey)}`;
}

// ─── Templates ──────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function appLink(campaign) {
  return `${SITE_URL}/app?ref=${encodeURIComponent(campaign)}`;
}

function layout({ preheader, bodyHtml, cta, unsubUrl, footerNote }) {
  const button = cta
    ? `<tr><td style="padding:8px 32px 28px;">
        <a href="${esc(cta.href)}" style="display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px;">${esc(cta.label)}</a>
      </td></tr>`
    : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ClearPass</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:28px 12px;"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;max-width:560px;width:100%;">
    <tr><td style="padding:26px 32px 4px;font-size:20px;font-weight:900;letter-spacing:1px;color:#4F46E5;">ClearPass</td></tr>
    <tr><td style="padding:12px 32px 8px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
    ${button}
  </table>
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;"><tr><td style="padding:16px 32px;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;">
    ${footerNote ? esc(footerNote) + '<br>' : ''}ClearPass, Zengus Ventures Ltd, 28 Barbieston Road, Dalrymple, KA6 6DZ<br>
    <a href="${esc(unsubUrl)}" style="color:#9ca3af;">Unsubscribe from these emails</a>
  </td></tr></table>
</td></tr></table>
</body></html>`;
}

function p(text) {
  return `<p style="margin:0 0 14px;">${text}</p>`;
}

function list(items) {
  return `<ol style="margin:0 0 14px;padding-left:22px;">${items.map(i => `<li style="margin:0 0 6px;">${i}</li>`).join('')}</ol>`;
}

function daysToTest(testDate, now) {
  if (!testDate) return null;
  const d = Math.ceil((new Date(testDate).getTime() - now.getTime()) / DAY_MS);
  return Number.isFinite(d) && d >= 0 ? d : null;
}

/**
 * Build one email. ctx: { name, progress, instructorCode, pupils, unsubUrl, now }
 * Returns { subject, html, text } — text is the plain-text alternative.
 */
function buildLifecycleEmail(key, ctx) {
  const hi = ctx.name ? `Hi ${esc(ctx.name)},` : 'Hi,';
  const now = ctx.now || new Date();
  const unsubUrl = ctx.unsubUrl;
  const toTest = daysToTest(ctx.progress?.testDate, now);
  const learnerFooter = 'You’re getting this because you signed up to ClearPass.';
  const instructorFooter = 'You’re getting this because you created a ClearPass instructor account.';

  switch (key) {
    case 'learner_welcome':
      return finish({
        subject: 'Welcome to ClearPass: your first 10 minutes',
        preheader: 'Three quick things that make the biggest difference.',
        bodyHtml: [
          p(hi),
          p('Welcome to ClearPass. Here’s the quickest way to get going:'),
          list([
            '<b>Answer your 10 free questions today.</b> Every question comes from ClearPass’s DVSA-licensed question bank, with an explanation if you get it wrong.',
            '<b>Add your test date</b> (Settings, if you skipped it). Your study plan and countdown are built around it.',
            '<b>Turn on study reminders.</b> One nudge a day at a time that suits you, and none on days you’ve already studied.',
          ]),
          p('Little and often beats cramming. Ten minutes a day is plenty to start with.'),
          p('Good luck,<br>The ClearPass team'),
        ].join(''),
        cta: { label: 'Start practising', href: appLink('email-welcome') },
        unsubUrl, footerNote: learnerFooter,
      });

    case 'learner_comeback':
      return finish({
        subject: 'Your 10 free questions are waiting',
        preheader: 'Five minutes today keeps what you learned fresh.',
        bodyHtml: [
          p(hi),
          p(`You made a start on ClearPass${toTest !== null ? `, and your theory test is ${toTest === 1 ? 'tomorrow' : `${toTest} days away`}` : ''}. Today’s 10 free questions are ready for you.`),
          p('What you learn fades fastest in the first few days, so a short session now does more than a long one next week. ClearPass also brings back the questions you got wrong, so every session targets your weak spots.'),
          p('The ClearPass team'),
        ].join(''),
        cta: { label: 'Do today’s questions', href: appLink('email-comeback') },
        unsubUrl, footerNote: learnerFooter,
      });

    case 'learner_mock':
      return finish({
        subject: 'Try a mock theory test (free)',
        preheader: 'Find out where you stand in under half an hour.',
        bodyHtml: [
          p(hi),
          p('Want to know where you stand? Your first <b>Quick Mock is free</b>: 25 questions against the clock in 28 minutes, and you need 22 to pass. It’s timed and marked like the real test, at half the length.'),
          p('At the end you’ll see your score and which questions you got wrong, so you know what to work on before the real thing.'),
          p('Over half of people fail their car theory test (DVSA, 2025–26). A mock is the best way to make sure you’re not one of them.'),
          p('The ClearPass team'),
        ].join(''),
        cta: { label: 'Take my free mock', href: appLink('email-mock') },
        unsubUrl, footerNote: learnerFooter,
      });

    case 'learner_pro':
      return finish({
        subject: toTest !== null && toTest <= 60 ? `${toTest} days to your theory test: unlock everything` : 'Ready to step it up? ClearPass Pro',
        preheader: 'Unlimited questions, every mock test and hazard perception clips.',
        bodyHtml: [
          p(hi),
          p('Free gets you 10 questions a day. ClearPass Pro takes the limit off:'),
          `<ul style="margin:0 0 14px;padding-left:22px;">${[
            'Unlimited practice from the full DVSA-licensed question bank',
            'Unlimited full-length and quick mock tests',
            'Hazard perception practice clips',
            'More help from Pip, your AI tutor, on anything you’re stuck on',
          ].map(i => `<li style="margin:0 0 6px;">${i}</li>`).join('')}</ul>`,
          p('<b>£2.99 a month</b> (cancel anytime) or <b>£7.99 for 3 months</b>, which covers most people right up to their test.'),
          p('The ClearPass team'),
        ].join(''),
        cta: { label: 'See ClearPass Pro', href: appLink('email-pro') },
        unsubUrl, footerNote: learnerFooter,
      });

    case 'instructor_welcome':
      return finish({
        subject: 'Welcome to ClearPass for instructors',
        preheader: 'How to get your pupils linked, and what you’ll see.',
        bodyHtml: [
          p(hi),
          p('Thanks for joining ClearPass. Your instructor account is free, and you get ClearPass Pro yourself.'),
          p('<b>Getting pupils linked takes a minute:</b>'),
          list([
            'Your pupil downloads ClearPass (free) on iPhone or Android.',
            `In the app they go to <b>Settings → Linked Instructors</b> and enter your instructor code${ctx.instructorCode ? `: <b style="font-size:17px;letter-spacing:1px;">${esc(ctx.instructorCode)}</b>` : ' (it’s on your dashboard)'}.`,
            'Once they accept, you’ll see their progress, readiness score and mock test results on your dashboard.',
          ]),
          p('That means you know who’s ready to book their theory test, and you can spend lesson time on driving instead of theory.'),
          p('Any questions, just reply to this email.'),
          p('Craig<br>ClearPass'),
        ].join(''),
        cta: { label: 'Open my dashboard', href: INSTRUCTOR_DASHBOARD_URL },
        unsubUrl, footerNote: instructorFooter,
      });

    case 'instructor_share':
      return finish({
        subject: '3 easy ways to get your pupils on ClearPass',
        preheader: 'A message you can copy, plus two other quick ideas.',
        bodyHtml: [
          p(hi),
          p('None of your pupils have linked up yet. Here are three ways instructors are doing it:'),
          list([
            `<b>Send a quick message.</b> Copy this into WhatsApp:<br><span style="display:block;margin-top:6px;padding:10px 12px;background:#f3f4f6;border-radius:8px;font-size:14px;">Hi! I use ClearPass for theory test practice. It’s free: ${esc(appLink('instructor-share'))}. Once it’s installed, go to Settings → Linked Instructors and enter my code ${ctx.instructorCode ? esc(ctx.instructorCode) : '[your code]'} so I can see how you’re getting on.</span>`,
            '<b>Do it at the start of a lesson.</b> It takes two minutes in the car before you set off.',
            '<b>Mention it when you book new pupils</b>, so theory prep starts on day one.',
          ]),
          p('Craig<br>ClearPass'),
        ].join(''),
        cta: { label: 'Open my dashboard', href: INSTRUCTOR_DASHBOARD_URL },
        unsubUrl, footerNote: instructorFooter,
      });

    case 'instructor_seats': {
      const n = ctx.pupils || 0;
      return finish({
        subject: 'Give your pupils ClearPass Pro for £5.99',
        preheader: 'Three months of Pro per pupil, bought from your dashboard.',
        bodyHtml: [
          p(hi),
          p(`You’ve got ${n === 1 ? 'a pupil' : `${n} pupils`} on ClearPass, great start.`),
          p('On the free plan they get 10 questions a day. If you’d like them to have everything (unlimited questions, every mock test and hazard perception clips), you can buy them a <b>Pro seat for £5.99</b>. That’s 3 months of Pro, less than the £7.99 they’d pay themselves.'),
          p('Some instructors add it to a lesson block or first-lesson package, so the pupil gets it “free” and you know they’re working on their theory between lessons.'),
          p('Seats are bought from your dashboard. You send the pupil a link and Pro switches on when they open it.'),
          p('Craig<br>ClearPass'),
        ].join(''),
        cta: { label: 'Buy a seat', href: INSTRUCTOR_DASHBOARD_URL },
        unsubUrl, footerNote: instructorFooter,
      });
    }

    case 'instructor_checkin':
      return finish({
        subject: 'Quick question',
        preheader: 'Is ClearPass working for you and your pupils?',
        plain: true,
        bodyHtml: [
          p(hi),
          p('It’s been a couple of weeks since you joined ClearPass, so I wanted to check in.'),
          p('Is anything getting in the way of using it with your pupils? Anything missing that would make it more useful to you?'),
          p('Just reply. I read every one and it goes straight into what we build next.'),
          p('Thanks,<br>Craig<br>Founder, ClearPass'),
        ].join(''),
        unsubUrl, footerNote: instructorFooter,
      });

    default:
      throw new Error(`unknown lifecycle email: ${key}`);
  }
}

/**
 * A study reminder email. ctx: { name, progress, unsubUrl, now }
 * Copy rotates by step so nobody gets the same email twice in a row.
 */
function buildStudyNudgeEmail(step, ctx) {
  const hi = ctx.name ? `Hi ${esc(ctx.name)},` : 'Hi,';
  const now = ctx.now || new Date();
  const progress = ctx.progress || {};
  const isPro = progress.isPro === true;
  const toTest = daysToTest(progress.testDate, now);
  const answered = progress.totalQuestionsAnswered || 0;
  const footerNote = 'You’re getting study reminders because you signed up to ClearPass.';
  const cta = (label, campaign) => ({ label, href: appLink(`email-nudge-d${step}-${campaign}`) });
  const sign = p('The ClearPass team');
  const testLine = toTest === null ? '' : toTest === 0 ? ' Your theory test is today, good luck!' : toTest === 1 ? ' Your theory test is tomorrow.' : ` Your theory test is ${toTest} days away.`;
  const last = step === NUDGE_EMAIL_DAYS[NUDGE_EMAIL_DAYS.length - 1];

  if (last) {
    return finish({
      subject: 'Still preparing for your theory test?',
      preheader: 'Your progress is saved whenever you’re ready.',
      bodyHtml: [
        p(hi),
        p(`It’s been a while since your last ClearPass session.${testLine} Everything you’ve done so far is saved${answered ? `, including the ${answered} questions you’ve answered` : ''}.`),
        p('This is the last reminder we’ll send unless you pick it back up. Whenever you’re ready, ten minutes is all it takes to get going again.'),
        sign,
      ].join(''),
      cta: cta('Pick up where I left off', 'last'), unsubUrl: ctx.unsubUrl, footerNote,
    });
  }

  const variants = [
    () => ({
      subject: isPro ? 'Today’s theory practice is ready' : 'Your 10 free questions are ready',
      preheader: 'Five minutes today keeps what you learned fresh.',
      bodyHtml: [
        p(hi),
        p(`${isPro ? 'Today’s practice is' : 'Today’s 10 free questions are'} ready for you.${testLine}`),
        p('A short session now does more than a long one next week. ClearPass brings back the questions you got wrong, so every session works on your weak spots.'),
        sign,
      ].join(''),
      cta: cta('Do today’s questions', 'ready'),
    }),
    () => (toTest !== null && toTest > 1
      ? {
        subject: `${toTest} days to your theory test`,
        preheader: 'Ten questions a day adds up fast.',
        bodyHtml: [
          p(hi),
          p(`Your theory test is <b>${toTest} days away</b>. Ten questions a day between now and then covers a lot of ground, and it’s much easier than cramming the night before.`),
          sign,
        ].join(''),
        cta: cta('Practise now', 'countdown'),
      }
      : {
        subject: 'Road signs: the easiest marks on the test',
        preheader: 'A quick session on signs is an easy win.',
        bodyHtml: [
          p(hi),
          p('Road signs come up in every theory test, and they’re some of the easiest marks to pick up. A quick session on them today is an easy win.'),
          sign,
        ].join(''),
        cta: cta('Practise road signs', 'signs'),
      }),
    () => ({
      subject: 'Pick up where you left off',
      preheader: 'Your progress is saved.',
      bodyHtml: [
        p(hi),
        p(`Your ClearPass progress is saved${answered ? `: ${answered} questions answered so far` : ''}.${testLine}`),
        p('Little and often is the best way to prepare. Ten minutes today keeps you on track.'),
        sign,
      ].join(''),
      cta: cta('Carry on practising', 'progress'),
    }),
    () => ({
      subject: 'How would you do on the real test?',
      preheader: 'A quick mock shows where you stand.',
      bodyHtml: [
        p(hi),
        p(`A mock test is the quickest way to see where you stand: timed and marked like the real thing.${isPro ? '' : ' Your first Quick Mock is free.'}`),
        p('At the end you’ll see exactly which topics to work on.'),
        sign,
      ].join(''),
      cta: cta('Take a mock test', 'mock'),
    }),
  ];
  const idx = NUDGE_EMAIL_DAYS.indexOf(step);
  const v = variants[(idx < 0 ? 0 : idx) % variants.length]();
  return finish({ ...v, unsubUrl: ctx.unsubUrl, footerNote });
}

function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|ol|ul|span)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function finish({ subject, preheader, bodyHtml, cta, unsubUrl, footerNote, plain }) {
  const html = plain
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;max-width:560px;margin:0;padding:16px;">${bodyHtml}<p style="font-size:12px;color:#9ca3af;margin-top:28px;">${esc(footerNote)} <a href="${esc(unsubUrl)}" style="color:#9ca3af;">Unsubscribe</a></p></body></html>`
    : layout({ preheader, bodyHtml, cta, unsubUrl, footerNote });
  const text = `${htmlToText(bodyHtml)}${cta ? `\n\n${cta.label}: ${cta.href}` : ''}\n\n---\n${footerNote}\nUnsubscribe: ${unsubUrl}`;
  return { subject, html, text };
}

module.exports = {
  LEARNER_COHORT_START,
  INSTRUCTOR_COHORT_START,
  INSTRUCTOR_WELCOME_START,
  LEARNER_STEPS,
  INSTRUCTOR_STEPS,
  WEB_APP_URL,
  dueLearnerEmail,
  dueInstructorEmail,
  dueStudyNudgeEmail,
  buildStudyNudgeEmail,
  NUDGE_EMAIL_DAYS,
  unsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeUrl,
  buildLifecycleEmail,
};
