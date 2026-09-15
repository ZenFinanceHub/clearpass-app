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
// code_verifier this client writes on request is still there, on the same
// device, when exchangeCodeForSession runs on completion.
//
// persistSession MUST be true for that to actually happen. Confirmed
// against @supabase/auth-js's GoTrueClient constructor: when
// persistSession is false, `this.storage` is unconditionally set to an
// in-memory-only adapter — the `storage: AsyncStorage` option below is
// never even read in that branch. Every write of the code verifier
// (getCodeChallengeAndMethod, called from signInWithOtp) goes through
// that same `this.storage`, so with persistSession: false the verifier
// was always in-memory only and never survived a cold start between
// requesting the link and tapping it — this was the actual cause of
// "pkce_code_verifier_not_found" on cold start (2026-09-15).
//
// A distinct storageKey from the main client's is still load-bearing: it
// keeps this client's code-verifier storage (`${storageKey}-code-verifier`)
// and session storage from ever colliding with the main client's. This
// client still isn't a second source of truth for "am I logged in" in any
// way the app acts on — its only job is request -> exchange -> hand the
// resulting tokens to the MAIN client via supabase.auth.setSession() (see
// callback.tsx), and nothing ever calls getSession()/onAuthStateChange()
// on this client. One side effect worth knowing about: exchangeCodeForSession
// internally calls _saveSession(), which unconditionally persists the
// exchanged session to this.storage under storageKey — so with
// persistSession: true, a session blob for this client now lands in
// AsyncStorage after every successful exchange (previously written to the
// in-memory store and discarded). It stays inert: nothing reads it back,
// and autoRefreshToken: false means this client never runs a refresh
// ticker against it.
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
          persistSession: true,
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
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
          storageKey: 'sb-clearpass-magiclink-pkce',
        },
      };

export const supabaseMagicLink = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
