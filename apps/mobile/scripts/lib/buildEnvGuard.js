'use strict';

/**
 * Build-time guard: a release bundle can't tell where it will run, so an
 * unset EXPO_PUBLIC_APP_ENV means production at runtime (src/appEnv.ts).
 * This check runs before every hosted build and refuses to produce a
 * production-wired bundle in a non-production context:
 *
 *  - Vercel (VERCEL_ENV): only `production` may build with APP_ENV unset or
 *    `production`. `preview` / `development` must be `local` or `staging`.
 *  - EAS Build (EAS_BUILD_PROFILE): only the `production` profile may be
 *    production. `development` (dev client; JS comes from Metro, where
 *    src/appEnv.ts requires APP_ENV) is allowed. Any other profile, e.g.
 *    `preview`, must be `local` or `staging`.
 *  - A production context must not carry a non-production APP_ENV either.
 *  - EXPLICIT EVERYWHERE: EXPO_PUBLIC_APP_ENV must be set in every context
 *    (production builds declare `production`). The only exception is the
 *    EAS `development` profile, whose JS comes from Metro at run time.
 *    Release paths declare it: eas.json production profile env,
 *    `npm run ota:production` (scripts/publish-ota.js), and the Vercel
 *    Production environment variable (dashboard).
 *  - local/staging must name their Supabase URL and anon key (staging also
 *    its API URL), none pointing at production. The same rules apply again
 *    at app start-up in src/appEnv.ts; this just fails the build earlier.
 *
 * Plain CommonJS with no dependencies so it runs before `npm install`
 * (EAS `eas-build-pre-install`) on any Node version.
 */

const PRODUCTION_HOSTS = ['secavejbaapapvvqbwed.supabase.co', 'clearpass-app-production.up.railway.app'];
const PRODUCTION_PROJECT_REF = 'secavejbaapapvvqbwed';

function clean(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function isProductionUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PRODUCTION_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function isProductionKey(key) {
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json).ref === PRODUCTION_PROJECT_REF;
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: boolean, context: string, problems: string[] }}
 */
function checkBuildEnv(env) {
  const declared = clean(env.EXPO_PUBLIC_APP_ENV);
  const appEnv = declared || 'production';
  const vercelEnv = clean(env.VERCEL_ENV);
  const easProfile = clean(env.EAS_BUILD_PROFILE);
  const problems = [];

  let context = 'unknown (local machine or CI)';
  let mustBeProduction = false;
  let mustBeNonProduction = false;

  if (vercelEnv) {
    context = `Vercel ${vercelEnv}`;
    if (vercelEnv === 'production') mustBeProduction = true;
    else mustBeNonProduction = true;
  } else if (easProfile) {
    context = `EAS Build profile "${easProfile}"`;
    if (easProfile === 'production') mustBeProduction = true;
    else if (easProfile !== 'development') mustBeNonProduction = true;
  }

  const devClientBuild = !vercelEnv && easProfile === 'development';
  if (!declared && !devClientBuild) {
    problems.push(
      `EXPO_PUBLIC_APP_ENV is not set (${context}). Every build must declare its environment: ` +
        '"production", "staging" or "local"',
    );
  } else if (!['local', 'staging', 'production'].includes(appEnv)) {
    problems.push(`EXPO_PUBLIC_APP_ENV must be local, staging or production (got "${appEnv}")`);
  } else if (mustBeNonProduction && appEnv === 'production') {
    problems.push(
      `${context} is not production, so EXPO_PUBLIC_APP_ENV must be "staging" or "local" ` +
        '(it is unset or "production", which would wire this build to the production backend)',
    );
  } else if (mustBeProduction && appEnv !== 'production') {
    problems.push(`${context} is production but EXPO_PUBLIC_APP_ENV is "${appEnv}"`);
  }

  if (appEnv === 'local' || appEnv === 'staging') {
    const url = clean(env.EXPO_PUBLIC_SUPABASE_URL);
    const key = clean(env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    const api = clean(env.EXPO_PUBLIC_API_URL);
    if (!url) problems.push(`EXPO_PUBLIC_SUPABASE_URL is required for ${appEnv}`);
    else if (isProductionUrl(url)) problems.push('EXPO_PUBLIC_SUPABASE_URL points at production');
    if (!key) problems.push(`EXPO_PUBLIC_SUPABASE_ANON_KEY is required for ${appEnv}`);
    else if (isProductionKey(key)) problems.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is the production key');
    if (!api && appEnv === 'staging') problems.push('EXPO_PUBLIC_API_URL is required for staging');
    else if (api && isProductionUrl(api)) problems.push('EXPO_PUBLIC_API_URL points at production');
  }

  return { ok: problems.length === 0, context, problems };
}

module.exports = { checkBuildEnv };
