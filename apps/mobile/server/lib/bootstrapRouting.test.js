const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveBootstrapDestination, PUBLIC_ROUTES, ENTRY_POINTS } = require('./bootstrapRouting');

// ── hasSession: true ────────────────────────────────────────────────────
// Every ENTRY_POINTS segment -> post-auth; everything else -> none,
// including 'auth' specifically (the authenticated branch previously never
// checked this at all — a signed-in user landing on /auth/callback got
// stomped unconditionally; this is the fix for that half of the bug).

test('hasSession=true: null launchedSegment (plain app-icon tap) -> post-auth', () => {
  assert.deepEqual(
    resolveBootstrapDestination({ hasSession: true, launchedSegment: null, hasSeenOnboarding: true }),
    { action: 'post-auth' }
  );
});

test('hasSession=true: undefined launchedSegment -> post-auth (same as null)', () => {
  assert.deepEqual(
    resolveBootstrapDestination({ hasSession: true, launchedSegment: undefined, hasSeenOnboarding: false }),
    { action: 'post-auth' }
  );
});

for (const segment of ENTRY_POINTS) {
  test(`hasSession=true: launchedSegment=${JSON.stringify(segment)} (entry point) -> post-auth`, () => {
    assert.deepEqual(
      resolveBootstrapDestination({ hasSession: true, launchedSegment: segment, hasSeenOnboarding: true }),
      { action: 'post-auth' }
    );
  });
}

test('hasSession=true: launchedSegment="auth" -> none (this is the authenticated-branch fix)', () => {
  assert.deepEqual(
    resolveBootstrapDestination({ hasSession: true, launchedSegment: 'auth', hasSeenOnboarding: true }),
    { action: 'none' }
  );
});

for (const segment of PUBLIC_ROUTES) {
  test(`hasSession=true: launchedSegment=${JSON.stringify(segment)} (public route) -> none`, () => {
    assert.deepEqual(
      resolveBootstrapDestination({ hasSession: true, launchedSegment: segment, hasSeenOnboarding: true }),
      { action: 'none' }
    );
  });
}

test('hasSession=true: unknown launchedSegment (already on some other valid route) -> none', () => {
  assert.deepEqual(
    resolveBootstrapDestination({ hasSession: true, launchedSegment: 'roadsigns', hasSeenOnboarding: true }),
    { action: 'none' }
  );
});

// ── hasSession: false ───────────────────────────────────────────────────
// PUBLIC_ROUTES and 'auth' -> none, regardless of hasSeenOnboarding.
// Everything else -> signin or onboarding depending on hasSeenOnboarding.

test('hasSession=false: null launchedSegment, hasSeenOnboarding=true -> signin', () => {
  assert.deepEqual(
    resolveBootstrapDestination({ hasSession: false, launchedSegment: null, hasSeenOnboarding: true }),
    { action: 'signin' }
  );
});

test('hasSession=false: null launchedSegment, hasSeenOnboarding=false -> onboarding', () => {
  assert.deepEqual(
    resolveBootstrapDestination({ hasSession: false, launchedSegment: null, hasSeenOnboarding: false }),
    { action: 'onboarding' }
  );
});

test('hasSession=false: undefined launchedSegment, hasSeenOnboarding=true -> signin (same as null)', () => {
  assert.deepEqual(
    resolveBootstrapDestination({ hasSession: false, launchedSegment: undefined, hasSeenOnboarding: true }),
    { action: 'signin' }
  );
});

for (const seenOnboarding of [true, false]) {
  test(`hasSession=false: launchedSegment="auth", hasSeenOnboarding=${seenOnboarding} -> none`, () => {
    assert.deepEqual(
      resolveBootstrapDestination({ hasSession: false, launchedSegment: 'auth', hasSeenOnboarding: seenOnboarding }),
      { action: 'none' }
    );
  });

  for (const segment of PUBLIC_ROUTES) {
    test(`hasSession=false: launchedSegment=${JSON.stringify(segment)} (public route), hasSeenOnboarding=${seenOnboarding} -> none`, () => {
      assert.deepEqual(
        resolveBootstrapDestination({ hasSession: false, launchedSegment: segment, hasSeenOnboarding: seenOnboarding }),
        { action: 'none' }
      );
    });
  }
}

test('hasSession=false: unknown launchedSegment, hasSeenOnboarding=true -> signin', () => {
  assert.deepEqual(
    resolveBootstrapDestination({ hasSession: false, launchedSegment: 'roadsigns', hasSeenOnboarding: true }),
    { action: 'signin' }
  );
});

test('hasSession=false: unknown launchedSegment, hasSeenOnboarding=false -> onboarding', () => {
  assert.deepEqual(
    resolveBootstrapDestination({ hasSession: false, launchedSegment: 'roadsigns', hasSeenOnboarding: false }),
    { action: 'onboarding' }
  );
});

// ── ENTRY_POINTS segments are unauthenticated non-public routes too ─────
// (e.g. launchedSegment='onboarding' with no session isn't special-cased —
// it's just not in PUBLIC_ROUTES/'auth', so the normal signin/onboarding
// split applies exactly as if it were any other unrecognised segment.)

test('hasSession=false: launchedSegment="onboarding" (an entry point, but not public/auth), hasSeenOnboarding=true -> signin', () => {
  assert.deepEqual(
    resolveBootstrapDestination({ hasSession: false, launchedSegment: 'onboarding', hasSeenOnboarding: true }),
    { action: 'signin' }
  );
});

test('hasSession=false: launchedSegment="landing" (an entry point, but not public/auth), hasSeenOnboarding=false -> onboarding', () => {
  assert.deepEqual(
    resolveBootstrapDestination({ hasSession: false, launchedSegment: 'landing', hasSeenOnboarding: false }),
    { action: 'onboarding' }
  );
});
