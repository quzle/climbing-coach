-- =============================================================================
-- Migration: Add multi-user support
--
-- Adds user_id to every table so that each row is owned by a specific
-- authenticated Supabase user. Also enables Row Level Security (RLS) on all
-- tables and creates policies so that users can only read and modify their own
-- data.
--
-- NOTE: This migration adds the columns as nullable initially. Application
-- code immediately starts writing user_id on every INSERT. Backfill any
-- existing rows before applying NOT NULL constraints (see inline comments).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add user_id to root-level tables
-- ---------------------------------------------------------------------------

ALTER TABLE programmes
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE session_logs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE readiness_checkins
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE injury_areas
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Add user_id to child tables
--    These rows are already scoped through FK chains, but carrying user_id
--    directly enables simple, index-friendly ownership checks without joins.
-- ---------------------------------------------------------------------------

ALTER TABLE mesocycles
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE weekly_templates
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE planned_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Create indexes for efficient per-user queries
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_programmes_user_id         ON programmes(user_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_user_id        ON session_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_readiness_checkins_user_id  ON readiness_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_injury_areas_user_id        ON injury_areas(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id       ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_mesocycles_user_id          ON mesocycles(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_templates_user_id    ON weekly_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_planned_sessions_user_id    ON planned_sessions(user_id);

-- ---------------------------------------------------------------------------
-- 4. Fix the injury_areas UNIQUE constraint
--    The old constraint enforced globally unique area names, which breaks
--    when multiple users track the same area (e.g. "shoulder_left").
--    Replace it with a per-user unique constraint.
-- ---------------------------------------------------------------------------

ALTER TABLE injury_areas
  DROP CONSTRAINT IF EXISTS injury_areas_area_key;

ALTER TABLE injury_areas
  ADD CONSTRAINT injury_areas_user_id_area_key UNIQUE(user_id, area);

-- ---------------------------------------------------------------------------
-- 5. Enable Row Level Security on every table
-- ---------------------------------------------------------------------------

ALTER TABLE programmes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesocycles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_areas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages      ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 6. RLS policies — users may only access their own rows
--    These policies apply when the Supabase client is authenticated with the
--    user's JWT (anon key + user session). The service-role key bypasses RLS
--    entirely, so application-layer user_id filtering remains the primary
--    enforcement mechanism.
-- ---------------------------------------------------------------------------

-- programmes
CREATE POLICY "Users manage own programmes"
  ON programmes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- mesocycles
CREATE POLICY "Users manage own mesocycles"
  ON mesocycles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- weekly_templates
CREATE POLICY "Users manage own weekly templates"
  ON weekly_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- planned_sessions
CREATE POLICY "Users manage own planned sessions"
  ON planned_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- session_logs
CREATE POLICY "Users manage own session logs"
  ON session_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- readiness_checkins
CREATE POLICY "Users manage own readiness check-ins"
  ON readiness_checkins FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- injury_areas
CREATE POLICY "Users manage own injury areas"
  ON injury_areas FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- chat_messages
CREATE POLICY "Users manage own chat messages"
  ON chat_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
