'use strict';

const crypto = require('crypto');

const SEAT_DURATION_DAYS = 90;

// 128 bits of entropy from Node's CSPRNG, base64url-encoded — unlike
// accountCodes.ts's 3-letter+3-digit codes (fine for a referral code
// someone reads aloud, not for a single-use £5.99 bearer credential in a
// URL), this must be infeasible to guess or enumerate. Generated
// server-side only.
function generateSeatToken() {
  return crypto.randomBytes(16).toString('base64url');
}

function computeSeatExpiresAt(fromDate = new Date()) {
  const d = new Date(fromDate);
  const expires = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() + SEAT_DURATION_DAYS,
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds()
  ));
  return expires.toISOString();
}

// Distinguishes a seat purchase from the existing Pro-purchase checkout
// within the single shared /api/webhook — Stripe has only one
// checkout.session.completed endpoint registered for this account, so both
// flows land in the same handler and branch on this.
function isSeatPurchaseSession(session) {
  return session?.metadata?.type === 'seat';
}

// Classifies a learner's CURRENT Pro status for the redemption decision.
// - 'permanent': comp or instructor sourced. Both are exempt from expiry
//   (entitlement.js's isExemptFromProExpiry) regardless of whatever
//   proExpiresAt happens to hold, so their access never lapses on its own
//   — there is nothing for a seat to usefully add.
// - 'active': stripe or seat sourced, and genuinely not expired yet.
// - 'none': no Pro at all, OR isPro is true with a stripe/seat source
//   whose proExpiresAt has already passed. expire-pro runs on a schedule,
//   not instantly, so a user can sit in isPro:true with a past
//   proExpiresAt for up to a day. Treating that window as 'active' would
//   extend a seat from an already-past date, producing an expiry EARLIER
//   than a fresh 90-day grant would — worse for the learner and worse
//   value for the instructor's purchase than just granting fresh. Their
//   access wasn't real at the moment of redemption, so there's nothing
//   genuine to extend.
function classifyExistingPro(currentProgress, nowIso) {
  const { isPro, proExpiresAt, proSource } = currentProgress || {};
  if (!isPro) return 'none';
  if (proSource === 'comp' || proSource === 'instructor') return 'permanent';
  if ((proSource === 'stripe' || proSource === 'seat') && proExpiresAt && proExpiresAt >= nowIso) {
    return 'active';
  }
  return 'none';
}

// The full redemption entitlement decision.
// - 'permanent' -> action: 'skip'. The seat must NOT be consumed — the
//   caller must not touch instructor_seats or user_progress at all.
//   Redeeming it would burn the instructor's £5.99 for a learner who
//   already has unconditional access; the seat stays unredeemed and the
//   link remains valid for later.
// - 'active' -> action: 'grant', extended: true. proExpiresAt is computed
//   from the learner's CURRENT proExpiresAt, not from now — the 90 days
//   stacks onto their existing timeline instead of overlapping and
//   discarding it.
// - 'none' -> action: 'grant', extended: false. Fresh 90 days from now.
function resolveSeatGrant(currentProgress, nowIso) {
  const classification = classifyExistingPro(currentProgress, nowIso);

  if (classification === 'permanent') {
    return { action: 'skip', extended: false, proExpiresAt: null, updatedProgress: null };
  }

  const baseDate = classification === 'active' ? new Date(currentProgress.proExpiresAt) : new Date(nowIso);
  const proExpiresAt = computeSeatExpiresAt(baseDate);

  return {
    action: 'grant',
    extended: classification === 'active',
    proExpiresAt,
    updatedProgress: { ...currentProgress, isPro: true, proExpiresAt, proSource: 'seat' },
  };
}

// Given the seat row looked up by invite_token (or null if it doesn't
// exist), decides whether the caller should stop here — token invalid,
// already redeemed by someone else, or an idempotent retry of the caller's
// own earlier redemption — or proceed to the resolveSeatGrant decision
// above. Returns null for "proceed, seat is unredeemed". Used both for the
// initial lookup and for the re-check after a losing race on the atomic
// claim, so the same rules apply either way.
function resolveSeatLookupOutcome(seat, userId) {
  if (!seat) {
    return { httpStatus: 404, body: { error: 'invalid_token' } };
  }
  if (seat.redeemed_at) {
    if (seat.redeemed_by === userId) {
      // Idempotent retry by the rightful redeemer (double-click, network
      // retry) — the original request already succeeded.
      return {
        httpStatus: 200,
        body: { redeemed: true, alreadyRedeemed: true, proExpiresAt: seat.pro_expires_at ?? null },
      };
    }
    return { httpStatus: 409, body: { error: 'already_redeemed' } };
  }
  return null;
}

module.exports = {
  SEAT_DURATION_DAYS,
  generateSeatToken,
  computeSeatExpiresAt,
  isSeatPurchaseSession,
  classifyExistingPro,
  resolveSeatGrant,
  resolveSeatLookupOutcome,
};
