'use strict';

const { shouldApplyProGrant } = require('./entitlement');
const { computeProExpiresAt } = require('./proExpiry');

// Computes the user_progress patch for a Stripe checkout.session.completed
// grant. Pure. Stripe's event carries no expiration timestamp of its own —
// unlike RevenueCat's expiration_at_ms — so a fresh period is always
// computeProExpiresAt() from now, gated the same way (shouldApplyProGrant)
// as every other source. Returns null for "no change" (an existing grant
// outranks stripe), same convention as resolveRevenueCatUpdate's progress
// field.
function resolveStripeProGrant(currentProgress) {
  if (!shouldApplyProGrant(currentProgress.proSource, 'stripe')) {
    return null;
  }
  return { isPro: true, proExpiresAt: computeProExpiresAt(), proSource: 'stripe' };
}

// Applies one Stripe checkout.session.completed grant end to end, using the
// same db-adapter shape as revenuecatWebhook.js's applyTransfer/
// applySingleUserUpdate:
//   - getProgress(userId) -> Promise<object|null>   (MUST throw on a real
//     read error, never return null/undefined for that — see below)
//   - upsertProgress(userId, progress) -> Promise<{ error: any }>
//   - deleteWebhookEvent(eventId) -> Promise<void>   (only called on failure)
//
// A read error aborts before any write and signals retry — the bug this
// replaces silently treated a failed read as "no row" ({}), then upserted
// THAT as the user's entire progress, wiping out everything else in it
// (mock test history, XP, streaks, ...) down to just the patch fields.
async function applyStripeProGrant(event, userId, db) {
  let currentProgress;
  try {
    currentProgress = (await db.getProgress(userId)) || {};
  } catch (err) {
    console.error('[webhook] read failed for', userId, '—', err.message || err);
    await safeDeleteWebhookEvent(db, event.id);
    return { ok: false, retry: true };
  }

  const patch = resolveStripeProGrant(currentProgress);
  const updatedProgress = { ...currentProgress, ...(patch || {}) };

  const { error } = await db.upsertProgress(userId, updatedProgress);
  if (error) {
    console.error('[webhook] write failed for', userId, '—', error.message || error);
    await safeDeleteWebhookEvent(db, event.id);
    return { ok: false, retry: true };
  }
  console.log('[webhook] stripe grant applied for user', userId);
  return { ok: true };
}

// Mirrors revenuecatWebhook.js's safeDeleteWebhookEvent exactly: a failed
// delete is logged loudly (error level, with the event id) rather than
// swallowed — a dedup row left behind after a real failure means every
// retry gets silently dropped as "duplicate", with nothing in the logs to
// explain why the grant never actually landed.
async function safeDeleteWebhookEvent(db, eventId) {
  try {
    await db.deleteWebhookEvent(eventId);
  } catch (err) {
    console.error(
      `[webhook] ${eventId}: failed to delete its dedup row after a failure — a retry may be silently swallowed as "duplicate":`,
      err.message || err,
    );
  }
}

module.exports = { resolveStripeProGrant, applyStripeProGrant };
