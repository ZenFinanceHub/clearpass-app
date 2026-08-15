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

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});
