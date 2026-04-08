-- =============================================================================
-- BASE SCHEMA
-- =============================================================================
-- Creates the original base tables as they existed before any tracked
-- migration was applied. Run this once against a blank Supabase project
-- before running 01_apply_all_migrations.sql.
--
-- Target project: tmtspymjfnemygpquyhw (Integration)
-- =============================================================================

-- programmes: top-level training programme
CREATE TABLE IF NOT EXISTS public.programmes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  goal        text,
  start_date  date,
  target_date date,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- mesocycles: training blocks within a programme
CREATE TABLE IF NOT EXISTS public.mesocycles (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id    uuid        NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  focus           text,
  week_number     integer     NOT NULL,
  duration_weeks  integer     NOT NULL,
  is_deload       boolean     NOT NULL DEFAULT false,
  notes           text,
  planned_start   date,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- weekly_templates: intended training structure per week/day
CREATE TABLE IF NOT EXISTS public.weekly_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mesocycle_id  uuid        NOT NULL REFERENCES public.mesocycles(id) ON DELETE CASCADE,
  day_of_week   integer     NOT NULL,
  session_type  text        NOT NULL,
  focus         text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- planned_sessions: AI-generated or manually created session plans
CREATE TABLE IF NOT EXISTS public.planned_sessions (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mesocycle_id                uuid        REFERENCES public.mesocycles(id) ON DELETE SET NULL,
  planned_date                date        NOT NULL,
  session_type                text        NOT NULL,
  title                       text,
  description                 text,
  estimated_duration_minutes  integer,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

-- session_logs: completed training sessions
CREATE TABLE IF NOT EXISTS public.session_logs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date                date        NOT NULL,
  session_type        text        NOT NULL,
  planned_session_id  uuid        REFERENCES public.planned_sessions(id) ON DELETE SET NULL,
  duration_minutes    integer,
  rpe                 integer,
  notes               text,
  log_data            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- readiness_checkins: daily subjective readiness entries
CREATE TABLE IF NOT EXISTS public.readiness_checkins (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date             date        NOT NULL,
  overall_fatigue  integer     NOT NULL,
  sleep_quality    integer     NOT NULL,
  motivation       integer     NOT NULL,
  finger_health    integer     NOT NULL,
  shoulder_health  integer     NOT NULL,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- injury_areas: current and historical injury/health notes
CREATE TABLE IF NOT EXISTS public.injury_areas (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  area         text        NOT NULL,
  severity     text,
  notes        text,
  is_active    boolean     NOT NULL DEFAULT true,
  added_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- chat_messages: conversation history between athlete and AI coach
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  role              text        NOT NULL,
  content           text        NOT NULL,
  context_snapshot  jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);
