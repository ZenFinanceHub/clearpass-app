'use strict';

const { computeIapExpiresAt } = require('./proExpiry');
const { shouldApplyProGrant, clearIapGrant, iapSourceForEnvironment, IAP_SANDBOX_SOURCE } = require('./entitlement');

// RevenueCat's expiration_at_ms is epoch milliseconds — an absolute
// end-of-period timestamp computed by the store (App Store/Play Store),
// not a relative duration. This is true regardless of product length: a
// monthly subscription's value lands ~30 days out, a quarterly one ~90
// days out, but both are real calendar timestamps for that specific
// period, not an offset to add to "now" at processing time. Returns null
// when the field is absent (undefined/null) or not a finite number.
function expirationMsToIso(expirationAtMs) {
  if (expirationAtMs === null || expirationAtMs === undefined) return null;
  const ms = Number(expirationAtMs);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

// Computes the user_progress patch for one RevenueCat webhook event, given
// the event type, its expiration_at_ms (raw, possibly absent), and the
// user's current progress. Returns { progress, warning }:
//   - progress: a partial object to merge into progress, or null for "no
//     change" (an event type not handled here, or a CANCELLATION/
//     EXPIRATION whose grant is no longer iap-sourced — a late or
//     out-of-order event must never clobber a different source applied
//     since, e.g. a manual comp grant).
//   - warning: a message the caller should log loudly (not silently) when
//     RC's own expiry data was missing and a fallback was used, or null.
//
// Trusts RC's own period management over any locally-computed guess: for
// INITIAL_PURCHASE/RENEWAL, proExpiresAt comes from expiration_at_ms, not
// computeIapExpiresAt() — RC knows the actual billing period (monthly,
// quarterly, promotional, ...), a flat duration would be wrong for
// anything other than exactly what computeIapExpiresAt() assumes.
// computeIapExpiresAt() is only a fallback for the rare case RC's payload
// doesn't include it.
//
// environment is RC's event.environment ('SANDBOX' | 'PRODUCTION'). A
// SANDBOX purchase still grants Pro (App Review / TestFlight must work) but
// is recorded as proSource 'iap_sandbox' so it never counts as revenue,
// and every event only ever acts on the grant from its OWN environment:
// a sandbox CANCELLATION/EXPIRATION can't touch a real 'iap' grant and a
// production one can't touch an 'iap_sandbox' grant. Omitted/unknown
// environment behaves exactly as before (production 'iap').
function resolveRevenueCatUpdate(eventType, expirationAtMs, currentProgress, environment) {
  const currentSource = currentProgress.proSource;
  const iapSource = iapSourceForEnvironment(environment);

  if (eventType === 'INITIAL_PURCHASE' || eventType === 'RENEWAL') {
    let incomingExpiresAt = expirationMsToIso(expirationAtMs);
    let warning = null;
    if (incomingExpiresAt === null) {
      warning = `${eventType} missing expiration_at_ms — falling back to computeIapExpiresAt()`;
      incomingExpiresAt = computeIapExpiresAt();
    }

    if (!shouldApplyProGrant(currentSource, iapSource, currentProgress.proExpiresAt, incomingExpiresAt)) {
      return { progress: null, warning };
    }

    return {
      progress: { isPro: true, proExpiresAt: incomingExpiresAt, proSource: iapSource },
      warning,
    };
  }

  if (eventType === 'CANCELLATION') {
    // Not a revocation — the user keeps access through the period they
    // already paid for. expiration_at_ms IS the end of that period; once
    // it passes, the existing expire-pro cron reconciles it naturally via
    // isEligibleForProExpiry, no special-case revocation logic needed here.
    if (currentSource !== iapSource) return { progress: null, warning: null };

    const incomingExpiresAt = expirationMsToIso(expirationAtMs);
    if (incomingExpiresAt === null) {
      return {
        progress: null,
        warning: 'CANCELLATION missing expiration_at_ms — leaving proExpiresAt untouched, not revoking early',
      };
    }
    return { progress: { proExpiresAt: incomingExpiresAt }, warning: null };
  }

  if (eventType === 'EXPIRATION') {
    // The authoritative "access has ended" signal — unlike CANCELLATION,
    // this fires when the paid period is actually over.
    if (currentSource !== iapSource) return { progress: null, warning: null };
    const cleared = clearIapGrant(currentProgress, iapSource);
    return {
      progress: { isPro: cleared.isPro, proExpiresAt: cleared.proExpiresAt, proSource: cleared.proSource },
      warning: null,
    };
  }

  // BILLING_ISSUE, PRODUCT_CHANGE, UNCANCELLATION, etc. — acknowledged by
  // the caller (so RC doesn't retry), not acted on yet. TRANSFER is handled
  // separately below, since it moves a grant between two different users
  // rather than patching one.
  return { progress: null, warning: null };
}

// RC's real app_user_ids (set from the Supabase user id at
// Purchases.configure()/logIn() — see src/purchases.ts) are standard v4
// UUIDs. Its own anonymous ids look like "$RCAnonymousID:<32 hex chars>"
// and never correspond to a user_progress row, so they're filtered out of
// both sides of a TRANSFER rather than queried for nothing.
const SUPABASE_USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSupabaseUserId(id) {
  return typeof id === 'string' && SUPABASE_USER_ID_RE.test(id);
}

// Computes the patch for one SOURCE user of a TRANSFER. Mirrors
// EXPIRATION's guard exactly: only clears if the grant is still
// iap-sourced, so a source who's since been re-granted via stripe/comp/
// instructor/seat keeps that grant untouched — a transfer moves what was
// actually theirs from RC's rails, not whatever else they have now.
// Returns null for "no change" (nothing to clear), same convention as
// resolveRevenueCatUpdate's progress field.
// iapSource ('iap' default, or 'iap_sandbox' for a SANDBOX transfer) limits
// the clear to the grant from the transfer's own environment.
function resolveTransferSourceUpdate(currentProgress, iapSource = 'iap') {
  if (currentProgress.proSource !== iapSource) return null;
  const cleared = clearIapGrant(currentProgress, iapSource);
  return { isPro: cleared.isPro, proExpiresAt: cleared.proExpiresAt, proSource: cleared.proSource };
}

// Computes the patch for one DESTINATION user of a TRANSFER. RC's TRANSFER
// event carries no expiration_at_ms of its own — the entitlement being
// moved is whatever the source(s) actually had, so the caller passes in
// sourceExpiresAt (the source's own current proExpiresAt, read before it's
// cleared). No usable expiry means nothing to grant: an open-ended Pro
// grant with no end date is exactly what this migration's trigger and this
// handler both exist to prevent, so it's refused with a warning rather
// than silently granted forever.
// Goes through the same shouldApplyProGrant precedence as every other iap
// grant, so a destination with a higher-priority existing grant (stripe,
// comp) is never downgraded.
function resolveTransferDestinationUpdate(currentProgress, sourceExpiresAt, iapSource = 'iap') {
  if (!sourceExpiresAt) {
    return {
      progress: null,
      warning: 'TRANSFER destination has no usable source proExpiresAt — not granting (no open-ended Pro)',
    };
  }
  if (!shouldApplyProGrant(currentProgress.proSource, iapSource, currentProgress.proExpiresAt, sourceExpiresAt)) {
    return { progress: null, warning: null };
  }
  return {
    progress: { isPro: true, proExpiresAt: sourceExpiresAt, proSource: iapSource },
    warning: null,
  };
}

// Deletes the dedup row for a failed event, so RevenueCat's retry isn't
// silently swallowed by the dedup check next time. If the delete itself
// fails, that's logged loudly (error level, with the event id) rather than
// swallowed — a dedup row left behind after a real failure means every
// retry gets silently dropped as "duplicate", with nothing in the logs to
// explain why the transfer never actually completed.
async function safeDeleteWebhookEvent(db, eventId) {
  try {
    await db.deleteWebhookEvent(eventId);
  } catch (err) {
    console.error(
      `[revenuecat-webhook] TRANSFER ${eventId}: failed to delete its dedup row after a failure — a retry may be silently swallowed as "duplicate":`,
      err.message || err,
    );
  }
}

// Posts to Slack and swallows any failure — a Slack outage must never
// affect the webhook's own response. slack.post(text) is expected to
// already guarantee this itself (see postToSlack in proxy.js, "never
// throws and never rejects"), but that guarantee is enforced here too
// rather than only trusted, so it holds regardless of what's injected.
async function safeSlackPost(slack, text) {
  try {
    await slack.post(text);
  } catch (err) {
    console.error('[revenuecat-webhook] Slack post failed:', err.message || err);
  }
}

// Applies one TRANSFER event end to end. db must provide:
//   - getProgress(userId) -> Promise<object|null>   (stored `progress`, or
//     null if no row exists — MUST throw/reject on an actual read error,
//     never return null for that; a swallowed read error read as "no row"
//     would let a grant or clear proceed against a stale empty {} instead
//     of the real progress object, clobbering everything else in it)
//   - upsertProgress(userId, progress) -> Promise<{ error: any }>
//   - deleteWebhookEvent(eventId) -> Promise<void>   (only called on failure)
// rcApi must provide getProEntitlement(appUserId) -> Promise<{ active,
// expiresAt }> (see lib/revenuecatApi.js). Only consulted when
// REVENUECAT_SECRET_API_KEY is set — see applyTransferViaRevenueCat below
// for why this is the primary path and applyTransferLocal is a fallback.
// slack must provide post(text) -> Promise<boolean> (see postToSlack in
// proxy.js) — only used by applyTransferViaRevenueCat, one post per
// destination outcome (granted/not granted/failed); the local fallback
// path doesn't post, since it predates this and has its own logging.
//
// Always logs the raw transferred_from/transferred_to arrays first, before
// anything else — including $RCAnonymousID values and even when there's
// nothing to do, so a no-op transfer is still traceable in the logs.
//
// Reads every source and destination row FIRST, before writing anything —
// a read error aborts before any write happens at all.
//
// On any read or write failure, this event's dedup row is deleted so
// RevenueCat's retry isn't silently swallowed by the dedup check next time.
//
// Returns { ok: true } on full success (including the "nothing to do"
// case — no Supabase-user destinations), or { ok: false, retry: true } if
// any read, write, or RevenueCat lookup failed.
async function applyTransfer(event, db, rcApi, slack) {
  const rawFrom = Array.isArray(event.transferred_from) ? event.transferred_from : [];
  const rawTo = Array.isArray(event.transferred_to) ? event.transferred_to : [];
  console.log(
    `[revenuecat-webhook] TRANSFER ${event.id}: transferred_from=${JSON.stringify(rawFrom)} transferred_to=${JSON.stringify(rawTo)}`,
  );

  const sourceIds = rawFrom.filter(isSupabaseUserId);
  const destIds = rawTo.filter(isSupabaseUserId);
  warnOnUnexpectedEnvironment(event);

  if (destIds.length === 0) {
    console.log(`[revenuecat-webhook] TRANSFER ${event.id}: no Supabase-user destinations, skipping`);
    return { ok: true };
  }

  let sourceRows;
  let destRows;
  try {
    sourceRows = await Promise.all(
      sourceIds.map(async (id) => ({ id, progress: (await db.getProgress(id)) || {} }))
    );
    destRows = await Promise.all(
      destIds.map(async (id) => ({ id, progress: (await db.getProgress(id)) || {} }))
    );
  } catch (err) {
    console.error(`[revenuecat-webhook] TRANSFER ${event.id}: read failed, aborting before any write:`, err.message || err);
    await safeSlackPost(slack, `ClearPass transfer: failed, will retry, event ${event.id}, reason read error`);
    await safeDeleteWebhookEvent(db, event.id);
    return { ok: false, retry: true };
  }

  if (!process.env.REVENUECAT_SECRET_API_KEY) {
    console.error(
      `[revenuecat-webhook] TRANSFER ${event.id}: REVENUECAT_SECRET_API_KEY not set — falling back to local source-expiry logic`,
    );
    await safeSlackPost(slack, `ClearPass transfer: RevenueCat key missing, used fallback, event ${event.id}`);
    return applyTransferLocal(event, db, sourceRows, destRows, sourceIds);
  }

  return applyTransferViaRevenueCat(event, db, rcApi, slack, sourceRows, destRows);
}

// Fallback path, used only when REVENUECAT_SECRET_API_KEY isn't set. Trusts
// whatever the source's OWN Supabase row already says about its iap grant —
// this is what missed the destination grant in the TRANSFER we actually hit
// in production (the source's local row didn't carry a future-expiry iap
// grant, even though RevenueCat itself knew the destination's entitlement
// was active), which is exactly why applyTransferViaRevenueCat above is now
// the primary path. Kept as a safety net for when the API key is missing —
// degrades to "can't determine anything new", not "grant nothing was ever
// possible".
//
// Destinations are granted BEFORE sources are cleared, deliberately — see
// applyTransferViaRevenueCat's comment for the retry-safety reasoning,
// which applies identically here.
async function applyTransferLocal(event, db, sourceRows, destRows, sourceIds) {
  const iapSource = iapSourceForEnvironment(event.environment);
  const nowIso = new Date().toISOString();
  let sourceExpiresAt = null;
  for (const { progress } of sourceRows) {
    if (progress.proSource === iapSource && progress.proExpiresAt && progress.proExpiresAt > nowIso) {
      if (!sourceExpiresAt || progress.proExpiresAt > sourceExpiresAt) {
        sourceExpiresAt = progress.proExpiresAt;
      }
    }
  }

  for (const { id, progress } of destRows) {
    const { progress: patch, warning } = resolveTransferDestinationUpdate(progress, sourceExpiresAt, iapSource);
    if (warning) {
      console.warn(`[revenuecat-webhook] ${warning} (event ${event.id}, destination ${id})`);
    }
    if (patch) {
      const { error } = await db.upsertProgress(id, { ...progress, ...patch });
      if (error) {
        console.error(`[revenuecat-webhook] TRANSFER ${event.id}: destination upsert failed for`, id, error.message || error);
        await safeDeleteWebhookEvent(db, event.id);
        return { ok: false, retry: true };
      }
      console.log(
        `[revenuecat-webhook] TRANSFER ${event.id}: granted ${iapSource} to destination`,
        id,
        'source',
        sourceIds.join(',') || '(none)',
        'expires',
        patch.proExpiresAt,
        '(local fallback)',
      );
    }
  }

  for (const { id, progress } of sourceRows) {
    const patch = resolveTransferSourceUpdate(progress, iapSource);
    if (patch) {
      const { error } = await db.upsertProgress(id, { ...progress, ...patch });
      if (error) {
        console.error(`[revenuecat-webhook] TRANSFER ${event.id}: source upsert failed for`, id, error.message || error);
        await safeDeleteWebhookEvent(db, event.id);
        return { ok: false, retry: true };
      }
      console.log(`[revenuecat-webhook] TRANSFER ${event.id}: cleared iap grant from source`, id, '(local fallback)');
    }
  }

  return { ok: true };
}

// Primary path. Asks RevenueCat directly, per user, whether the "pro"
// entitlement is active — rather than inferring it from what a Supabase
// row happens to already say, which is what applyTransferLocal does and
// what missed a real grant in production (see its comment above).
//
// Destinations are granted BEFORE sources are cleared, deliberately. This
// is what makes a retry after a partial failure safe: if a destination
// upsert (or its RC lookup) fails, no source has been touched yet, so the
// retry starts clean. If a source upsert fails AFTER its destination
// already succeeded, the retry re-grants the SAME values to the
// (already-granted) destination — harmless, since same-source
// reapplication is idempotent (see shouldApplyProGrant) — and then clears
// the source. The reverse order would have nothing left to grant from if a
// destination write failed after its source had already been cleared.
//
// The source label (iap vs iap_sandbox) comes from the TRANSFER event's own
// environment — RC's active_entitlements response doesn't say whether the
// entitlement is backed by a sandbox receipt.
async function applyTransferViaRevenueCat(event, db, rcApi, slack, sourceRows, destRows) {
  const iapSource = iapSourceForEnvironment(event.environment);
  for (const { id, progress } of destRows) {
    let entitlement;
    try {
      entitlement = await rcApi.getProEntitlement(id);
    } catch (err) {
      console.error(`[revenuecat-webhook] TRANSFER ${event.id}: RevenueCat lookup failed for destination`, id, '—', err.message || err);
      await safeSlackPost(slack, `ClearPass transfer: failed, destination ${id}, expiry none`);
      await safeDeleteWebhookEvent(db, event.id);
      return { ok: false, retry: true };
    }

    if (!entitlement.active) {
      console.log(`[revenuecat-webhook] TRANSFER ${event.id}: destination`, id, 'has no active "pro" entitlement in RevenueCat, no grant');
      await safeSlackPost(slack, `ClearPass transfer: not granted, destination ${id}, expiry none`);
      continue;
    }
    if (!entitlement.expiresAt) {
      console.warn(
        `[revenuecat-webhook] TRANSFER ${event.id}: destination ${id} has a non-expiring "pro" entitlement in RevenueCat — not granting (no open-ended Pro)`,
      );
      await safeSlackPost(slack, `ClearPass transfer: not granted, destination ${id}, expiry none`);
      continue;
    }
    if (!shouldApplyProGrant(progress.proSource, iapSource, progress.proExpiresAt, entitlement.expiresAt)) {
      await safeSlackPost(slack, `ClearPass transfer: not granted, destination ${id}, expiry ${entitlement.expiresAt}`);
      continue;
    }

    const patch = { isPro: true, proExpiresAt: entitlement.expiresAt, proSource: iapSource };
    const { error } = await db.upsertProgress(id, { ...progress, ...patch });
    if (error) {
      console.error(`[revenuecat-webhook] TRANSFER ${event.id}: destination upsert failed for`, id, error.message || error);
      await safeSlackPost(slack, `ClearPass transfer: failed, destination ${id}, expiry ${patch.proExpiresAt}`);
      await safeDeleteWebhookEvent(db, event.id);
      return { ok: false, retry: true };
    }
    console.log(
      `[revenuecat-webhook] TRANSFER ${event.id}: granted ${iapSource} to destination`,
      id,
      'expires',
      patch.proExpiresAt,
      '(via RevenueCat lookup)',
    );
    await safeSlackPost(slack, `ClearPass transfer: granted, destination ${id}, expiry ${patch.proExpiresAt}`);
  }

  for (const { id, progress } of sourceRows) {
    // Nothing to clear locally regardless of what RC says — skip the
    // lookup entirely rather than spend an API call on it.
    if (progress.proSource !== iapSource) continue;

    let entitlement;
    try {
      entitlement = await rcApi.getProEntitlement(id);
    } catch (err) {
      console.error(`[revenuecat-webhook] TRANSFER ${event.id}: RevenueCat lookup failed for source`, id, '—', err.message || err);
      await safeSlackPost(slack, `ClearPass transfer: failed, will retry, event ${event.id}, reason source lookup error`);
      await safeDeleteWebhookEvent(db, event.id);
      return { ok: false, retry: true };
    }

    if (entitlement.active) {
      console.log(`[revenuecat-webhook] TRANSFER ${event.id}: source`, id, 'still has an active "pro" entitlement in RevenueCat, not clearing');
      continue;
    }

    const patch = resolveTransferSourceUpdate(progress, iapSource);
    if (patch) {
      const { error } = await db.upsertProgress(id, { ...progress, ...patch });
      if (error) {
        console.error(`[revenuecat-webhook] TRANSFER ${event.id}: source upsert failed for`, id, error.message || error);
        await safeSlackPost(slack, `ClearPass transfer: failed, will retry, event ${event.id}, reason source write error`);
        await safeDeleteWebhookEvent(db, event.id);
        return { ok: false, retry: true };
      }
      console.log(`[revenuecat-webhook] TRANSFER ${event.id}: cleared iap grant from source`, id, '(via RevenueCat lookup)');
    }
  }

  return { ok: true };
}

// RevenueCat always sends environment 'SANDBOX' or 'PRODUCTION'. Anything
// else is treated as production (iapSourceForEnvironment) so a genuine
// customer is never downgraded, but it's logged loudly: if RC ever changed
// the field, sandbox purchases would silently start counting as revenue.
function warnOnUnexpectedEnvironment(event) {
  if (event.environment !== 'SANDBOX' && event.environment !== 'PRODUCTION') {
    console.warn(
      `[revenuecat-webhook] ${event.type} ${event.id}: unexpected environment ${JSON.stringify(event.environment)} — treating as PRODUCTION`,
    );
  }
}

// Durable record that this user made a SANDBOX (test) purchase. The
// 'iap_sandbox' proSource only lasts while the sandbox subscription does
// (Apple/Google sandbox subscriptions expire within hours), but the app's
// own purchase_succeeded funnel event stays in the reporting window for
// days — this marker is what lets funnel reporting (lib/funnelStats.js,
// docs/sql) keep excluding it. Stored as a funnel_events row (no schema
// change): event 'iap_sandbox_purchase', written with the service role.
// Best-effort — never fails or retries the webhook; the entitlement grant
// is what matters, the marker only feeds reporting. db.recordSandboxPurchase
// is optional so older adapters/tests keep working.
const SANDBOX_PURCHASE_MARKER_EVENT = 'iap_sandbox_purchase';

// The funnel_events row for that marker. anon_id is NOT NULL (8-64 chars)
// on that table; a per-event synthetic value keeps it unique and obviously
// server-written. props carry only non-personal store metadata.
const RC_STORE_PLATFORM = { APP_STORE: 'ios', MAC_APP_STORE: 'ios', PLAY_STORE: 'android' };

function buildSandboxPurchaseMarkerRow(userId, event) {
  return {
    user_id: userId,
    anon_id: `revenuecat:${String(event.id)}`.slice(0, 64),
    event: SANDBOX_PURCHASE_MARKER_EVENT,
    platform: RC_STORE_PLATFORM[event.store] || null,
    props: {
      source: 'revenuecat_webhook',
      rc_event_id: String(event.id).slice(0, 100),
      environment: 'SANDBOX',
      store: typeof event.store === 'string' ? event.store.slice(0, 40) : null,
      product_id: typeof event.product_id === 'string' ? event.product_id.slice(0, 100) : null,
    },
  };
}

async function recordSandboxPurchaseMarker(db, event, userId) {
  if (typeof db.recordSandboxPurchase !== 'function') return;
  try {
    await db.recordSandboxPurchase(userId, event);
  } catch (err) {
    console.error(
      `[revenuecat-webhook] ${event.type} ${event.id}: failed to record sandbox purchase marker for`,
      userId,
      '—',
      err.message || err,
    );
  }
}

// Applies one single-user RC event (INITIAL_PURCHASE/RENEWAL/CANCELLATION/
// EXPIRATION/anything resolveRevenueCatUpdate handles) via the same
// db-adapter shape as applyTransfer. A read error aborts before any write
// and signals retry — the bug this replaces silently treated a failed read
// as "no row" ({}), then upserted THAT as the user's entire progress,
// wiping out everything else in it (mock test history, XP, streaks, ...)
// down to just the patch fields.
async function applySingleUserUpdate(event, db) {
  const userId = event.app_user_id;
  if (!userId) {
    console.error('[revenuecat-webhook] missing app_user_id on event:', event.id, event.type);
    return { ok: true };
  }

  // Not every app_user_id is a real Supabase user — RC's own anonymous ids
  // ("$RCAnonymousID:...", a fresh un-logged-in install) and its TEST event
  // ids (sent when you click "Send test event" in the RC dashboard, e.g.
  // "test_app_user_id") both fail isSupabaseUserId. Neither corresponds to
  // a user_progress row, so this is skipped before any read is attempted —
  // same reasoning as filtering TRANSFER's transferred_from/transferred_to
  // through isSupabaseUserId.
  if (!isSupabaseUserId(userId)) {
    console.log(`[revenuecat-webhook] ${event.type} ${event.id}: non-Supabase app_user_id, skipping`);
    return { ok: true };
  }

  warnOnUnexpectedEnvironment(event);
  if (event.environment === 'SANDBOX' && event.type === 'INITIAL_PURCHASE') {
    await recordSandboxPurchaseMarker(db, event, userId);
  }

  let currentProgress;
  try {
    currentProgress = (await db.getProgress(userId)) || {};
  } catch (err) {
    console.error(`[revenuecat-webhook] ${event.type} ${event.id}: read failed for`, userId, '—', err.message || err);
    await safeDeleteWebhookEvent(db, event.id);
    return { ok: false, retry: true };
  }

  const { progress: patch, warning } = resolveRevenueCatUpdate(
    event.type,
    event.expiration_at_ms,
    currentProgress,
    event.environment,
  );
  if (warning) {
    console.warn(`[revenuecat-webhook] ${warning} (event ${event.id}, user ${userId})`);
  }
  if (!patch) {
    console.log(`[revenuecat-webhook] ${event.type}: no update applied for user`, userId);
    return { ok: true };
  }

  const updatedProgress = { ...currentProgress, ...patch };
  const { error } = await db.upsertProgress(userId, updatedProgress);
  if (error) {
    console.error(`[revenuecat-webhook] ${event.type} ${event.id}: write failed for`, userId, '—', error.message || error);
    await safeDeleteWebhookEvent(db, event.id);
    return { ok: false, retry: true };
  }
  console.log(`[revenuecat-webhook] ${event.type} applied for user`, userId, `(environment ${event.environment || 'unset'})`);
  return { ok: true };
}

module.exports = {
  SANDBOX_PURCHASE_MARKER_EVENT,
  buildSandboxPurchaseMarkerRow,
  expirationMsToIso,
  resolveRevenueCatUpdate,
  isSupabaseUserId,
  resolveTransferSourceUpdate,
  resolveTransferDestinationUpdate,
  applyTransfer,
  applySingleUserUpdate,
};
