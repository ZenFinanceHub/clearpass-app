import { router } from 'expo-router';
import { supabase } from './supabase';

// Shared by every /api/explain caller's 401 handling (tutor.tsx,
// studyplan.tsx, and practice.tsx via explainAnswer()) — signs out the
// now-stale local session, then replaces (not pushes) into sign-in so a
// back gesture can't land on an authenticated screen with no session
// behind it. Matches the existing pattern in app/_layout.tsx's
// handleGuardSignOut, just targeting sign-in instead of onboarding since
// this is an expired session, not a fresh unauthenticated visitor.
export async function handleSessionExpired(): Promise<void> {
  await supabase.auth.signOut();
  router.replace('/auth/signin');
}
