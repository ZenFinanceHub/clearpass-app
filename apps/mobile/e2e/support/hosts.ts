// Hosts the e2e suite must never reach. The app bundle hard-codes several of
// these (src/supabase.ts, src/proxyUrl.ts), so every one of them is either
// answered by a synthetic stub or aborted by the harness — never forwarded.
export const PRODUCTION_HOSTS = [
  'secavejbaapapvvqbwed.supabase.co',
  'clearpass-app-production.up.railway.app',
  'clearpass-app.vercel.app',
  'getclearpass.co.uk',
  'api.revenuecat.com',
  'api.stripe.com',
  'js.stripe.com',
  'checkout.stripe.com',
  'api.anthropic.com',
  'o0.ingest.sentry.io',
  'o0.ingest.de.sentry.io',
] as const;

export const SUPABASE_PROJECT_REF = 'secavejbaapapvvqbwed';
export const SUPABASE_HOST = `${SUPABASE_PROJECT_REF}.supabase.co`;
export const RAILWAY_HOST = 'clearpass-app-production.up.railway.app';

/** supabase-js (web) persists the session in localStorage under this key. */
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLoopback(hostname: string): boolean {
  return LOOPBACK.has(hostname);
}
