'use strict';

const REVENUECAT_PROJECT_ID = 'proj76530af5';

// The RevenueCat-internal id of the "pro" entitlement (Entitlements >
// pro > entitlement id in the RC dashboard) — v2's active_entitlements
// items carry entitlement_id, NOT a human-readable lookup_key, so this
// must be the real opaque id, not the string "pro" itself.
const PRO_ENTITLEMENT_ID = 'entlafbd9083d9';

const REQUEST_TIMEOUT_MS = 5000;

// Fetches one page of a RevenueCat v2 GET endpoint with the 5s timeout and
// Bearer auth, returning the parsed JSON body. Throws on a network error
// (including the timeout), and on ANY non-2xx status — v2 endpoints in
// this codebase fail closed: a caller that can't tell "not entitled" from
// "couldn't ask RevenueCat" must never silently assume the former.
async function fetchRcJson(url, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
  } catch (err) {
    // Network error, DNS failure, or the 5s abort timeout firing.
    throw new Error(`RevenueCat request failed: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Every non-2xx fails closed — 401/403 (misconfigured key), 404
    // (unrecognized customer), 429/5xx (rate limit/outage), anything else.
    // The caller (applyTransfer) treats a throw as "couldn't determine
    // this right now" and retries later, never as "not entitled".
    throw new Error(`RevenueCat request returned ${response.status}`);
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    throw new Error(`RevenueCat response was not valid JSON: ${err.message}`);
  }

  if (!Array.isArray(body?.items)) {
    throw new Error('RevenueCat response missing an items array');
  }

  return body;
}

// Looks up whether `appUserId` currently has RevenueCat's own "pro"
// entitlement (PRO_ENTITLEMENT_ID) active, and its expiry — the
// authoritative source for TRANSFER handling. Unlike the rest of this
// codebase (which trusts whatever user_progress already says), a
// TRANSFER's destination has never been touched by IAP locally, so
// there's nothing in Supabase to trust; RC's own /active_entitlements is
// asked directly instead.
//
// GET /v2/projects/{project_id}/customers/{customer_id}/active_entitlements
// — RC's v2 REST API, authenticated with a project-scoped v2 secret key
// (sk_..., NOT a v1 platform key like appl_/goog_). Response shape:
// { items: [{ object: "customer.active_entitlement", entitlement_id,
// expires_at }], next_page, object }. expires_at is epoch milliseconds,
// or null for a non-expiring grant — there is no lookup_key on this
// resource, confirmed against a real response; matching happens on
// entitlement_id. Presence in this list IS the "active" signal — RC only
// returns entitlements that are currently granting access.
//
// Follows next_page across pages until either a match is found or pages
// run out — page 1 alone is not assumed to be the complete list.
//
// Fails closed: throws (never resolves) on any non-2xx status (including
// 401/403/404), a response body without an items array, or a matched
// entitlement whose expires_at is neither a number nor null. Only a
// successful, well-formed response may resolve { active: false }.
//
// Returns { active, expiresAt } — expiresAt is an ISO string or null.
async function getProEntitlement(appUserId) {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    throw new Error('REVENUECAT_SECRET_API_KEY not set');
  }

  let url = `https://api.revenuecat.com/v2/projects/${REVENUECAT_PROJECT_ID}/customers/${encodeURIComponent(appUserId)}/active_entitlements`;

  while (url) {
    const body = await fetchRcJson(url, apiKey);
    const match = body.items.find((item) => item?.entitlement_id === PRO_ENTITLEMENT_ID);

    if (match) {
      if (match.expires_at !== null && typeof match.expires_at !== 'number') {
        throw new Error(`RevenueCat entitlement had an unexpected expires_at value: ${JSON.stringify(match.expires_at)}`);
      }
      const expiresAt = typeof match.expires_at === 'number' ? new Date(match.expires_at).toISOString() : null;
      return { active: true, expiresAt };
    }

    url = typeof body.next_page === 'string' && body.next_page ? body.next_page : null;
  }

  return { active: false, expiresAt: null };
}

module.exports = { getProEntitlement, PRO_ENTITLEMENT_ID };
