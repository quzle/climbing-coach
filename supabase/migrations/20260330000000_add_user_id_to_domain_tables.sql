-- DB-3: Add user_id FK to all user-owned domain tables
--
-- Every domain record belongs to exactly one authenticated user.
-- References auth.users(id) so that ownership is tied to Supabase Auth.
-- NOT NULL is safe here because the database is recreated for the multi-user
-- MVP and backwards-compatible data migration is not required (see ADR 005).

-- Clear legacy single-user data so NOT NULL constraints can be applied cleanly.
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
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE mesocycles
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE planned_sessions
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE session_logs
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE readiness_checkins
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE chat_messages
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE injury_areas
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id);

ALTER TABLE weekly_templates
  ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id);
