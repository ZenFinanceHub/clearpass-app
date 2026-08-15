'use strict';

const crypto = require('crypto');
const { shouldApplyProGrant } = require('./entitlement');

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

// What happens at redemption if the learner already has Pro from another
// source. The seat still binds to them either way (see resolveRedeemOutcome
// — "no transfer, no reuse" means the redemption ATTEMPT consumes it,
// independent of whether it changes their entitlement). Only the grant
// itself defers to the existing source-priority rule, so a learner who
// already paid, was comped, or is an instructor keeps that entitlement
// completely untouched.
function resolveSeatGrant(currentProgress, proExpiresAtIso) {
  const granted = shouldApplyProGrant(currentProgress.proSource, 'seat');
  if (!granted) {
    return { granted: false, updatedProgress: currentProgress };
  }
  return {
    granted: true,
    updatedProgress: {
      ...currentProgress,
      isPro: true,
      proExpiresAt: proExpiresAtIso,
      proSource: 'seat',
    },
  };
}

// Decides the redemption endpoint's HTTP response from the two possible DB
// read outcomes: `claimed` is the row if the atomic
// `UPDATE ... WHERE redeemed_at IS NULL` succeeded (fresh redemption);
// `existing` is the row as it stands if that update affected zero rows
// (already redeemed by someone, or the token doesn't exist at all).
function resolveRedeemOutcome({ claimed, existing, userId, granted, proExpiresAt }) {
  if (claimed) {
    return {
      httpStatus: 200,
      body: {
        redeemed: true,
        granted: !!granted,
        proExpiresAt: granted ? proExpiresAt : null,
      },
    };
  }

  if (!existing) {
    return { httpStatus: 404, body: { error: 'invalid_token' } };
  }

  if (existing.redeemed_by === userId) {
    // Idempotent retry by the rightful redeemer (double-click, network
    // retry) — the original request already succeeded.
    return {
      httpStatus: 200,
      body: { redeemed: true, alreadyRedeemed: true, proExpiresAt: existing.pro_expires_at ?? null },
    };
  }

  return { httpStatus: 409, body: { error: 'already_redeemed' } };
}

module.exports = {
  SEAT_DURATION_DAYS,
  generateSeatToken,
  computeSeatExpiresAt,
  isSeatPurchaseSession,
  resolveSeatGrant,
  resolveRedeemOutcome,
};
