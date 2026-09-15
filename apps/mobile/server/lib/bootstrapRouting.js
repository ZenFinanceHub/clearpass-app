'use strict';

// Pure decision logic for app/_layout.tsx's bootstrap() — deliberately
// framework-free (no React, no expo-router, no Supabase) so it's directly
// unit-testable with plain node:test, same reason lib/authErrors.js and
// lib/earnings.js exist as plain CommonJS shared between this server and
// the TSX app (Expo's allowJs + esModuleInterop make this importable from
// _layout.tsx as a plain import, same as those two).
//
// bootstrap() does everything this function can't — reading the actual
// session (supabase.auth.getSession()), the actual launch URL
// (Linking.getInitialURL(), turned into a path via src/deepLinks.ts's
// getDeepLinkPath — the fix for the cold-start race this module exists to
// pin: reading the URL that launched this app instance instead of
// expo-router's segments, which can still be resolving by the time
// bootstrap's async work finishes), and the onboarding-seen flag
// (AsyncStorage) — then calls resolveBootstrapDestination once with all
// three already resolved, and only then performs the actual navigation
// side effect (router.replace).

// Screens reachable without an account. privacy-policy/terms/legal/
// contact: the App Store listing and the marketing site link directly to
// these, and the legal ones are required to be public. paywall: also
// externally linked from the marketing site, and renders pricing without
// a session on its own — auth is only enforced reactively, inside
// handleSubscribe(), which already redirects to sign-in itself if needed.
// confirm-parent: reached from an email link by a parent who may have no
// ClearPass account at all (see app/confirm-parent.tsx — no session
// check, calls the confirm endpoint directly with just the token).
const PUBLIC_ROUTES = new Set(['privacy-policy', 'terms', 'legal', 'contact', 'confirm-parent', 'paywall']);

// Screens a signed-in user launching (or relaunching) into should be
// redirected away from, towards their real destination — generic "nothing
// specific was asked for" screens, not real content of their own.
const ENTRY_POINTS = new Set(['', 'index', 'onboarding', 'landing']);

// { hasSession, launchedSegment, hasSeenOnboarding } -> what bootstrap()
// should do next.
//
// launchedSegment is the first path segment of whatever URL launched this
// app instance (e.g. 'auth' for /auth/callback or /auth/signup,
// 'confirm-parent'), or null/undefined when there wasn't one — both
// treated identically to '' throughout, which is deliberate: ENTRY_POINTS
// already contains '', so "no launch URL at all" and "launched into the
// generic entry point" resolve the same way, matching what a plain app-icon
// tap has always meant here.
//
// Returns exactly one of:
//   { action: 'none' }       — leave the current route alone
//   { action: 'post-auth' }  — signed in, launched into a generic entry
//                              screen: caller resolves and replaces to the
//                              real destination (resolvePostAuthRoute)
//   { action: 'signin' }     — no session, not a protected/public route,
//                              onboarding already seen
//   { action: 'onboarding' } — no session, not a protected/public route,
//                              never onboarded
function resolveBootstrapDestination({ hasSession, launchedSegment, hasSeenOnboarding }) {
  const segment = launchedSegment ?? '';

  if (hasSession) {
    if (ENTRY_POINTS.has(segment)) {
      return { action: 'post-auth' };
    }
    return { action: 'none' };
  }

  if (PUBLIC_ROUTES.has(segment) || segment === 'auth') {
    return { action: 'none' };
  }

  return { action: hasSeenOnboarding ? 'signin' : 'onboarding' };
}

module.exports = { resolveBootstrapDestination, PUBLIC_ROUTES, ENTRY_POINTS };
