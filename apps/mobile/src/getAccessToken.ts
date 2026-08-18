import { supabase } from './supabase';

// Was three independent inline copies of this exact two-line pattern
// (settings.tsx, twice in instructor.tsx) — consolidated here so a future
// caller (e.g. Ask Pip's /api/explain calls) doesn't become a fourth.
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
