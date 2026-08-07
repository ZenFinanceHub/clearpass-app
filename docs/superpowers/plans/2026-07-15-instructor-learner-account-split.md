# Instructor/Learner Account Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current "instructor_code happens to be non-null" heuristic with a real `account_type` chosen explicitly at signup, make instructor accounts genuinely distinct from learner accounts (no tab bar, no Practice/Mock/learner content), and retire the duplicate `auth.tsx` signup screen so the account-type choice can't be bypassed.

**Architecture:** Add a `profiles.account_type` column (`'learner' | 'instructor'`, NOT NULL). Defer profile-row creation in the signup flow to a new `/auth/choose-account-type` screen that is the single place any new profile gets created (from email signup, Apple signup, or Google signup) — this closes the gap where social sign-in on the Sign In screen could silently create an account with no type. Referral links and manually-typed referral/instructor codes always force the learner path and skip the picker entirely. Post-login routing becomes account-type-aware via one shared helper (`resolvePostAuthRoute`), instructor accounts land directly on the Instructor Dashboard and never see the tab bar, and the `(tabs)` layout itself guards against an instructor account reaching learner screens by direct navigation.

**Tech Stack:** Expo Router (file-based routing), React Native, Supabase (Postgres + Auth), Playwright for e2e (no unit test runner exists in `apps/mobile` today — `packages/core` has vitest but screens/routing logic has no unit test precedent, so this plan follows the existing convention of Playwright e2e + manual verification for screen/routing changes, and does not introduce a new test runner).

## Global Constraints

- All file paths below are relative to `/home/craig/clearpass/apps/mobile` unless stated otherwise.
- `account_type` values are exactly `'learner'` and `'instructor'` (lowercase, no other values) — used verbatim in code and the DB CHECK constraint.
- Never let a profile row exist with `account_type IS NULL` after Task 1 — the column is NOT NULL from that point on.
- Referral codes (whether arriving via `?ref=` deep link or typed manually into the "Instructor or friend's code" field) always force `account_type = 'learner'` and skip the picker — no override, per confirmed decision.
- Don't touch `apps/web` or `apps/web-backup` — those are the separate static marketing site, not part of the Expo Router auth flow this plan changes.
- No new test runner: verify screen/routing changes via `npx tsc --noEmit` (from `apps/mobile`), the Playwright e2e suite (`npm run test:e2e`), and the manual QA checklist in Task 17. Don't add Jest/vitest to `apps/mobile` — it doesn't have one today and this plan isn't the place to introduce one.

---

## Design decisions (read before starting)

### 1. `auth.tsx` is retired, not reconciled

`app/auth.tsx` and `app/auth/signup.tsx` are two independent implementations of "create an account" — `auth.tsx`'s `tryInsertProfile()` inserts `{ id, username }` with zero referral or (soon) account-type awareness. Since `account_type` is about to become a NOT NULL column, every code path that can create a profile row must go through the account-type decision. Maintaining that logic in two places is exactly the duplication that caused the current bug (an account can end up "instructor" by accident). `auth/signin.tsx` and `auth/signup.tsx` already exist as clean, independent, purpose-built replacements for `auth.tsx`'s combined sign-in/sign-up tabs, so retiring `auth.tsx` is a deletion, not new work. Task 9 deletes it and repoints every caller.

### 2. Every profile-creating path funnels through one new screen

Four things can create a first profile row today: email signup (`auth/signup.tsx`), Apple sign-up, Google sign-up, and — a gap the audit missed until this plan — **Apple/Google sign-in from `auth/signin.tsx`**, because `signInWithApple`/`signInWithGoogle` silently call `ensureProfile()` and create a profile for a first-time social user regardless of which screen (`signin.tsx` or `signup.tsx`) triggered it. A shallow fix (just adding a picker to `signup.tsx`'s form) would leave that gap open — a brand-new user could tap "Continue with Google" on the *Sign In* screen and get an account with no explicit type choice at all.

The fix: `ensureProfile()` in `src/socialAuth.ts` stops inserting a profile. It becomes `checkIsNewUser()` — a read-only check — plus a small helper that stashes the display name/email for later. Every path that discovers a new user (email signup post-confirmation, Apple sign-up/sign-in, Google sign-up/sign-in) now navigates to **`/auth/choose-account-type`**, which is the only place a profile row gets inserted (except the forced-referral fast path below, which still needs to run before email confirmation is possible). This is more invasive than "add a picker to the signup form," but it's the only way to guarantee no profile can exist without an explicit type.

### 3. Referral codes force learner and skip the picker — including manually-typed codes

The user's confirmed decision covers `?ref=code` deep links. This plan extends the same rule to the existing "Instructor or friend's code (optional)" text field on `auth/signup.tsx` — if a user types *any* code into that field (not just one pre-filled from a link), the mechanism and intent are identical (they're signing up as someone's learner), so the picker should not offer "I'm an instructor" in that case either. `choose-account-type.tsx` re-checks for a pending referral code on mount (not just relying on `signup.tsx` having handled it) because the *silent* referral-capture path (`https://getclearpass.co.uk?ref=X` → written straight to `AsyncStorage`, no navigation) can leave a code sitting in storage that only `signup.tsx`'s form submission currently reads — a user who instead taps "Continue with Google" bypasses that read entirely. Re-checking on the new screen closes that gap too.

### 4. Schema: add `account_type`, backfill safe, then promote known instructors — don't guess first

`profiles` gets a new `account_type TEXT NOT NULL DEFAULT 'learner' CHECK (account_type IN ('learner','instructor'))` column (Task 1), following the same idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + backfill style already used for `instructor_code`/`referral_code` at the bottom of `schema.sql`. Everyone defaults to `'learner'` first — this is the fail-safe direction, since under-classifying just means a real instructor keeps working from a slightly wrong screen until Task 2 runs, while over-classifying would silently cut off a learner's Practice/Mock access.

Task 2 is a **separate, human-reviewed** step: the old heuristic (`instructor_code IS NOT NULL`) is unreliable, because `instructor.tsx`'s `loadData()` minted an `instructor_code` for *any* account that ever opened `/instructor` in *either* mode — including every learner who ever tapped "Linked Instructors" in Settings out of curiosity (that row was shown unconditionally to everyone). So a large, unknown fraction of ordinary learners likely already have a non-null `instructor_code`. Task 2 provides a report query that narrows this down using a stronger signal (has an actual `instructor_relationships` row as the instructor, or an `instructor_earnings` row) and a manual promotion list for Craig to fill in with the known real instructors (per project memory, a small number are already testing the app) — run against the live Supabase project, not something an agent can safely automate blind.

### 5. Instructor Dashboard becomes the account's home — needs its own Sign Out

Today `instructor.tsx` is only ever reached by pushing from Settings, so its header has a back arrow (`router.back()`) and no sign-out control — Settings already has one. Once instructor accounts land directly on the dashboard after login and never see the tab bar (Task 12/14), there is no "back" destination and no Settings screen to sign out from. Task 12 replaces the back arrow with a Sign Out button (same `supabase.auth.signOut()` call Settings already uses) when `instructor.tsx` is the account's landing screen.

### 6. `instructor.tsx`'s `mode` param and `LearnerModeView` split into their own file

The `mode=learner` / `mode=instructor` query param on `/instructor` is the root of the original bug — one file, one `loadData()`, two unrelated identities sharing a screen, with the instructor-code-minting code running before the mode check. Task 11/12 split it: `app/linked-instructors.tsx` (new) gets the learner-side "who's tracking me" view (formerly `LearnerModeView`), reached only from Settings, unchanged in behavior. `app/instructor.tsx` keeps only the instructor dashboard, has no `mode` param, and is reached either by an instructor account landing there post-login or (removed in this plan — see Design Decision 7) no longer reachable via a Settings button at all.

### 7. The self-service "Instructor / Parent Dashboard" Settings row is deleted, not gated

Today any learner can tap this row and become a de facto instructor (per the old heuristic). Since instructor-ness is now decided once at signup, there is no "become an instructor later" flow in this plan — the row is deleted outright (Task 13). This matches the confirmed decision to remove the self-mint heuristic entirely rather than layer account_type on top of it. (If Craig later wants a supported way for an existing learner to convert, that's new product scope, not a bug fix — flagged as a follow-up, not built here.)

### 8. Reclassifying an account after signup has no UI, by design — and isn't blocked at the DB layer either

No screen in this plan lets a user change their own `account_type` after signup (mirrors decision 7 — no self-service). The existing `profiles` RLS policy (`FOR UPDATE USING (auth.uid() = id)`) doesn't restrict *which* columns a user can update, matching the app's existing trust model (nothing else in `schema.sql` enforces column-level immutability, e.g. the old `instructor_code` self-upsert already worked the same way). This plan doesn't add new RLS restrictions — that would be new infrastructure beyond what's asked. If someone signs up as the wrong type, the fix is the same manual `UPDATE profiles SET account_type = ...` Craig would run for Task 2, not a new support tool.

### 9. Instructor lockout is enforced once, at the tab navigator — not screen-by-screen

The learner-only screens (`practice`, `mock`, `tutor`, `hazard`, `highwaycode`, `roadsigns`, `learn`, `progress`, `leaderboard`) all live inside the single `(tabs)` route group and share one `Tabs` navigator (`app/(tabs)/_layout.tsx`). Rather than adding an `account_type` check to nine separate screen files, Task 14 adds one guard at the layout level: on mount, if the signed-in account is `'instructor'`, redirect to `/instructor` before any tab content renders. This covers 100% of realistic in-app navigation (mobile users never type URLs). It does **not** cover the handful of root-level duplicate screens that exist outside `(tabs)/` (e.g. `app/progress.tsx` alongside `app/(tabs)/progress.tsx`) being reached by a direct web URL — that's a pre-existing duplication in the codebase unrelated to this feature, and gating it is out of scope here; flagged as a fast-follow if Craig cares about the web-build direct-URL edge case specifically.

---

## File structure

| File | Change |
|---|---|
| `supabase/schema.sql` | Modify — add `account_type` column + constraints (Task 1), instructor reclassification script (Task 2) |
| `src/accountCodes.ts` | Create — `generateInstructorCode()` / `generateReferralCode()`, moved out of `instructor.tsx` |
| `src/postAuthRouting.ts` | Create — `resolvePostAuthRoute(userId)` shared routing decision |
| `src/socialAuth.ts` | Modify — `ensureProfile()` → `checkIsNewUser()` + `stashPendingIdentity()`, no more silent insert |
| `app/auth/choose-account-type.tsx` | Create — the explicit learner/instructor picker; the only place a profile row is created outside the forced-referral path |
| `app/auth/signup.tsx` | Modify — defer profile creation unless a referral code is present; check `AsyncStorage` for a silently-captured code on mount too |
| `app/auth/signin.tsx` | Modify — route through `resolvePostAuthRoute`; social handlers send new users to the picker |
| `app/auth.tsx` | Delete |
| `app/_layout.tsx` | Modify — drop `auth` Stack.Screen, add `auth/choose-account-type`, bootstrap uses `resolvePostAuthRoute` |
| `app/index.tsx` | Modify — repoint `/auth` → `/auth/signup` or `/auth/signin` |
| `app/landing.tsx` | Modify — repoint 6 `/auth` references |
| `app/(tabs)/practice.tsx` | Modify — repoint 2 `/auth` references → `/auth/signin` |
| `app/(tabs)/progress.tsx` | Modify — repoint 2 `/auth` references → `/auth/signin` |
| `app/(tabs)/leaderboard.tsx` | Modify — repoint 1 `/auth` reference → `/auth/signin` |
| `app/linked-instructors.tsx` | Create — learner-side "Linked Instructors" view, moved out of `instructor.tsx` |
| `app/instructor.tsx` | Modify — instructor-only, no `mode` param, Sign Out header |
| `app/(tabs)/settings.tsx` | Modify — delete self-service instructor row, repoint "Linked Instructors" row |
| `app/(tabs)/_layout.tsx` | Modify — guard: instructor accounts redirect to `/instructor` before tabs render |
| `e2e/public-routes.spec.ts` | Modify — delete the `/auth` describe block |
| `e2e/auth-gated-routes.spec.ts` | Modify — add `/linked-instructors`, `/auth/choose-account-type` |
| `e2e/account-type-signup.spec.ts` | Create — rendering-only smoke tests for the picker |

---

### Task 1: Add `account_type` column to `profiles`

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Produces: `profiles.account_type TEXT NOT NULL DEFAULT 'learner'`, values `'learner' | 'instructor'`, enforced by CHECK constraint `profiles_account_type_check`.

- [ ] **Step 1: Append the migration to `schema.sql`**

Add this block at the very end of `supabase/schema.sql` (after the Stripe Connect payout schema section — the `instructor_earnings_status_check` constraint is currently the last statement in the file; append after it):

```sql
-- ─────────────────────────────────────────────────────────────────
-- Account type: learner vs instructor.
--
-- Replaces the old heuristic of "instructor_code is non-null" — that
-- column was auto-minted the first time ANY account opened /instructor,
-- in either mode, so it never reliably indicated a real instructor.
-- Everyone defaults to 'learner' (fail-safe); real instructors are
-- promoted by the reviewed script that follows this file separately —
-- see docs/superpowers/plans/2026-07-15-instructor-learner-account-split.md
-- Task 2. Do not add a blanket 'instructor' backfill here.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_type TEXT;
UPDATE profiles SET account_type = 'learner' WHERE account_type IS NULL;
ALTER TABLE profiles ALTER COLUMN account_type SET DEFAULT 'learner';
ALTER TABLE profiles ALTER COLUMN account_type SET NOT NULL;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_account_type_check
  CHECK (account_type IN ('learner', 'instructor'));
-- (existing profile RLS policies already cover this column)
```

- [ ] **Step 2: Apply it to the Supabase project**

Run the appended SQL against the project's Supabase SQL editor (or `supabase db push` / however this repo currently applies `schema.sql` — check for a documented apply step; if none exists, this file has clearly been hand-run before, so paste the new block into the Supabase SQL editor and execute it).

- [ ] **Step 3: Verify**

Run in the Supabase SQL editor:

```sql
SELECT account_type, count(*) FROM profiles GROUP BY account_type;
```

Expected: a single row, `account_type = 'learner'`, count matching the total row count in `profiles`. Then confirm the constraint is live:

```sql
INSERT INTO profiles (id, username, account_type) VALUES (gen_random_uuid(), 'test_invalid_type', 'parent');
```

Expected: fails with a `profiles_account_type_check` constraint violation. (Don't leave this test row around — it should fail to insert, so there's nothing to clean up.)

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add account_type column to profiles, defaulting to learner"
```

---

### Task 2: Reviewed instructor reclassification

**Files:** None in the repo — this is a one-off script run against the live Supabase project. Document the queries here for the record.

**Interfaces:**
- Consumes: `profiles.account_type` from Task 1 (currently all `'learner'`).
- Produces: a small, human-confirmed set of rows with `account_type = 'instructor'`; `instructor_code` cleared for everyone else.

- [ ] **Step 1: Run the report query**

```sql
SELECT
  p.id,
  p.username,
  u.email,
  p.instructor_code,
  (SELECT count(*) FROM instructor_relationships r WHERE r.instructor_id = p.id) AS relationships_as_instructor,
  (SELECT count(*) FROM instructor_earnings e WHERE e.instructor_id = p.id) AS earnings_rows
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.instructor_code IS NOT NULL
ORDER BY relationships_as_instructor DESC, earnings_rows DESC;
```

- [ ] **Step 2: Craig reviews the output and confirms the real instructor list**

Cross-reference against the known driving instructors currently testing the app. Rows with `relationships_as_instructor > 0` or `earnings_rows > 0` are strong signals of real usage; a row with only a non-null `instructor_code` and zero relationships/earnings is almost certainly a learner who once tapped "Linked Instructors" out of curiosity (that row was visible to everyone pre-split) and should stay `'learner'`.

- [ ] **Step 3: Promote the confirmed instructors**

```sql
UPDATE profiles SET account_type = 'instructor'
WHERE id IN (
  '<uuid-1>',
  '<uuid-2>'
  -- one row per confirmed instructor from Step 2
);
```

- [ ] **Step 4: Clear `instructor_code` for everyone not promoted**

```sql
UPDATE profiles
SET instructor_code = NULL
WHERE account_type = 'learner' AND instructor_code IS NOT NULL;
```

(`referral_code` is left untouched — it's the general share-your-code mechanism, not instructor-specific, and isn't part of the account-type signal.)

- [ ] **Step 5: Verify**

```sql
SELECT account_type, count(*) FROM profiles GROUP BY account_type;
SELECT count(*) FROM profiles WHERE account_type = 'learner' AND instructor_code IS NOT NULL;
```

Expected: the second query returns `0`.

---

### Task 3: Move code generators into a shared file

**Files:**
- Create: `src/accountCodes.ts`
- Modify: `app/instructor.tsx:162-171` (delete — moved, not duplicated)

**Note:** the line numbers in this task assume `app/instructor.tsx` as it exists after the Stripe Connect payout feature merged (the file now has `payoutButtonLabel`, `PayoutHistorySection`, `connectStatus`/`payouts` state, and an `AppState` refresh listener not present when this plan was first drafted — re-run `grep -n "^function generateCode"` on the actual file before editing if these line numbers don't match).

**Interfaces:**
- Produces: `generateInstructorCode(): string`, `generateReferralCode(username: string): string` — used by Task 6 (`choose-account-type.tsx`, primary use) and Task 12 (`instructor.tsx`, defensive fallback only).

- [ ] **Step 1: Create `src/accountCodes.ts`**

```ts
export function generateInstructorCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function generateReferralCode(username: string): string {
  const prefix = username.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  const digits = Math.floor(100 + Math.random() * 900).toString();
  return prefix + digits;
}
```

- [ ] **Step 2: Delete the originals from `app/instructor.tsx`**

Remove lines 149-158 (`function generateCode()` and `function generateReferralCode()`). Task 12 updates the remaining usage in this file to import from `@/src/accountCodes` instead.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: errors about `generateCode`/`generateReferralCode` being undefined in `instructor.tsx` — expected at this point, since Task 12 hasn't updated the call site yet. Confirm the *only* errors are in `instructor.tsx` referencing these two names.

- [ ] **Step 4: Commit**

```bash
git add src/accountCodes.ts app/instructor.tsx
git commit -m "refactor: move instructor/referral code generators into src/accountCodes.ts"
```

(This commit will leave `instructor.tsx` non-compiling until Task 12 — that's fine for an in-progress branch; keep going.)

---

### Task 4: Shared post-auth routing decision

**Files:**
- Create: `src/postAuthRouting.ts`

**Interfaces:**
- Consumes: `profiles.account_type` (Task 1).
- Produces: `resolvePostAuthRoute(userId: string): Promise<'/(tabs)/home' | '/instructor' | '/auth/choose-account-type'>` — used by Task 8 (`signin.tsx`), Task 9 (`_layout.tsx` bootstrap), Task 7's social handlers if applicable.

- [ ] **Step 1: Create `src/postAuthRouting.ts`**

```ts
import { supabase } from './supabase';

export type PostAuthRoute = '/(tabs)/home' | '/instructor' | '/auth/choose-account-type';

export async function resolvePostAuthRoute(userId: string): Promise<PostAuthRoute> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', userId)
    .maybeSingle();

  const accountType = (profile as { account_type?: string } | null)?.account_type;
  if (!accountType) return '/auth/choose-account-type';
  return accountType === 'instructor' ? '/instructor' : '/(tabs)/home';
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no new errors from this file (it isn't imported anywhere yet).

- [ ] **Step 3: Commit**

```bash
git add src/postAuthRouting.ts
git commit -m "feat: add resolvePostAuthRoute helper for account-type-aware navigation"
```

---

### Task 5: `socialAuth.ts` stops silently creating profiles

**Files:**
- Modify: `src/socialAuth.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SocialAuthResult` unchanged (`{ session, isNewUser }`); `isNewUser` now means "no profile row exists yet" rather than "a profile row was just silently created." Task 6/7/8 rely on `isNewUser` to decide whether to route to `/auth/choose-account-type`.

- [ ] **Step 1: Replace `ensureProfile` with `checkIsNewUser` + `stashPendingIdentity`**

Replace the full `ensureProfile` function (current lines 12-31) with:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_USERNAME_KEY = '@clearpass/pending_username';

async function checkIsNewUser(userId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  return !existing;
}

async function stashPendingIdentity(displayName?: string, email?: string): Promise<void> {
  let username = '';
  if (displayName) {
    username = displayName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').slice(0, 20);
  }
  if (!username && email) {
    username = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
  }
  if (!username) username = `user${Math.floor(Math.random() * 99999)}`;
  await AsyncStorage.setItem(PENDING_USERNAME_KEY, username);
}
```

Add the `AsyncStorage` import at the top of the file alongside the existing imports.

- [ ] **Step 2: Update `signInWithApple`**

Change:

```ts
  const isNewUser = await ensureProfile(session.user.id, displayName, email);

  return { session, isNewUser };
```

to:

```ts
  const isNewUser = await checkIsNewUser(session.user.id);
  if (isNewUser) await stashPendingIdentity(displayName, email);

  return { session, isNewUser };
```

- [ ] **Step 3: Update `signInWithGoogle`** the same way

Change:

```ts
  const isNewUser = await ensureProfile(session.user.id, displayName, session.user.email);

  return { session, isNewUser };
```

to:

```ts
  const isNewUser = await checkIsNewUser(session.user.id);
  if (isNewUser) await stashPendingIdentity(displayName, session.user.email);

  return { session, isNewUser };
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors in `socialAuth.ts`. Errors may remain in `signup.tsx`/`signin.tsx` until Tasks 7/8.

- [ ] **Step 5: Commit**

```bash
git add src/socialAuth.ts
git commit -m "refactor: social auth no longer silently creates a profile row"
```

---

### Task 6: Create the account-type choice screen

**Files:**
- Create: `app/auth/choose-account-type.tsx`

**Interfaces:**
- Consumes: `AsyncStorage['@clearpass/pending_username']` (Task 5, or `signup.tsx` in Task 7), `AsyncStorage['referral_code']` (existing key, written by the deep-link handler in `_layout.tsx` and by `signup.tsx`), `generateInstructorCode`/`generateReferralCode` (Task 3).
- Produces: the only remaining place (besides `signup.tsx`'s forced-referral path) that inserts a `profiles` row. Navigates to `/auth/testdate` (learner) or `/instructor` (instructor).

- [ ] **Step 1: Create `app/auth/choose-account-type.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from '@/src/supabase';
import { Colors } from '@/src/constants/theme';
import { generateInstructorCode, generateReferralCode } from '@/src/accountCodes';

const PENDING_USERNAME_KEY = '@clearpass/pending_username';
const REFERRAL_CODE_KEY    = 'referral_code';

type AccountType = 'learner' | 'instructor';

async function tryInsertProfile(payload: Record<string, string>): Promise<boolean> {
  const { error } = await supabase.from('profiles').insert(payload);
  return !error || error.code === '23505';
}

export default function ChooseAccountTypeScreen() {
  const [checking, setChecking] = useState(true);
  const [saving, setSaving]     = useState<AccountType | null>(null);
  const [error, setError]       = useState('');

  useEffect(() => {
    void resolveReferral();
  }, []);

  async function resolveReferral() {
    const code = await AsyncStorage.getItem(REFERRAL_CODE_KEY);
    if (code) {
      await finish('learner', code);
      return;
    }
    setChecking(false);
  }

  async function finish(accountType: AccountType, referralCode: string | null) {
    setSaving(accountType);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/signin'); return; }

      const username = (await AsyncStorage.getItem(PENDING_USERNAME_KEY))
        ?? `user${Math.floor(Math.random() * 99999)}`;

      const payload: Record<string, string> = {
        id: user.id,
        username,
        account_type: accountType,
      };
      if (referralCode) payload.referred_by = referralCode;
      if (accountType === 'instructor') {
        payload.instructor_code = generateInstructorCode();
        payload.referral_code = generateReferralCode(username);
      }

      let ok = await tryInsertProfile(payload);
      if (!ok) {
        await new Promise<void>((res) => setTimeout(res, 1000));
        ok = await tryInsertProfile(payload);
      }
      if (!ok) {
        setError('Could not set up your account. Please try again.');
        setSaving(null);
        return;
      }

      if (referralCode) {
        try {
          const { data: refProfile } = await supabase
            .from('profiles')
            .select('id, account_type')
            .eq('referral_code', referralCode)
            .maybeSingle();
          if (refProfile && (refProfile as { account_type?: string }).account_type === 'instructor') {
            await supabase.from('instructor_relationships').insert({
              instructor_id: (refProfile as { id: string }).id,
              learner_id: user.id,
              status: 'pending',
              invite_code: referralCode,
            });
          }
        } catch {}
      }

      router.replace(accountType === 'instructor' ? '/instructor' : '/auth/testdate');
    } catch {
      setError('An unexpected error occurred.');
      setSaving(null);
    }
  }

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.indigo} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>{'ClearPass'}</Text>
      <Text style={styles.title}>{'How will you use ClearPass?'}</Text>

      {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.card, saving !== null && styles.cardDisabled]}
        onPress={() => void finish('learner', null)}
        disabled={saving !== null}
        activeOpacity={0.85}
      >
        {saving === 'learner'
          ? <ActivityIndicator color={Colors.indigo} />
          : (
              <>
                <Text style={styles.cardEmoji}>{'🎓'}</Text>
                <Text style={styles.cardTitle}>{"I'm a learner"}</Text>
                <Text style={styles.cardBody}>{'Practice questions, mock tests and hazard perception to pass first time.'}</Text>
              </>
            )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, saving !== null && styles.cardDisabled]}
        onPress={() => void finish('instructor', null)}
        disabled={saving !== null}
        activeOpacity={0.85}
      >
        {saving === 'instructor'
          ? <ActivityIndicator color={Colors.indigo} />
          : (
              <>
                <Text style={styles.cardEmoji}>{'🚗'}</Text>
                <Text style={styles.cardTitle}>{"I'm an instructor"}</Text>
                <Text style={styles.cardBody}>{"Track your pupils' progress and share your referral link."}</Text>
              </>
            )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA', paddingHorizontal: 28, paddingTop: 100, gap: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' },

  logo: { fontSize: 28, fontWeight: '900', color: Colors.indigo, letterSpacing: 2, marginBottom: 4, textAlign: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 16 },

  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center', marginBottom: 4 },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  cardDisabled: { opacity: 0.6 },
  cardEmoji: { fontSize: 32 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  cardBody: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 18 },
});
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors from this new file (it isn't registered in `_layout.tsx` yet — that's Task 9 — but Expo Router doesn't require registration for `tsc` to pass).

- [ ] **Step 3: Commit**

```bash
git add app/auth/choose-account-type.tsx
git commit -m "feat: add explicit learner/instructor choice screen"
```

---

### Task 7: `signup.tsx` defers profile creation

**Files:**
- Modify: `app/auth/signup.tsx`

**Interfaces:**
- Consumes: `resolvePostAuthRoute` not needed here (signup always means a session was just created or confirmation is pending). `PENDING_USERNAME_KEY`, `REFERRAL_CODE_KEY` (existing).
- Produces: navigates to `/auth/choose-account-type` (no referral code) or `/auth/testdate` (referral code present, profile already created inline).

- [ ] **Step 1: Replace `handleSignUp` (current lines 47-115)**

```tsx
  async function handleSignUp() {
    setError('');
    if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (!email.trim())               { setError('Please enter an email address.'); return; }
    if (password.length < 6)         { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const { data: { user, session }, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (authError) { setError(authError.message); return; }

      // user.id is available even when email confirmation is required (session will be null)
      const userId = session?.user?.id ?? user?.id;
      const name = username.trim();
      await AsyncStorage.setItem(PENDING_USERNAME_KEY, name);

      const code = referralCode.trim().toUpperCase() || (await AsyncStorage.getItem(REFERRAL_CODE_KEY)) || null;

      if (userId && code) {
        // A referral/instructor code — typed manually or pre-filled from a
        // ?ref= link — always forces the learner path with no picker shown.
        await AsyncStorage.setItem(REFERRAL_CODE_KEY, code);
        const { error: profileError } = await supabase.from('profiles').insert({
          id: userId,
          username: name,
          account_type: 'learner',
          referred_by: code,
        });
        if (!profileError || profileError.code === '23505') {
          try {
            const { data: refProfile } = await supabase
              .from('profiles')
              .select('id, account_type')
              .eq('referral_code', code)
              .maybeSingle();

            if (!refProfile) {
              setReferralWarn('Code not recognised — continuing without it.');
            } else if ((refProfile as { account_type?: string }).account_type === 'instructor') {
              // Code owner is an instructor — create a pending relationship;
              // the pupil must explicitly accept before progress is shared
              // (see Settings → Linked Instructors → Instructor Requests).
              await supabase.from('instructor_relationships').insert({
                instructor_id: (refProfile as { id: string }).id,
                learner_id: userId,
                status: 'pending',
                invite_code: code,
              });
            }
          } catch {}
        }
      }

      if (!session) {
        // Email confirmation is required — show holding screen rather than redirecting
        setAwaitingConfirm(true);
        return;
      }

      await new Promise<void>((res) => setTimeout(res, 400));
      router.replace(code ? '/auth/testdate' : '/auth/choose-account-type');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }
```

- [ ] **Step 2: Update `handleAppleSignIn` and `handleGoogleSignIn`**

Change:

```tsx
      const result = await signInWithApple();
      router.replace(result.isNewUser ? '/auth/testdate' : '/(tabs)/home');
```

to:

```tsx
      const result = await signInWithApple();
      router.replace(result.isNewUser ? '/auth/choose-account-type' : await resolvePostAuthRoute(result.session.user.id));
```

and the equivalent in `handleGoogleSignIn`:

```tsx
      const result = await signInWithGoogle();
      if (result) router.replace(result.isNewUser ? '/auth/choose-account-type' : await resolvePostAuthRoute(result.session.user.id));
```

Add the import: `import { resolvePostAuthRoute } from '@/src/postAuthRouting';`

- [ ] **Step 3: Add the AsyncStorage referral fallback check to the initial `useEffect`**

The existing `useEffect` (current lines 40-45) only reacts to `params.ref`. Extend it so a silently-captured code (from the `getclearpass.co.uk?ref=` path, written straight to `AsyncStorage` by `_layout.tsx`'s deep-link handler with no navigation) is also picked up and shown in the field on mount, not just at submit time:

```tsx
  useEffect(() => {
    if (params.ref) {
      setReferralCode(params.ref);
      void AsyncStorage.setItem(REFERRAL_CODE_KEY, params.ref);
      return;
    }
    void AsyncStorage.getItem(REFERRAL_CODE_KEY).then((stored) => {
      if (stored) setReferralCode(stored);
    });
  }, [params.ref]);
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors in `signup.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/auth/signup.tsx
git commit -m "feat: defer profile creation to account-type choice screen in email signup"
```

---

### Task 8: `signin.tsx` routes through `resolvePostAuthRoute`

**Files:**
- Modify: `app/auth/signin.tsx`

**Interfaces:**
- Consumes: `resolvePostAuthRoute` (Task 4).
- Produces: existing users land on `/(tabs)/home` or `/instructor` per their `account_type`; brand-new social users (this is the gap identified in Design Decision 2) land on `/auth/choose-account-type`.

- [ ] **Step 1: Import the helper**

Add near the top: `import { resolvePostAuthRoute } from '@/src/postAuthRouting';`

- [ ] **Step 2: Update `handleSignIn` (email/password)**

Change:

```tsx
      } else {
        await new Promise<void>((res) => setTimeout(res, 400));
        router.replace('/(tabs)/home');
      }
```

to:

```tsx
      } else {
        await new Promise<void>((res) => setTimeout(res, 400));
        const { data: { user } } = await supabase.auth.getUser();
        const route = user ? await resolvePostAuthRoute(user.id) : '/(tabs)/home';
        router.replace(route);
      }
```

- [ ] **Step 3: Update `handleAppleSignIn` and `handleGoogleSignIn`**

Change:

```tsx
      const result = await signInWithApple();
      router.replace(result.isNewUser ? '/auth/testdate' : '/(tabs)/home');
```

to:

```tsx
      const result = await signInWithApple();
      router.replace(result.isNewUser ? '/auth/choose-account-type' : await resolvePostAuthRoute(result.session.user.id));
```

and equivalently for Google:

```tsx
      const result = await signInWithGoogle();
      if (result) router.replace(result.isNewUser ? '/auth/choose-account-type' : await resolvePostAuthRoute(result.session.user.id));
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors in `signin.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/auth/signin.tsx
git commit -m "feat: route sign-in through account-type-aware post-auth routing"
```

---

### Task 9: Retire `auth.tsx`, register the new screen

**Files:**
- Delete: `app/auth.tsx`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `resolvePostAuthRoute` (Task 4).

- [ ] **Step 1: Delete `app/auth.tsx`**

```bash
git rm app/auth.tsx
```

- [ ] **Step 2: Update the `Stack.Screen` list in `app/_layout.tsx`**

Change (around line 170):

```tsx
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
```

to:

```tsx
            <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
            <Stack.Screen name="auth/choose-account-type" options={{ headerShown: false }} />
```

- [ ] **Step 3: Update the bootstrap effect to use `resolvePostAuthRoute`**

Add the import: `import { resolvePostAuthRoute } from '@/src/postAuthRouting';`

Change (current lines ~88-97):

```tsx
        navigated.current = true;
        // Only redirect to home from unauthenticated entry points.
        // If the user is already on an authenticated route (e.g. direct web
        // navigation to /roadsigns), let it through without overriding.
        const entryPoints = new Set(['', 'index', 'onboarding', 'landing']);
        if (entryPoints.has(segments[0] ?? '')) {
          router.replace('/(tabs)/home');
        }
        return;
```

to:

```tsx
        navigated.current = true;
        // Only redirect to home from unauthenticated entry points.
        // If the user is already on an authenticated route (e.g. direct web
        // navigation to /roadsigns), let it through without overriding.
        const entryPoints = new Set(['', 'index', 'onboarding', 'landing']);
        if (entryPoints.has(segments[0] ?? '')) {
          const route = await resolvePostAuthRoute(session.user.id);
          router.replace(route);
        }
        return;
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors referencing `app/auth.tsx` or the removed `auth` screen name (Stack.Screen names aren't type-checked, so this mainly confirms `_layout.tsx` itself compiles). Then grep for any remaining reference to the deleted file:

```bash
grep -rn "app/auth'" app/ src/ 2>/dev/null
grep -rn "from '\.\./auth'" app/ 2>/dev/null
```

Expected: no output (Task 10 handles the `router.push('/auth')` call sites, which are string routes, not imports, so this grep is a sanity check that nothing imports the deleted component directly).

- [ ] **Step 5: Commit**

```bash
git add -A app/auth.tsx app/_layout.tsx
git commit -m "feat: retire auth.tsx, register choose-account-type route, route bootstrap by account type"
```

---

### Task 10: Repoint every remaining `/auth` reference

**Files:**
- Modify: `app/index.tsx`
- Modify: `app/landing.tsx`
- Modify: `app/(tabs)/practice.tsx`
- Modify: `app/(tabs)/progress.tsx`
- Modify: `app/(tabs)/leaderboard.tsx`

**Interfaces:** None — pure string-literal route changes. Rule applied throughout: "start using the app" CTAs → `/auth/signup`; "you must be signed in to do X" guards and explicit "Sign In" links → `/auth/signin`.

- [ ] **Step 1: `app/index.tsx`**

Line 33 (`resolveNoSession`, returning user with onboarding already seen):
```tsx
        router.replace('/auth');
```
→
```tsx
        router.replace('/auth/signin');
```

Line 64 (`handleGetStarted`):
```tsx
    router.replace('/auth');
```
→
```tsx
    router.replace('/auth/signup');
```

Line 69 (`handleSignIn`):
```tsx
    router.replace('/auth');
```
→
```tsx
    router.replace('/auth/signin');
```

- [ ] **Step 2: `app/landing.tsx`**

Line 53 (`handleGetPro` guard):
```tsx
  if (!user) { router.push('/auth'); return; }
```
→
```tsx
  if (!user) { router.push('/auth/signin'); return; }
```

Line 91 ("Sign In" nav link):
```tsx
<TouchableOpacity onPress={() => router.push('/auth')} activeOpacity={0.75}>
```
→
```tsx
<TouchableOpacity onPress={() => router.push('/auth/signin')} activeOpacity={0.75}>
```

Lines 94, 112, 115, 252 ("Start Free" nav CTA, hero "Start Free →", hero "See How It Works", pricing "Get started free") — all four:
```tsx
onPress={() => router.push('/auth')}
```
→
```tsx
onPress={() => router.push('/auth/signup')}
```

- [ ] **Step 3: `app/(tabs)/practice.tsx`**

Both occurrences (lines 310, 320, `handleProUpgrade` guard):
```tsx
    if (!user) { router.push('/auth'); return; }
```
```tsx
      router.push('/auth');
```
→
```tsx
    if (!user) { router.push('/auth/signin'); return; }
```
```tsx
      router.push('/auth/signin');
```

- [ ] **Step 4: `app/(tabs)/progress.tsx`**

Both occurrences (lines 182, 192, `handleUpgrade` guard) — same substitution as Step 3.

- [ ] **Step 5: `app/(tabs)/leaderboard.tsx`**

Line 91 ("Sign in to compete" button):
```tsx
onPress={() => router.push('/auth')}
```
→
```tsx
onPress={() => router.push('/auth/signin')}
```

- [ ] **Step 6: Verify no `/auth` string literals remain**

```bash
grep -rn "'/auth'" app/ --include="*.tsx"
```

Expected: no output.

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/index.tsx app/landing.tsx "app/(tabs)/practice.tsx" "app/(tabs)/progress.tsx" "app/(tabs)/leaderboard.tsx"
git commit -m "refactor: repoint all /auth references to /auth/signin or /auth/signup"
```

---

### Task 11: Split out `app/linked-instructors.tsx`

> **Superseded from the original draft:** the Stripe Connect payout feature merged into `main` after this plan was first written and simplified `LearnerModeView` along the way — the pending-invite Accept/Decline flow this task originally moved is gone from the current file. `LearnerModeView` now renders every non-rejected relationship directly (no `InstructorEntry` enrichment type, no per-instructor username join — it reads `learner_name`/`learner_email` straight off the relationship row). The code below matches `app/instructor.tsx` as it exists after that merge (current `LearnerModeView` at lines 1031-1229). Confirm with `grep -n "^function LearnerModeView" app/instructor.tsx` before starting — if the line number or body differs from what's quoted here, re-read the function and adjust the move accordingly; do not paste this task's code over a differently-shaped function.

**Files:**
- Create: `app/linked-instructors.tsx`
- Modify: `app/instructor.tsx` (delete moved code — Task 12 also modifies this file, but do the deletion here to keep the diff traceable to the move)

**Interfaces:**
- Produces: `LinkedInstructorsScreen` (default export), reached via `router.push('/linked-instructors')` (Task 13 repoints Settings to this).

- [ ] **Step 1: Create `app/linked-instructors.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/src/supabase';
import { useTheme } from '@/src/theme';
import { Colors } from '@/src/constants/theme';
import { Pip } from '@/src/components/Pip';

type RelStatus = 'pending' | 'accepted' | 'rejected';

type Relationship = {
  id: string;
  instructor_id: string;
  learner_id: string | null;
  learner_email: string | null;
  learner_name: string | null;
  status: RelStatus;
  created_at: string;
  invite_code: string | null;
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function LinkedInstructorsScreen() {
  const theme = useTheme();
  const [instructors, setInstructors] = useState<Relationship[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => { void loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/signin'); return; }

      const { data: rels } = await supabase
        .from('instructor_relationships')
        .select('*')
        .eq('learner_id', user.id)
        .neq('status', 'rejected');
      setInstructors((rels as Relationship[] | null) ?? []);
    } catch {
      // Table likely doesn't exist yet — show empty state
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: theme.cardColor, borderBottomColor: theme.borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack} activeOpacity={0.7}>
          <Text style={[styles.headerBackArrow, { color: theme.textColor }]}>{'←'}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>{'Linked Instructors'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.indigo} />
        </View>
      ) : (
        <LearnerModeView instructors={instructors} loading={loading} onRefresh={() => void loadData()} />
      )}
    </View>
  );
}

// ─── LearnerModeView (moved verbatim from app/instructor.tsx:1031-1229) ──────

function LearnerModeView({
  instructors,
  loading,
  onRefresh,
}: {
  instructors: Relationship[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const theme = useTheme();
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [enteredCode, setEnteredCode]     = useState('');
  const [linking, setLinking]             = useState(false);

  async function handleEnterCode() {
    const code = enteredCode.trim().toUpperCase();
    if (code.length !== 6 || linking) return;
    setLinking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: instructorProfile, error } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('instructor_code', code)
        .single();

      if (error || !instructorProfile) {
        Alert.alert('Code not found', 'Please check the code and try again.');
        return;
      }

      if (instructorProfile.id === user.id) {
        Alert.alert('That\'s your own code', 'You cannot link to yourself.');
        return;
      }

      const { data: existing } = await supabase
        .from('instructor_relationships')
        .select('id')
        .eq('instructor_id', instructorProfile.id)
        .eq('learner_id', user.id)
        .maybeSingle();

      if (existing) {
        Alert.alert('Already linked', 'You are already linked to this instructor.');
        return;
      }

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      await supabase.from('instructor_relationships').insert({
        instructor_id: instructorProfile.id,
        learner_id: user.id,
        learner_name: (myProfile as { username?: string } | null)?.username ?? null,
        status: 'accepted',
        invite_code: code,
      });

      const iname = (instructorProfile as { username?: string }).username ?? 'your instructor';
      Alert.alert('Linked!', `You are now linked to ${iname}.`);
      setEnteredCode('');
      setShowCodeModal(false);
      onRefresh();
    } catch {
      Alert.alert('Error', 'Could not link. Please try again.');
    } finally {
      setLinking(false);
    }
  }

  async function handleRemove(relId: string, instructorName: string) {
    Alert.alert(
      'Remove access',
      `${instructorName} will no longer be able to view your progress.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await supabase.from('instructor_relationships').delete().eq('id', relId);
              onRefresh();
            })();
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={[styles.loadingText, { color: theme.subTextColor }]}>{'Loading...'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.dashTitle, { color: theme.textColor }]}>{'Linked Instructors'}</Text>
      <Text style={[styles.learnerModeSub, { color: theme.subTextColor }]}>
        {'These people can view your progress on ClearPass.'}
      </Text>

      {instructors.length === 0 ? (
        <View style={[styles.instructorEmpty, { backgroundColor: theme.cardColor }]}>
          <Pip size={64} mood="curious" />
          <Text style={[styles.instructorEmptyTitle, { color: theme.textColor }]}>
            {'No one is monitoring you yet'}
          </Text>
          <Text style={[styles.instructorEmptySub, { color: theme.subTextColor }]}>
            {'Enter an instructor code to allow a parent or instructor to follow your progress.'}
          </Text>
        </View>
      ) : (
        instructors.map(rel => (
          <View key={rel.id} style={[styles.instructorCard, { backgroundColor: theme.cardColor }]}>
            <View style={[styles.avatarCircle, { backgroundColor: Colors.indigo }]}>
              <Text style={styles.avatarText}>
                {getInitials(rel.learner_name ?? rel.learner_email ?? 'IN')}
              </Text>
            </View>
            <View style={styles.learnerMeta}>
              <Text style={[styles.learnerName, { color: theme.textColor }]}>
                {rel.learner_name ?? rel.learner_email ?? 'Instructor'}
              </Text>
              <Text style={[styles.learnerSub, { color: theme.subTextColor }]}>
                {'Linked '}{formatDate(rel.created_at)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => void handleRemove(rel.id, rel.learner_name ?? rel.learner_email ?? 'Instructor')}
              activeOpacity={0.75}
            >
              <Text style={styles.removeBtnText}>{'Remove'}</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <TouchableOpacity
        style={styles.enterCodeBtn}
        onPress={() => setShowCodeModal(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.enterCodeBtnText}>{'Enter Instructor Code'}</Text>
      </TouchableOpacity>

      {/* Enter code modal */}
      <Modal visible={showCodeModal} transparent animationType="fade" onRequestClose={() => setShowCodeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>{'Enter Instructor Code'}</Text>
            <Text style={[styles.codeLabel, { color: theme.subTextColor }]}>
              {'Ask your instructor or parent for their 6-character code.'}
            </Text>
            <TextInput
              style={[styles.codeInput, { color: theme.textColor }]}
              value={enteredCode}
              onChangeText={v => setEnteredCode(v.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.addEmailBtn, (enteredCode.length < 6 || linking) && styles.btnDisabled]}
              onPress={() => void handleEnterCode()}
              activeOpacity={0.85}
              disabled={enteredCode.length < 6 || linking}
            >
              <Text style={styles.addEmailBtnText}>{linking ? 'Linking...' : 'Link Account'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => { setEnteredCode(''); setShowCodeModal(false); }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCancelText}>{'Cancel'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles (copied from app/instructor.tsx — both files share the same
// header/card/modal visual language; trimming to only the keys this file
// uses is a safe follow-up cleanup, not required for correctness) ─────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  headerBack: { width: 32 },
  headerBackArrow: { fontSize: 22 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  headerSpacer: { width: 32 },

  listContent: { padding: 16, gap: 12, paddingBottom: 48 },
  dashTitle: { fontSize: 18, fontWeight: '800', marginTop: 8 },
  learnerModeSub: { fontSize: 13, marginBottom: 4 },

  instructorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  learnerMeta: { flex: 1 },
  learnerName: { fontSize: 15, fontWeight: '700' },
  learnerSub: { fontSize: 12, marginTop: 2 },

  removeBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  removeBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },

  instructorEmpty: { alignItems: 'center', borderRadius: 16, padding: 24, gap: 8 },
  instructorEmptyTitle: { fontSize: 16, fontWeight: '800' },
  instructorEmptySub: { fontSize: 13, textAlign: 'center' },

  enterCodeBtn: {
    backgroundColor: Colors.indigo,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  enterCodeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', borderRadius: 16, padding: 20, gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  codeLabel: { fontSize: 13 },
  codeInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  addEmailBtn: { backgroundColor: Colors.indigo, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  addEmailBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
});
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors in `linked-instructors.tsx`. `instructor.tsx` still has its own errors until Task 12 (not yet updated).

- [ ] **Step 3: Commit**

```bash
git add app/linked-instructors.tsx
git commit -m "feat: add standalone linked-instructors screen for the learner side"
```

---

### Task 12: Trim `app/instructor.tsx` to instructor-only

> **Superseded from the original draft:** the Stripe Connect payout feature merged into `main` after this plan was first written, adding `connectStatus`/`payouts` state, `PayoutHistorySection`, an `AppState`-driven refresh listener, and removing the `instructorEmail`/`instructorUsername` state that used to exist (nothing downstream reads them anymore — `InstructorDashboard` never took those props even before this task). The rewrite below preserves all of that new functionality while removing the `mode` param and the auto-mint-on-visit code, exactly as the original task intended. Confirm current shape with `grep -n "^function generateCode\|^export default function InstructorScreen\|^const styles" app/instructor.tsx` before starting — the line numbers below assume `generateCode`/`generateReferralCode` at 162-171 (deleted by Task 3) and `InstructorScreen` at 1233-1408.

**Files:**
- Modify: `app/instructor.tsx`

**Interfaces:**
- Consumes: `generateInstructorCode`, `generateReferralCode` (Task 3, defensive fallback only — the primary generation now happens in `choose-account-type.tsx`).
- Produces: `InstructorScreen` (default export) with no `mode` param, reached directly by an instructor account post-login (Task 4/8/9) or the tab guard (Task 14).

- [ ] **Step 1: Confirm `LearnerModeView` is already removed**

Task 11 already deleted `LearnerModeView` (current lines 1031-1229) and moved it to `linked-instructors.tsx`. If for some reason Task 11 hasn't run yet or the deletion didn't take, remove that function block now before continuing — `instructor.tsx` should contain no function named `LearnerModeView` after this task.

- [ ] **Step 2: Update the import line (line 17)**

```tsx
import { router, useLocalSearchParams } from 'expo-router';
```
→
```tsx
import { router } from 'expo-router';
```

(`useLocalSearchParams` is no longer used once the `mode` param is removed in Step 4.)

- [ ] **Step 3: Add the accountCodes import**

Add after the existing imports (near the `Pip` import):

```tsx
import { generateInstructorCode, generateReferralCode } from '@/src/accountCodes';
```

- [ ] **Step 4: Replace `InstructorScreen`**

Task 11 already removed `LearnerModeView` from this file, which shifts every line number after it — do not trust the "1233-1408" figure quoted in this task's opening note, it describes the file *before* Task 11 ran. Instead, locate the function by content: find `export default function InstructorScreen() {` and replace everything from there down to its closing `}` (the line immediately before the `// ─── Styles` comment and `const styles = StyleSheet.create({`). Replace that whole function with:

```tsx
export default function InstructorScreen() {
  const theme = useTheme();

  const [learners,       setLearners]       = useState<LearnerEntry[]>([]);
  const [instructorCode, setInstructorCode] = useState<string | null>(null);
  const [referralCode,   setReferralCode]   = useState<string | null>(null);
  const [earnings,       setEarnings]       = useState<EarningEntry[]>([]);
  const [connectStatus,  setConnectStatus]  = useState<ConnectAccountRow | null>(null);
  const [payouts,        setPayouts]        = useState<PayoutEntry[]>([]);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => { void loadData(); }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void loadData();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/signin'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, instructor_code, referral_code, username')
        .eq('id', user.id)
        .single();

      const uname = (profile as { username?: string } | null)?.username ?? '';

      let code = (profile as { instructor_code?: string } | null)?.instructor_code ?? null;
      if (!code) {
        // Defensive fallback only — accounts created after this plan ships
        // get their instructor_code from choose-account-type.tsx at signup.
        // This covers pre-split accounts backfilled in Task 2 that somehow
        // lack one.
        code = generateInstructorCode();
        await supabase.from('profiles').upsert({ id: user.id, instructor_code: code });
      }
      setInstructorCode(code);

      let refCode = (profile as { referral_code?: string } | null)?.referral_code ?? null;
      if (!refCode && uname) {
        refCode = generateReferralCode(uname);
        await supabase.from('profiles').update({ referral_code: refCode }).eq('id', user.id);
      }
      setReferralCode(refCode);

      const { data: earningsData } = await supabase
        .from('instructor_earnings')
        .select('*')
        .eq('instructor_id', user.id)
        .order('created_at', { ascending: false });
      setEarnings((earningsData as EarningEntry[] | null) ?? []);

      const { data: connectRow } = await supabase
        .from('instructor_connect_accounts')
        .select('stripe_account_id, status, payouts_enabled')
        .eq('instructor_id', user.id)
        .maybeSingle();
      setConnectStatus((connectRow as ConnectAccountRow | null) ?? null);

      const { data: payoutRows } = await supabase
        .from('payouts')
        .select('*')
        .eq('instructor_id', user.id)
        .order('created_at', { ascending: false });
      setPayouts((payoutRows as PayoutEntry[] | null) ?? []);

      const { data: rels } = await supabase
        .from('instructor_relationships')
        .select('*')
        .eq('instructor_id', user.id)
        .neq('status', 'rejected');

      const accepted = (rels as Relationship[] | null)?.filter(r => r.status === 'accepted' && r.learner_id) ?? [];

      if (accepted.length > 0) {
        const learnerIds = accepted.map(r => r.learner_id!);

        const [{ data: progressRows }, { data: profileRows }] = await Promise.all([
          supabase.from('user_progress').select('id, progress').in('id', learnerIds),
          supabase.from('profiles').select('id, username').in('id', learnerIds),
        ]);

        let lastNoteDates: Map<string, string> = new Map();
        try {
          const { data: notesData } = await supabase
            .from('instructor_lesson_notes')
            .select('learner_id, created_at')
            .eq('instructor_id', user.id)
            .order('created_at', { ascending: false });
          for (const n of (notesData as { learner_id: string; created_at: string }[] | null) ?? []) {
            if (n.learner_id && !lastNoteDates.has(n.learner_id)) {
              lastNoteDates.set(n.learner_id, n.created_at);
            }
          }
        } catch {}

        const entries: LearnerEntry[] = accepted.map(rel => {
          const pd  = (progressRows as { id: string; progress: unknown }[] | null)?.find(p => p.id === rel.learner_id);
          const pf  = (profileRows  as { id: string; username: string }[] | null)?.find(p => p.id === rel.learner_id);
          const raw = pd?.progress as Partial<UserProgress> | undefined;
          const progress = raw ? ({ ...createFreshUserProgress(), ...raw } as UserProgress) : null;
          return {
            rel,
            progress,
            username: pf?.username ?? null,
            lastNoteDate: rel.learner_id ? (lastNoteDates.get(rel.learner_id) ?? null) : null,
          };
        });
        setLearners(entries);
      } else {
        setLearners([]);
      }
    } catch {
      // Table likely doesn't exist yet — show empty state
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/auth/signin');
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: theme.cardColor, borderBottomColor: theme.borderColor }]}>
        <View style={styles.headerBack} />
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>{'Instructor Dashboard'}</Text>
        <TouchableOpacity onPress={() => void handleSignOut()} style={styles.headerSignOut} activeOpacity={0.7}>
          <Text style={styles.headerSignOutText}>{'Sign Out'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.indigo} />
        </View>
      ) : (
        <InstructorDashboard
          learners={learners}
          instructorCode={instructorCode}
          referralCode={referralCode}
          earnings={earnings}
          connectStatus={connectStatus}
          payouts={payouts}
          loading={loading}
          onRefresh={() => void loadData()}
        />
      )}
    </View>
  );
}
```

Note this drops the `[mode]` dependency from the original data-loading `useEffect` (now `useEffect(() => { void loadData(); }, [])`, since `mode` no longer exists) and keeps the `AppState` foreground-refresh listener from the Stripe Connect merge unchanged. `InstructorDashboard`'s props (`learners`, `instructorCode`, `referralCode`, `earnings`, `connectStatus`, `payouts`, `loading`, `onRefresh`) are unchanged from the current file — this task does not touch `InstructorDashboard`, `EarningsSection`, `PayoutHistorySection`, `ReferralSection`, `LearnerCard`, `LearnerDetailView`, `AddNoteModal`, `LessonNotesSection`, or `AddLearnerModal`; leave all of those function bodies exactly as they are.

- [ ] **Step 5: Add the Sign Out header style**

In the `styles` object (near `headerBack`/`headerBackArrow`), add:

```tsx
  headerSignOut: { paddingHorizontal: 8, paddingVertical: 4 },
  headerSignOutText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors. Grep to confirm nothing else references the removed `mode` param or `LearnerModeView`:

```bash
grep -n "mode\|LearnerModeView\|useLocalSearchParams" app/instructor.tsx
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add app/instructor.tsx
git commit -m "refactor: instructor.tsx is instructor-only, no mode param, adds Sign Out"
```

---

### Task 13: Update Settings — delete self-service row, repoint Linked Instructors

**Files:**
- Modify: `app/(tabs)/settings.tsx`

**Interfaces:** None.

- [ ] **Step 1: Delete the "Instructor / Parent Dashboard" row (current lines 783-788)**

Remove entirely:

```tsx
        <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={() => router.push('/instructor?mode=instructor' as any)} activeOpacity={0.85}>
          <View style={styles.textWrap}>
            <Text style={[styles.label, { fontSize: theme.fontSize(15), fontFamily: theme.fontFamily, color: theme.textColor }]}>{'Instructor / Parent Dashboard'}</Text>
          </View>
          <Text style={styles.chevron}>{'›'}</Text>
        </TouchableOpacity>

```

- [ ] **Step 2: Repoint the "Linked Instructors" row (current line 744)**

```tsx
          onPress={() => router.push('/instructor?mode=learner' as any)}
```
→
```tsx
          onPress={() => router.push('/linked-instructors' as any)}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
grep -n "instructor" "app/(tabs)/settings.tsx"
```

Expected: `tsc` clean; the grep should show only the "Linked Instructors" row and the `linkedInstructorCount` loading logic (unchanged), no "Instructor / Parent Dashboard" text and no `/instructor?mode=` string.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/settings.tsx"
git commit -m "feat: remove self-service instructor upgrade row from Settings"
```

---

### Task 14: Guard the tab navigator against instructor accounts

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `supabase` client, `profiles.account_type`.

- [ ] **Step 1: Add the guard**

At the top of the file, add imports:

```tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/src/supabase';
```

(`useEffect`/`useState` join the existing `React` usage; the file currently has no `import React` — check whether JSX runtime is automatic in this project's `tsconfig.json`/babel config before adding a redundant `import React from 'react'`. Given every other screen in this codebase does `import React, { useState } from 'react'`, follow that same pattern here: `import React, { useEffect, useState } from 'react';`.)

Change the component:

```tsx
export default function TabLayout() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    void guardInstructorAccounts();
  }, []);

  async function guardInstructorAccounts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('id', user.id)
        .maybeSingle();
      if ((profile as { account_type?: string } | null)?.account_type === 'instructor') {
        router.replace('/instructor');
        return;
      }
    }
    setChecked(true);
  }

  if (!checked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardWhite }}>
        <ActivityIndicator size="large" color={Colors.indigo} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        ...(/* unchanged */)
      }}
    >
      {/* ...unchanged TABS.map(...)... */}
    </Tabs>
  );
}
```

Only the function body changes — the `Tabs` JSX itself (`screenOptions` and the `TABS.map(...)` block) is unchanged, just now returned from inside the `if (!checked)` early-return instead of being the sole return statement.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/_layout.tsx"
git commit -m "feat: redirect instructor accounts away from the tab bar"
```

---

### Task 15: Update existing e2e specs

**Files:**
- Modify: `e2e/public-routes.spec.ts`
- Modify: `e2e/auth-gated-routes.spec.ts`

**Interfaces:** None.

- [ ] **Step 1: Delete the `/auth` describe block in `e2e/public-routes.spec.ts`**

Remove lines 110-126 (the `// ─── /auth ───` comment header and the `test.describe('/auth', ...)` block) entirely — `auth.tsx` no longer exists. Leave the `/auth/signin`, `/auth/signup`, `/auth/forgot-password` blocks untouched.

- [ ] **Step 2: Add the new routes to `AUTH_ROUTES` in `e2e/auth-gated-routes.spec.ts`**

Change:

```ts
  '/instructor',
  '/studyplan',
```

to:

```ts
  '/instructor',
  '/linked-instructors',
  '/auth/choose-account-type',
  '/studyplan',
```

- [ ] **Step 3: Verify**

```bash
npx playwright test e2e/public-routes.spec.ts e2e/auth-gated-routes.spec.ts
```

Expected: all tests pass (these are unauthenticated rendering checks; `/linked-instructors` and `/instructor` will redirect to `/auth/signin` per their `if (!user) { router.replace('/auth/signin'); return; }` guards — `auth-gated-routes.spec.ts`'s per-route test already accepts either "renders content" or "redirects," so this passes either way).

- [ ] **Step 4: Commit**

```bash
git add e2e/public-routes.spec.ts e2e/auth-gated-routes.spec.ts
git commit -m "test: update e2e specs for retired auth.tsx and new instructor/learner routes"
```

---

### Task 16: New e2e coverage for the account-type picker

**Files:**
- Create: `e2e/account-type-signup.spec.ts`

**Interfaces:** None.

- [ ] **Step 1: Create `e2e/account-type-signup.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test.describe('/auth/choose-account-type', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('referral_code'));
  });

  test('shows learner and instructor choice when no referral code is pending', async ({ page }) => {
    await page.goto('/auth/choose-account-type');
    await expect(page.getByText(/how will you use clearpass/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/i'm a learner/i)).toBeVisible();
    await expect(page.getByText(/i'm an instructor/i)).toBeVisible();
  });

  test('skips the choice and redirects to sign in when a referral code is pending but no session exists', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('referral_code', 'TESTCODE'));
    await page.goto('/auth/choose-account-type');
    await expect(page).toHaveURL(/signin/, { timeout: 10000 });
  });
});
```

- [ ] **Step 2: Run it**

```bash
npx playwright test e2e/account-type-signup.spec.ts
```

Expected: both tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/account-type-signup.spec.ts
git commit -m "test: add e2e coverage for the account-type choice screen"
```

---

### Task 17: Manual QA against a real Supabase project

**Files:** None — this is a verification pass, not a code change. Run against a staging/dev Supabase project, not production, if one is configured; otherwise proceed carefully against production with disposable test accounts.

- [ ] **Step 1: Fresh learner signup (email)**

Sign up with a new email, no referral code. Confirm: lands on `/auth/choose-account-type`, both cards visible. Tap "I'm a learner." Confirm: lands on `/auth/testdate`, then `(tabs)/home` after saving/skipping. Confirm the tab bar shows Home/Practice/Mock/Hazard/Settings. In Settings, confirm "Linked Instructors" row is present and "Instructor / Parent Dashboard" row is gone.

- [ ] **Step 2: Fresh instructor signup (email)**

Sign up with a new email, no referral code. Tap "I'm an instructor." Confirm: lands directly on the Instructor Dashboard (no test-date screen, no tab bar). Confirm a "Sign Out" button is visible in the header and works (returns to `/auth/signin`).

- [ ] **Step 3: Referral-link signup forces learner**

Generate an instructor's referral link (share link from the Instructor Dashboard's Referral section). Open it fresh (new email). Confirm: the account-type picker never appears — signup goes straight from the form to `/auth/testdate`. Confirm a pending relationship shows up under the instructor's "Add Learner" / learner list once accepted from the new learner's "Linked Instructors" → "Instructor Requests".

- [ ] **Step 4: Manually-typed referral code also forces learner**

Fresh signup, no `?ref=` link, but type a known instructor's code into the "Instructor or friend's code" field. Confirm: same forced-learner behavior as Step 3 (no picker shown).

- [ ] **Step 5: Sign-in for existing accounts of both types**

Sign out, sign back in as the learner account from Step 1 — confirm it lands on `(tabs)/home`. Sign in as the instructor account from Step 2 — confirm it lands directly on the Instructor Dashboard, not the tab bar.

- [ ] **Step 6: Direct navigation guard (web only)**

While signed in as the instructor account, manually navigate the browser to `/(tabs)/practice`. Confirm it redirects to `/instructor` rather than showing practice questions.

- [ ] **Step 7: Social signup (whichever of Apple/Google is testable in this environment)**

Tap "Continue with Google" (or Apple) from `/auth/signup` with a brand-new account. Confirm it lands on `/auth/choose-account-type` before reaching home/dashboard. Repeat by tapping the same social button from `/auth/signin` instead (this is the gap Design Decision 2 closes) — confirm a brand-new social user still lands on the picker, not directly on `(tabs)/home`.

- [ ] **Step 8: Existing pre-split accounts still work**

After Task 2's backfill has run, sign in as one pre-existing learner account and one pre-existing (reclassified) instructor account from before this feature shipped. Confirm both land on the correct destination per Step 5, with no broken state (e.g. an instructor account should not have a leftover route pointing at a `mode=` param anywhere).

---

## Self-review notes

- **Spec coverage:** explicit signup choice (Task 6/7), instructor accounts genuinely distinct (Tasks 12-14), referral links force learner with no override (Task 6 Step 2, Task 7 Step 1/3), real `account_type` replacing the heuristic entirely (Task 1/2, and Task 12 Step 4 removes the old auto-mint-as-primary-mechanism), `auth.tsx` vs `auth/signup.tsx` resolved by retiring the former (Task 9/10), schema field decided (Task 1), backfill considered (Task 2), navigation for instructors decided — skip tab bar, land on dashboard (Task 4/8/9/14), social signup covered (Task 5/6/7/8, closes the signin.tsx gap specifically). All five "needs resolving" items from the request have a task and a Design Decision explaining the reasoning.
- **Placeholder scan:** no TBD/TODO markers; every step has complete code or an exact SQL script.
- **Type consistency:** `AccountType`/`account_type` values `'learner' | 'instructor'` used identically across Task 1 (DB), Task 6 (`choose-account-type.tsx`), Task 4 (`postAuthRouting.ts`), Task 7 (`signup.tsx`), Task 14 (tab guard). `PENDING_USERNAME_KEY` value (`@clearpass/pending_username`) matches between `socialAuth.ts` (Task 5), `signup.tsx` (already using this constant), and `choose-account-type.tsx` (Task 6). `REFERRAL_CODE_KEY` value (`referral_code`) matches between `_layout.tsx` (existing deep-link handler), `signup.tsx`, and `choose-account-type.tsx`.
