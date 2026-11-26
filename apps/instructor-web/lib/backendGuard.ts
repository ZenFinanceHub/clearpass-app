// Refuses to wire a non-production build of the instructor site to the
// production backend. Called from next.config.ts, so it runs at `next build`
// and `next dev` start, where VERCEL_ENV is always available (no reliance on
// Vercel's optional NEXT_PUBLIC_ system-variable exposure).
//
//  - Vercel production: must declare NEXT_PUBLIC_APP_ENV=production (set in
//    the Vercel Production environment); otherwise the build fails.
//  - Vercel preview/development: production hosts refused, no override.
//  - No VERCEL_ENV (a developer machine or CI): production hosts refused
//    unless NEXT_PUBLIC_APP_ENV=production is set explicitly.
// Missing values are left to lib/supabase.ts, which throws at runtime.
// See docs/environments.md.

export const PRODUCTION_HOSTS = [
  "secavejbaapapvvqbwed.supabase.co",
  "clearpass-app-production.up.railway.app",
];

export type BackendEnv = {
  VERCEL_ENV?: string;
  NEXT_PUBLIC_APP_ENV?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_API_URL?: string;
};

function isProductionUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PRODUCTION_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function backendProblems(env: BackendEnv): string[] {
  const vercelEnv = (env.VERCEL_ENV ?? "").trim();
  const appEnv = (env.NEXT_PUBLIC_APP_ENV ?? "").trim();
  if (vercelEnv === "production") {
    return appEnv === "production"
      ? []
      : [`NEXT_PUBLIC_APP_ENV must be "production" in a Vercel production build (got "${appEnv}")`];
  }

  const prodVars = (["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_API_URL"] as const).filter((k) =>
    isProductionUrl(env[k]),
  );
  if (prodVars.length === 0) return [];

  if (vercelEnv) {
    return prodVars.map((k) => `${k} points at production in a Vercel ${vercelEnv} build`);
  }
  if (appEnv === "production") return [];
  return prodVars.map(
    (k) => `${k} points at production. Use the local stack, or set NEXT_PUBLIC_APP_ENV=production to deliberately use live data`,
  );
}

export function assertBackendAllowed(env: BackendEnv): void {
  const problems = backendProblems(env);
  if (problems.length > 0) {
    throw new Error(`[backendGuard] Refusing to start:\n  - ${problems.join("\n  - ")}\n  See docs/environments.md`);
  }
}
