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
