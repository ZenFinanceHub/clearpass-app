'use strict';

// Guards that keep local/staging tooling away from production. Pure and
// unit-tested (envGuard.test.js). See docs/environments.md.
//
// Production Supabase is shared with Zen Footy, so anything that writes
// synthetic data (scripts/seed-local.js) must be impossible to point at it,
// and a server started in local mode must never pick up the production
// values in server/.env.

const PRODUCTION_SUPABASE_PROJECT_REF = 'secavejbaapapvvqbwed';
const PRODUCTION_HOSTS = Object.freeze([
  `${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
  'clearpass-app-production.up.railway.app',
]);
const LOOPBACK_HOSTS = Object.freeze(['localhost', '127.0.0.1', '[::1]', '::1']);

function parseHost(url) {
  if (typeof url !== 'string' || url.trim() === '') return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return { protocol: u.protocol, host: u.hostname.toLowerCase() };
  } catch {
    return null;
  }
}

function isProductionHost(host) {
  return (
    host.includes(PRODUCTION_SUPABASE_PROJECT_REF) ||
    PRODUCTION_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  );
}

function isLoopbackUrl(url) {
  const parsed = parseHost(url);
  return !!parsed && LOOPBACK_HOSTS.includes(parsed.host);
}

// Comma-separated hostnames, e.g. "abcdefgh.supabase.co". Only for a hosted
// STAGING project; production is refused even if listed.
function parseAllowedHosts(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Throws unless `url` is a loopback address or an explicitly allow-listed
 * https staging host. Production is always refused.
 */
function assertSafeSeedTarget(url, { allowedHosts = [] } = {}) {
  const parsed = parseHost(url);
  if (!parsed) throw new Error(`Refusing to seed: target URL is missing or invalid (${JSON.stringify(url)})`);
  const { host, protocol } = parsed;
  if (isProductionHost(host)) {
    throw new Error(`Refusing to seed: ${host} is PRODUCTION. Seed scripts only run against local or staging.`);
  }
  if (LOOPBACK_HOSTS.includes(host)) return { host, kind: 'local' };
  if (allowedHosts.includes(host)) {
    if (protocol !== 'https:') throw new Error(`Refusing to seed: allow-listed host ${host} must use https`);
    return { host, kind: 'staging' };
  }
  throw new Error(
    `Refusing to seed: ${host} is not local (127.0.0.1/localhost) and not in CLEARPASS_SEED_ALLOWED_HOSTS.`,
  );
}

// proxy.js loads server/.env (production values on Craig's machine) unless
// started by `scripts/local-stack.js server`, which sets
// CLEARPASS_SERVER_ENV=local and passes every value explicitly. Unset (as
// on Railway) keeps the existing behaviour exactly.
function shouldLoadDotenv(env) {
  return env.CLEARPASS_SERVER_ENV !== 'local';
}

/** In local mode, SUPABASE_URL must be loopback. No-op otherwise. */
function assertLocalServerEnv(env) {
  if (env.CLEARPASS_SERVER_ENV !== 'local') return;
  if (!isLoopbackUrl(env.SUPABASE_URL)) {
    throw new Error(
      `CLEARPASS_SERVER_ENV=local but SUPABASE_URL is not a local address (${env.SUPABASE_URL ? 'set to a remote host' : 'unset'}). Refusing to start.`,
    );
  }
  if (typeof env.STRIPE_SECRET_KEY === 'string' && env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
    throw new Error('CLEARPASS_SERVER_ENV=local with a live Stripe key. Refusing to start.');
  }
}

module.exports = {
  PRODUCTION_SUPABASE_PROJECT_REF,
  PRODUCTION_HOSTS,
  isLoopbackUrl,
  parseAllowedHosts,
  assertSafeSeedTarget,
  shouldLoadDotenv,
  assertLocalServerEnv,
};
