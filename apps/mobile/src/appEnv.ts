/**
 * Which backend the app talks to: local, staging or production.
 *
 * Pure (no React Native imports) so it can be unit-tested with plain Node
 * (scripts/lib/appEnv.test.mjs). src/appConfig.ts is the RN-facing wrapper
 * that feeds it the inlined EXPO_PUBLIC_* values.
 *
 * Rules (see docs/environments.md):
 *  - In a development build (__DEV__) EXPO_PUBLIC_APP_ENV is required; unset
 *    throws. Release builds that run in a non-production context (Vercel
 *    previews, EAS non-production profiles) are stopped at build time by
 *    scripts/check-build-env.js, because a release bundle can't tell on its
 *    own where it is running.
 *  - In a release build, EXPO_PUBLIC_APP_ENV unset or empty means production, with the values
 *    pinned below. These are exactly the values the app hardcoded before
 *    environments existed, so EAS production builds, `npm run ota:production`
 *    and Vercel production builds behave identically. In production any
 *    EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY / _API_URL value is ignored on
 *    purpose: an env var can never move production somewhere else.
 *  - local and staging must name their own Supabase URL and anon key
 *    (staging also its API URL). Startup fails, loudly, if one is missing or
 *    if any of them points at a production host or uses the production key.
 *  - uiV2 is only ever on outside production (EXPO_PUBLIC_UI_V2=1). Turning
 *    it on in production is a deliberate future code change, not a flag.
 */

export type AppEnv = 'local' | 'staging' | 'production';

export const PRODUCTION_SUPABASE_URL = 'https://secavejbaapapvvqbwed.supabase.co';
// Public anon key (safe for clients; RLS enforces access). Unchanged from the
// value src/supabase.ts hardcoded before this file existed.
export const PRODUCTION_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY2F2ZWpiYWFwYXB2dnFid2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjY2NTcsImV4cCI6MjA5MzM0MjY1N30.pu0LhnRdup6ZpQWBgcBYP1Z8tQu-BzPl2JmY50e5zfU';
export const PRODUCTION_API_URL = 'https://clearpass-app-production.up.railway.app';
// What development builds (__DEV__) have always used for the API server.
export const LOCAL_DEV_API_URL = 'http://localhost:3001';

/** Hosts a local or staging build must never talk to. */
export const PRODUCTION_HOSTS: readonly string[] = [
  'secavejbaapapvvqbwed.supabase.co',
  'clearpass-app-production.up.railway.app',
];
const PRODUCTION_PROJECT_REF = 'secavejbaapapvvqbwed';

export type RawAppEnvVars = {
  EXPO_PUBLIC_APP_ENV?: string;
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_UI_V2?: string;
};

export type ResolvedAppEnv = {
  appEnv: AppEnv;
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiUrl: string;
  uiV2: boolean;
};

export class AppEnvConfigError extends Error {
  constructor(message: string) {
    super(`[appEnv] ${message} (see docs/environments.md)`);
    this.name = 'AppEnvConfigError';
  }
}

function clean(v: string | undefined): string {
  return typeof v === 'string' ? v.trim() : '';
}

function hostOf(url: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppEnvConfigError(`${name} is not a valid URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppEnvConfigError(`${name} must be http(s)`);
  }
  return parsed.hostname.toLowerCase();
}

export function isProductionHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PRODUCTION_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function assertNotProduction(url: string, name: string, appEnv: AppEnv): void {
  const host = hostOf(url, name);
  if (PRODUCTION_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new AppEnvConfigError(`${name} points at production (${host}) but EXPO_PUBLIC_APP_ENV=${appEnv}`);
  }
}

/** Decodes the `ref` claim of a Supabase JWT without verifying it. */
function jwtRef(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    // atob exists in Hermes (RN >= 0.74), browsers and Node >= 16. Without it,
    // the exact-match check against PRODUCTION_SUPABASE_ANON_KEY still applies.
    if (typeof atob !== 'function') return null;
    const json = atob(padded);
    const ref = JSON.parse(json)?.ref;
    return typeof ref === 'string' ? ref : null;
  } catch {
    return null;
  }
}

export function resolveAppEnv(raw: RawAppEnvVars, opts: { isDev: boolean }): ResolvedAppEnv {
  const envName = clean(raw.EXPO_PUBLIC_APP_ENV);
  const uiV2Requested = clean(raw.EXPO_PUBLIC_UI_V2) === '1';

  // A development build (__DEV__: `expo start`, dev client) is never
  // production by default. It must name its backend: `local` for the Docker
  // stack, or `production` explicitly to deliberately use live data. Missing
  // config fails closed instead of silently talking to production.
  if (envName === '' && opts.isDev) {
    throw new AppEnvConfigError(
      'EXPO_PUBLIC_APP_ENV is not set in a development build. Set it to "local" (Docker stack) or, ' +
        'only to deliberately use live data, "production"',
    );
  }

  if (envName === '' || envName === 'production') {
    return {
      appEnv: 'production',
      supabaseUrl: PRODUCTION_SUPABASE_URL,
      supabaseAnonKey: PRODUCTION_SUPABASE_ANON_KEY,
      apiUrl: opts.isDev ? LOCAL_DEV_API_URL : PRODUCTION_API_URL,
      // Never on in production until a reviewed code change allows it.
      uiV2: false,
    };
  }

  if (envName !== 'local' && envName !== 'staging') {
    throw new AppEnvConfigError(
      `EXPO_PUBLIC_APP_ENV must be local, staging or production (got "${envName}")`,
    );
  }
  const appEnv: AppEnv = envName;

  const supabaseUrl = clean(raw.EXPO_PUBLIC_SUPABASE_URL).replace(/\/+$/, '');
  const supabaseAnonKey = clean(raw.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  let apiUrl = clean(raw.EXPO_PUBLIC_API_URL).replace(/\/+$/, '');

  if (!supabaseUrl) throw new AppEnvConfigError(`EXPO_PUBLIC_SUPABASE_URL is required when EXPO_PUBLIC_APP_ENV=${appEnv}`);
  if (!supabaseAnonKey) {
    throw new AppEnvConfigError(`EXPO_PUBLIC_SUPABASE_ANON_KEY is required when EXPO_PUBLIC_APP_ENV=${appEnv}`);
  }
  if (!apiUrl) {
    if (appEnv === 'staging') {
      throw new AppEnvConfigError('EXPO_PUBLIC_API_URL is required when EXPO_PUBLIC_APP_ENV=staging');
    }
    apiUrl = LOCAL_DEV_API_URL;
  }

  assertNotProduction(supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL', appEnv);
  assertNotProduction(apiUrl, 'EXPO_PUBLIC_API_URL', appEnv);
  if (supabaseAnonKey === PRODUCTION_SUPABASE_ANON_KEY || jwtRef(supabaseAnonKey) === PRODUCTION_PROJECT_REF) {
    throw new AppEnvConfigError(`EXPO_PUBLIC_SUPABASE_ANON_KEY is the production key but EXPO_PUBLIC_APP_ENV=${appEnv}`);
  }

  return { appEnv, supabaseUrl, supabaseAnonKey, apiUrl, uiV2: uiV2Requested };
}
