-- User profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User progress table
CREATE TABLE user_progress (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  progress JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leaderboard view
CREATE VIEW leaderboard AS
SELECT
  p.username,
  (up.progress->>'readinessScore')::int as readiness_score,
  (up.progress->>'xp')::int as xp,
  (up.progress->>'studyStreakDays')::int as streak,
  up.updated_at
FROM user_progress up
JOIN profiles p ON p.id = up.id
ORDER BY xp DESC
LIMIT 50;

-- Row level security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own progress" ON user_progress FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can upsert own progress" ON user_progress FOR ALL USING (auth.uid() = id);

CREATE POLICY "Anyone can read leaderboard" ON user_progress FOR SELECT USING (true);

-- Migration: replace strict insert policy with permissive one to fix sign-up timing issue
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (true);

-- Hazard perception clips catalogue
CREATE TABLE IF NOT EXISTS hazard_clips (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  storage_path   TEXT NOT NULL,
  thumbnail_path TEXT,
  difficulty     TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  -- 'time' for CGI clips 1-10 (SS.centiseconds), 'frame' for all others (25fps)
  scoring_method TEXT NOT NULL DEFAULT 'time' CHECK (scoring_method IN ('time','frame')),
  -- Clips 1-10 include a solution clip in the second minute
  has_solution_clip BOOLEAN NOT NULL DEFAULT false,
  solution_start_s  FLOAT,
  -- JSONB array of hazard windows:
  -- [{ "hazard_number": 1, "bands": [{ "points": 5, "start_s": 18.19, "end_s": 19.18 }, ...] }]
  scoring_windows JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE hazard_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active clips" ON hazard_clips FOR SELECT USING (is_active = true);

-- Instructor / Learner relationships
CREATE TABLE IF NOT EXISTS instructor_relationships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_email TEXT,
  learner_name  TEXT,
  status        TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected')),
  invite_code   TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE instructor_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view own relationships" ON instructor_relationships;
DROP POLICY IF EXISTS "Participants can insert relationships" ON instructor_relationships;
DROP POLICY IF EXISTS "Participants can delete own relationships" ON instructor_relationships;
CREATE POLICY "Participants can view own relationships" ON instructor_relationships
  FOR SELECT USING (auth.uid() = instructor_id OR auth.uid() = learner_id);
CREATE POLICY "Participants can insert relationships" ON instructor_relationships
  FOR INSERT WITH CHECK (auth.uid() = instructor_id OR auth.uid() = learner_id);
CREATE POLICY "Participants can delete own relationships" ON instructor_relationships
  FOR DELETE USING (auth.uid() = instructor_id OR auth.uid() = learner_id);

-- Instructor lesson notes
CREATE TABLE IF NOT EXISTS instructor_lesson_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  note          TEXT NOT NULL,
  lesson_date   DATE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE instructor_lesson_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can view own notes" ON instructor_lesson_notes;
DROP POLICY IF EXISTS "Instructors can insert own notes" ON instructor_lesson_notes;
CREATE POLICY "Instructors can view own notes" ON instructor_lesson_notes
  FOR SELECT USING (auth.uid() = instructor_id);
CREATE POLICY "Instructors can insert own notes" ON instructor_lesson_notes
  FOR INSERT WITH CHECK (auth.uid() = instructor_id);

-- Instructor referral earnings (written server-side only)
CREATE TABLE IF NOT EXISTS instructor_earnings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id    UUID REFERENCES auth.users(id),
  amount        DECIMAL(10,2),
  status        TEXT DEFAULT 'pending',
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE instructor_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can view own earnings" ON instructor_earnings;
CREATE POLICY "Instructors can view own earnings" ON instructor_earnings
  FOR SELECT USING (auth.uid() = instructor_id);

-- Add instructor / referral columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instructor_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code   TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by     TEXT;
-- (existing profile RLS policies already cover these columns)

-- Per-user hazard perception attempt log
CREATE TABLE IF NOT EXISTS hazard_attempts (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  clip_id    TEXT REFERENCES hazard_clips(id),
  score      INTEGER NOT NULL,
  max_score  INTEGER NOT NULL,
  clicks     JSONB NOT NULL DEFAULT '[]',
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE hazard_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own attempts" ON hazard_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own attempts" ON hazard_attempts FOR SELECT USING (auth.uid() = user_id);

-- Stripe Connect: instructor payout accounts
-- Kept in a separate table (not extra columns on `profiles`) because
-- `profiles` has a permissive `USING (true)` SELECT policy so learners can
-- look up an instructor by instructor_code — Stripe account id/status must
-- not ride along on that broad read.
CREATE TABLE IF NOT EXISTS instructor_connect_accounts (
  instructor_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  stripe_account_id  TEXT UNIQUE,
  status             TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'pending', 'onboarded', 'restricted')),
  payouts_enabled    BOOLEAN NOT NULL DEFAULT false,
  details_submitted  BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE instructor_connect_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can view own connect account" ON instructor_connect_accounts;
CREATE POLICY "Instructors can view own connect account" ON instructor_connect_accounts
  FOR SELECT USING (auth.uid() = instructor_id);
-- No INSERT/UPDATE policy: written server-side only, via the service role key
-- (same convention as instructor_earnings above).

-- Stripe Connect: payout batches (one row per "Request Payout" transfer attempt)
CREATE TABLE IF NOT EXISTS payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount              DECIMAL(10,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'paid', 'failed')),
  stripe_transfer_id  TEXT,
  failure_reason      TEXT,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can view own payouts" ON payouts;
CREATE POLICY "Instructors can view own payouts" ON payouts
  FOR SELECT USING (auth.uid() = instructor_id);
-- No INSERT/UPDATE policy: written server-side only, via the service role key.

-- Link each earning to the payout batch that paid it out, and constrain the
-- status values that were previously unconstrained free text (every existing
-- row is 'pending' today, so this CHECK is safe to add retroactively).
ALTER TABLE instructor_earnings ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL;
ALTER TABLE instructor_earnings DROP CONSTRAINT IF EXISTS instructor_earnings_status_check;
ALTER TABLE instructor_earnings ADD CONSTRAINT instructor_earnings_status_check CHECK (status IN ('pending', 'processing', 'paid'));

-- Security fix: "Anyone can read leaderboard" was a second permissive SELECT
-- policy on user_progress USING (true). Postgres ORs permissive policies
-- together, so it silently made every user's full progress JSONB (mock
-- history, topic scores, isPro, testDate, etc.) readable by anyone, even
-- unauthenticated requests, regardless of the owner-only policy above.
-- The `leaderboard` view (top of this file) already exposes only
-- username/readiness_score/xp/streak/updated_at, and being a plain view
-- (no security_invoker), it runs with its owner's privileges, so it keeps
-- working once this policy is dropped — it never needed this policy.
DROP POLICY IF EXISTS "Anyone can read leaderboard" ON user_progress;

-- The instructor dashboard (instructor.tsx) reads linked pupils' progress
-- directly from user_progress. That only worked because of the policy just
-- removed; restore it properly scoped to accepted instructor relationships
-- so access is enforced at the database layer, not just client-side.
CREATE POLICY "Instructors can read linked learner progress" ON user_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM instructor_relationships ir
      WHERE ir.learner_id = user_progress.id
        AND ir.instructor_id = auth.uid()
        AND ir.status = 'accepted'
    )
  );

-- instructor_relationships previously had no UPDATE policy at all, so no one
-- (not even the row's own participants) could update it via the anon/
-- authenticated role. Needed so a learner can accept a pending instructor
-- invite (e.g. one created via referral signup) from Settings → Linked
-- Instructors, mirroring the existing participant-scoped SELECT/INSERT/DELETE
-- policies above.
DROP POLICY IF EXISTS "Participants can update own relationships" ON instructor_relationships;
CREATE POLICY "Participants can update own relationships" ON instructor_relationships
  FOR UPDATE USING (auth.uid() = instructor_id OR auth.uid() = learner_id);

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

-- Stripe webhook event dedup. The platform webhook (/api/webhook) grants Pro
-- and records referral commission — a retried or duplicated delivery must
-- not re-apply either. Keyed on Stripe's own event id; the webhook handler
-- inserts a row before doing anything else and treats a unique-constraint
-- conflict as "already processed, skip". Written and read server-side only,
-- via the service role key (same convention as instructor_earnings/payouts).
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: no client-side access of any kind, service role only.

-- RevenueCat webhook event dedup — same purpose and shape as
-- stripe_webhook_events, kept as a separate table rather than a shared one:
-- RC's event ids are a different namespace from Stripe's, and a table
-- literally named stripe_webhook_events holding RC rows would be confusing
-- even though the PK wouldn't actually collide. See POST
-- /api/revenuecat-webhook in server/proxy.js.
CREATE TABLE IF NOT EXISTS revenuecat_webhook_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: no client-side access of any kind, service role only.

-- Instructor-purchased seats for the learner-Pro-gifting flow (instructor-
-- paid seats phase 2). Minted unredeemed by the Stripe webhook on purchase
-- (POST /api/instructor/seats/purchase); redeemed exactly once by a
-- learner via POST /api/seats/redeem. redeemed_at IS NULL is the
-- unredeemed state — no separate status column, so there's nothing to
-- drift out of sync with it. Unredeemed seats do not expire: "no refunds"
-- means letting one lapse would be a worse outcome for the instructor than
-- a refund, not a better one.
CREATE TABLE IF NOT EXISTS instructor_seats (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_checkout_session_id  TEXT UNIQUE NOT NULL,
  invite_token                TEXT UNIQUE NOT NULL,
  redeemed_by                 UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at                 TIMESTAMP WITH TIME ZONE,
  pro_expires_at              TIMESTAMP WITH TIME ZONE,
  created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS instructor_seats_instructor_id_idx ON instructor_seats(instructor_id);

ALTER TABLE instructor_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can view own seats" ON instructor_seats
  FOR SELECT USING (auth.uid() = instructor_id);
-- No INSERT/UPDATE/DELETE policy, and — deliberately — no policy at all
-- granting a learner read access, not even to their own redeemed seat.
-- Every write (minting, redemption) happens server-side via the service
-- role key. Redemption is looked up by exact invite_token through
-- POST /api/seats/redeem, never through a learner's own Supabase session,
-- so there is no RLS surface for a learner to enumerate against.

-- Learner's explicit decision on instructor progress-sharing, captured on
-- the seat redemption page (instructor-paid seats phase 4). Deliberately a
-- separate table from instructor_relationships, not a flag folded into it:
-- this is the audit record of what the learner actually agreed to and when,
-- independent of whatever instructor_relationships.status happens to be
-- doing for other reasons (referral-signup linking, etc). Declining still
-- writes a row here (consented = false) — Pro access is never conditional
-- on this and is granted by POST /api/seats/redeem regardless of consent.
-- The redemption page separately upserts an 'accepted' instructor_relationships
-- row ONLY when consented = true, reusing the existing RLS-enforced gate on
-- user_progress (see "Instructors can read linked learner progress" above)
-- rather than adding a second enforcement path — this table is the record,
-- that policy is the switch.
CREATE TABLE IF NOT EXISTS progress_sharing_consent (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  instructor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consented     BOOLEAN NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (learner_id, instructor_id)
);

ALTER TABLE progress_sharing_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learners can view own consent" ON progress_sharing_consent
  FOR SELECT USING (auth.uid() = learner_id);
CREATE POLICY "Learners can insert own consent" ON progress_sharing_consent
  FOR INSERT WITH CHECK (auth.uid() = learner_id);
CREATE POLICY "Learners can update own consent" ON progress_sharing_consent
  FOR UPDATE USING (auth.uid() = learner_id);
-- No instructor-facing policy: not needed by anything in this phase, and
-- easy to add later scoped to auth.uid() = instructor_id if a future
-- "your learners' consent status" view needs it.
-- No DELETE policy either — withdrawal is UPDATE consented = false, not a
-- delete, so the row (and its created_at grant time) survives as the audit
-- trail of both the original decision and the withdrawal.

-- Every other updated_at column in this file (user_progress,
-- instructor_connect_accounts, payouts) relies on the application
-- remembering to set it explicitly on every write — fine for those, where a
-- stale timestamp is cosmetic. Here it's the opposite: updated_at IS the
-- evidence of when consent was withdrawn, and this table will eventually be
-- written from two separate codebases (this redemption page, and a future
-- withdrawal control in apps/mobile's Settings) — correctness must not
-- depend on every future caller, in every app, remembering the convention.
-- A trigger makes it structurally impossible to forget.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS progress_sharing_consent_set_updated_at ON progress_sharing_consent;
CREATE TRIGGER progress_sharing_consent_set_updated_at
  BEFORE UPDATE ON progress_sharing_consent
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Withdraws or restores progress-sharing consent atomically. Both writes —
-- progress_sharing_consent.consented (the record) and
-- instructor_relationships.status (the switch RLS actually keys off) —
-- move together in one transaction, so a client that dies between two
-- separate .update() calls can never leave them disagreeing (see the
-- consent-withdrawal report this was built from).
--
-- SECURITY INVOKER (the default — stated explicitly here) means this runs
-- as the calling learner: the existing RLS policies on both tables still
-- apply inside the function body, so it grants no access beyond what the
-- learner's own session already has. 'consent_withdrawn' is deliberately
-- excluded from re-consent's target set in the second UPDATE's WHERE — this
-- only ever moves a relationship between 'accepted' and 'consent_withdrawn';
-- it must never touch a 'pending' invite the learner hasn't accepted yet,
-- or a 'rejected' one.
CREATE OR REPLACE FUNCTION set_progress_sharing_consent(p_instructor_id UUID, p_consented BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE progress_sharing_consent
  SET consented = p_consented
  WHERE learner_id = auth.uid() AND instructor_id = p_instructor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no progress_sharing_consent row for learner % and instructor %', auth.uid(), p_instructor_id;
  END IF;

  UPDATE instructor_relationships
  SET status = CASE WHEN p_consented THEN 'accepted' ELSE 'consent_withdrawn' END
  WHERE learner_id = auth.uid()
    AND instructor_id = p_instructor_id
    AND status IN ('accepted', 'consent_withdrawn');
END;
$$;

GRANT EXECUTE ON FUNCTION set_progress_sharing_consent(UUID, BOOLEAN) TO authenticated;

-- Idempotency guard for POST /api/cron/seat-expiry-reminders. NULL means
-- "not yet reminded"; the cron claims a seat with a conditional UPDATE
-- (... WHERE expiry_reminder_sent_at IS NULL) before sending either email,
-- so a second same-day cron run finds nothing left to claim and sends
-- nothing twice. No RLS policy needed — like every other write on this
-- table, only the service role ever touches it.
ALTER TABLE instructor_seats ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- ── Refund handling ─────────────────────────────────────────────────────
-- stripe_payment_intent_id: captured for free in handleSeatPurchaseCompleted
-- from the checkout session's own .payment_intent field (no extra Stripe
-- API call). The primary way a later charge.refunded webhook finds its
-- seat — a plain DB lookup, not a Stripe API round-trip. NULL for seats
-- purchased before this shipped (as of writing, exactly one); those fall
-- back to a Stripe API reverse-lookup by stripe_checkout_session_id, which
-- every seat, old or new, already has.
--
-- invalidated_at / invalidated_reason: set when an UNREDEEMED seat's
-- payment is refunded — nobody has benefited from it yet, so it's safe to
-- invalidate outright. An already-redeemed seat's refund never touches
-- this column, or the learner's Pro; see seat_refund_flags below instead.
ALTER TABLE instructor_seats ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE instructor_seats ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE instructor_seats ADD COLUMN IF NOT EXISTS invalidated_reason TEXT;

-- One row per refund discovered on an ALREADY-REDEEMED seat — the case
-- deliberately never auto-resolved (revoking a learner's Pro over a
-- decision their instructor made is not something to do automatically).
-- This is the queryable record of "needs a human decision"; the webhook
-- also emails ADMIN_ALERT_EMAIL at refund time, but the row is what
-- survives if that email is missed or the address isn't configured yet.
CREATE TABLE IF NOT EXISTS seat_refund_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id           UUID REFERENCES instructor_seats(id) ON DELETE CASCADE NOT NULL,
  instructor_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  learner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_charge_id  TEXT NOT NULL,
  refunded_amount   INTEGER NOT NULL,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE seat_refund_flags ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only, same convention as stripe_webhook_events
-- — an internal ops record, not user-facing data.

-- Per-user daily quota counter for POST /api/explain — one shared quota
-- across all three callers that hit that endpoint (Ask Pip in
-- app/(tabs)/tutor.tsx, the wrong-answer explainer in
-- packages/ai/src/tutor.ts, and the orphaned generateStudyPlan in
-- src/studyPlan.ts). One row per user per UTC calendar day; proxy.js
-- reads and increments `count` server-side before proxying to Anthropic.
-- Column named usage_date, not `date` — `date` is a legal identifier in
-- Postgres but shadows the built-in DATE type, which every other table
-- in this file avoids by using a descriptive name instead (attempted_at,
-- redeemed_at, etc).
-- Service-role only, same convention as stripe_webhook_events above: no
-- policies at all, so a learner can neither read their own remaining
-- quota nor forge extra headroom by writing this table directly.
CREATE TABLE IF NOT EXISTS explain_daily_usage (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE explain_daily_usage ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only, same convention as stripe_webhook_events.
