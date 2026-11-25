import { resolveAppEnv, type ResolvedAppEnv } from './appEnv';

// Expo inlines EXPO_PUBLIC_* at bundle time only for static
// `process.env.EXPO_PUBLIC_NAME` references, so each one is spelled out here.
// Never read them via process.env[name] or destructuring.
//
// Resolved once at module load. A local/staging build that is missing its
// values, or is pointed at production, throws here and refuses to start.
export const appConfig: ResolvedAppEnv = resolveAppEnv(
  {
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_UI_V2: process.env.EXPO_PUBLIC_UI_V2,
  },
  { isDev: typeof __DEV__ !== 'undefined' && __DEV__ },
);
