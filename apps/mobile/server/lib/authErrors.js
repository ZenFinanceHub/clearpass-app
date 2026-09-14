'use strict';

// Instructors who sign up on instructors.getclearpass.co.uk get a
// passwordless (magic-link only) auth.users row — see this same server's
// POST /api/instructor/signup (proxy.js). If that same email then hits
// password-based supabase.auth.signUp() (apps/mobile/app/auth/signup.tsx),
// Supabase reports it as already registered; this is the same code/message
// check proxy.js already uses for the equivalent admin.createUser case.
//
// Lives here, not in apps/mobile/src/, for the same reason as lib/earnings.js
// (see that file's own header): plain CommonJS so both proxy.js (Node,
// plain require) and app/auth/signup.tsx (TS/TSX, plain import — Expo's
// allowJs + esModuleInterop make this importable) share the exact same
// check, and so a test can exercise the real shipped function rather than a
// re-implementation of it (see scripts/test-instructor-fixes.js).
function isAlreadyRegisteredError(error) {
  return (
    error?.code === 'user_already_exists' ||
    error?.code === 'email_exists' ||
    /already registered|already exists/i.test(error?.message ?? '')
  );
}

module.exports = { isAlreadyRegisteredError };
