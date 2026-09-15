import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Dedicated PKCE client used ONLY for the magic-link request/completion
// pair (app/auth/signup.tsx's handleSendMagicLink -> app/auth/callback.tsx's
// ?code= branch). src/supabase.ts's main client deliberately stays on
// implicit flow — see that file and socialAuth.ts's own comment — because
// password-reset requests from the native app but completes in a separate
// browser origin, which PKCE's device-local code_verifier can't survive.
// The magic-link round trip doesn't have that problem: the deep link
// resolves back into this same app process (the mail app's browser is only
// a transient HTTP-redirect hop, no JS ever runs there), so the
// code_verifier this client writes to AsyncStorage on request is still
// there, on the same device, when exchangeCodeForSession runs on
// completion — including across a cold start, since AsyncStorage is
// genuinely persistent device storage, not in-memory.
//
// persistSession: false and a storageKey distinct from the main client's
// are both load-bearing, not incidental: this client's only job is
// request -> exchange -> hand the resulting tokens to the MAIN client via
// supabase.auth.setSession() (see callback.tsx) — it must never become a
// second source of truth for "am I logged in", and its code-verifier
// storage (keyed off storageKey, per @supabase/auth-js's
// `${storageKey}-code-verifier`) must never collide with the main client's
// session storage.
const SUPABASE_URL = 'https://secavejbaapapvvqbwed.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlY2F2ZWpiYWFwYXB2dnFid2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NjY2NTcsImV4cCI6MjA5MzM0MjY1N30.pu0LhnRdup6ZpQWBgcBYP1Z8tQu-BzPl2JmY50e5zfU';

// Same web-vs-native split as src/supabase.ts: on web, no window.localStorage
// substitute is needed, so leave `storage` unset and let supabase-js use its
// own built-in handling.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const options: any =
  Platform.OS === 'web'
    ? {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
          flowType: 'pkce',
          storageKey: 'sb-clearpass-magiclink-pkce',
        },
      }
    : {
        auth: {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          storage: require('@react-native-async-storage/async-storage').default,
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
          flowType: 'pkce',
          storageKey: 'sb-clearpass-magiclink-pkce',
        },
      };

export const supabaseMagicLink = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
