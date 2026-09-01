import { createClient } from "@supabase/supabase-js";

// Same Supabase project as the mobile app (apps/mobile/src/supabase.ts) —
// an instructor who signed up on their phone logs in here with the same
// credentials. The anon key is safe client-side; access is enforced by RLS,
// not by keeping this value secret. The service role key must never be
// referenced anywhere in this app.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set — see .env.example"
  );
}

// Captured before createClient() below, whose constructor kicks off an
// async init that reads *and clears* location.hash itself when it's a magic
// link callback (success or error). A page's own useEffect always loses that
// race, so this is the only reliable way to see the raw params — e.g. to
// detect an expired/already-used link (see lib/authErrors.ts).
export const authRedirectHash = typeof window !== "undefined" ? window.location.hash : "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});

// Hardcoded, not window.location.origin — this app has exactly one
// production domain, and deriving it from the requesting origin silently
// breaks the link whenever that origin isn't it (a Vercel preview,
// localhost, a bookmark to the wrong domain). Cost of that: a magic link
// sent from a Vercel preview always lands the user back on production, so
// the full send-link -> click -> land flow can never be exercised end to
// end from a preview deployment — only against production itself.
export const AUTH_REDIRECT_URL = "https://instructors.getclearpass.co.uk/login";
