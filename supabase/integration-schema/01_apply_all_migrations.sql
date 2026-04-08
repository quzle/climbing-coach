-- =============================================================================
-- ALL MIGRATIONS IN ORDER
-- =============================================================================
-- Applies every migration from supabase/migrations/ in chronological order.
-- Run AFTER 00_base_schema.sql on a blank Supabase project.
--
-- Target project: tmtspymjfnemygpquyhw (Integration)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 20260330000000_add_user_id_to_domain_tables.sql
-- DB-3: Add user_id FK to all user-owned domain tables
-- ---------------------------------------------------------------------------

-- Clear any legacy data so NOT NULL constraints can be applied cleanly.
TRUNCATE TABLE
  weekly_templates,
  injury_areas,
  chat_messages,
  readiness_checkins,
  session_logs,
  planned_sessions,
  mesocycles,
  programmes
CASCADE;

ALTER TABLE programmes
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE mesocycles
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE planned_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE session_logs
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE readiness_checkins
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE injury_areas
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE weekly_templates
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL REFERENCES auth.users(id);


-- ---------------------------------------------------------------------------
-- 20260330000001_create_profiles_table.sql
-- DB-1: Create profiles table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          text        NOT NULL,
  display_name   text        NULL,
  role           text        NOT NULL DEFAULT 'user'     CHECK (role IN ('user', 'superuser')),
  invite_status  text        NOT NULL DEFAULT 'invited'  CHECK (invite_status IN ('invited', 'active')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Application-owned user metadata. One row per auth.users entry.';
COMMENT ON COLUMN public.profiles.role IS 'MVP values: user, superuser';
COMMENT ON COLUMN public.profiles.invite_status IS 'MVP values: invited, active';

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 20260330000002_add_chat_threads.sql
-- DB-2: Create chat_threads table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_threads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id),
  title       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- 20260330000003_add_programme_status_constraint.sql
-- DB-5: Enforce one active programme per user at database level
-- ---------------------------------------------------------------------------

ALTER TABLE programmes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'paused'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_programmes_one_active_per_user
  ON programmes (user_id)
  WHERE (status = 'active');


-- ---------------------------------------------------------------------------
-- 20260330000004_add_thread_id_to_chat_messages.sql
-- DB-4: Add thread_id FK to chat_messages
-- ---------------------------------------------------------------------------

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS thread_id uuid NULL REFERENCES chat_threads(id) ON DELETE SET NULL;


-- ---------------------------------------------------------------------------
-- 20260330000005_add_user_id_indexes.sql
-- DB-6: Add indexes for user-scoped query patterns
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_programmes_user_id_start_date
  ON programmes (user_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_mesocycles_user_id_programme_id
  ON mesocycles (user_id, programme_id);

CREATE INDEX IF NOT EXISTS idx_mesocycles_user_id_planned_start
  ON mesocycles (user_id, planned_start);

CREATE INDEX IF NOT EXISTS idx_planned_sessions_user_id_planned_date
  ON planned_sessions (user_id, planned_date);

CREATE INDEX IF NOT EXISTS idx_planned_sessions_user_id_mesocycle_id
  ON planned_sessions (user_id, mesocycle_id);

CREATE INDEX IF NOT EXISTS idx_session_logs_user_id_date
  ON session_logs (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_session_logs_user_id_session_type_date
  ON session_logs (user_id, session_type, date DESC);

CREATE INDEX IF NOT EXISTS idx_readiness_checkins_user_id_date
  ON readiness_checkins (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_injury_areas_user_id_active
  ON injury_areas (user_id, added_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_weekly_templates_user_id_mesocycle_id
  ON weekly_templates (user_id, mesocycle_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id_created_at
  ON chat_messages (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_threads_user_id_updated_at
  ON chat_threads (user_id, updated_at DESC);


-- ---------------------------------------------------------------------------
-- 20260331000000_drop_legacy_shoulder_columns.sql
-- ADR 004: drop legacy shoulder-specific columns
-- ---------------------------------------------------------------------------

ALTER TABLE readiness_checkins DROP COLUMN IF EXISTS shoulder_health;
ALTER TABLE session_logs DROP COLUMN IF EXISTS shoulder_flag;


-- ---------------------------------------------------------------------------
-- 20260402000000_add_rls_to_user_owned_tables.sql
-- SEC-1: add RLS policies to all user-owned domain tables
-- ---------------------------------------------------------------------------

ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'programmes' AND policyname = 'programmes_user_access_policy'
  ) THEN
    CREATE POLICY programmes_user_access_policy
      ON programmes FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE mesocycles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mesocycles' AND policyname = 'mesocycles_user_access_policy'
  ) THEN
    CREATE POLICY mesocycles_user_access_policy
      ON mesocycles FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE planned_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'planned_sessions' AND policyname = 'planned_sessions_user_access_policy'
  ) THEN
    CREATE POLICY planned_sessions_user_access_policy
      ON planned_sessions FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'session_logs' AND policyname = 'session_logs_user_access_policy'
  ) THEN
    CREATE POLICY session_logs_user_access_policy
      ON session_logs FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE readiness_checkins ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'readiness_checkins' AND policyname = 'readiness_checkins_user_access_policy'
  ) THEN
    CREATE POLICY readiness_checkins_user_access_policy
      ON readiness_checkins FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_user_access_policy'
  ) THEN
    CREATE POLICY chat_messages_user_access_policy
      ON chat_messages FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE injury_areas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'injury_areas' AND policyname = 'injury_areas_user_access_policy'
  ) THEN
    CREATE POLICY injury_areas_user_access_policy
      ON injury_areas FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE weekly_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'weekly_templates' AND policyname = 'weekly_templates_user_access_policy'
  ) THEN
    CREATE POLICY weekly_templates_user_access_policy
      ON weekly_templates FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 20260402000001_add_rls_to_profiles.sql
-- SEC-2: add RLS policies to profiles
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_select_own_profile_policy'
  ) THEN
    CREATE POLICY profiles_select_own_profile_policy
      ON public.profiles FOR SELECT TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'profiles_update_own_profile_policy'
  ) THEN
    CREATE POLICY profiles_update_own_profile_policy
      ON public.profiles FOR UPDATE TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 20260402000002_add_rls_to_chat_threads.sql
-- SEC-3: add RLS policy to chat_threads
-- ---------------------------------------------------------------------------

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'chat_threads' AND policyname = 'chat_threads_user_access_policy'
  ) THEN
    CREATE POLICY chat_threads_user_access_policy
      ON public.chat_threads FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
