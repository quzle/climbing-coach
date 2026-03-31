-- DB-6: Add indexes for user-scoped query patterns
--
-- Every query in the multi-user MVP is filtered by user_id first. These
-- composite indexes cover the user_id predicate together with the next most
-- selective column for each table's expected access patterns (date ranges,
-- foreign-key joins, status filters). Keeping user_id as the leading column
-- ensures the planner uses the index for all user-scoped queries.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_programmes_user_id_start_date;
--   DROP INDEX IF EXISTS idx_mesocycles_user_id_programme_id;
--   DROP INDEX IF EXISTS idx_mesocycles_user_id_planned_start;
--   DROP INDEX IF EXISTS idx_planned_sessions_user_id_planned_date;
--   DROP INDEX IF EXISTS idx_planned_sessions_user_id_mesocycle_id;
--   DROP INDEX IF EXISTS idx_session_logs_user_id_date;
--   DROP INDEX IF EXISTS idx_session_logs_user_id_session_type_date;
--   DROP INDEX IF EXISTS idx_readiness_checkins_user_id_date;
--   DROP INDEX IF EXISTS idx_injury_areas_user_id_active;
--   DROP INDEX IF EXISTS idx_weekly_templates_user_id_mesocycle_id;
--   DROP INDEX IF EXISTS idx_chat_messages_user_id_created_at;
--   DROP INDEX IF EXISTS idx_chat_threads_user_id_updated_at;

-- programmes: list by user ordered by start_date; active programme lookup
-- (start_date <= today AND target_date >= today ORDER BY start_date DESC)
CREATE INDEX idx_programmes_user_id_start_date
  ON programmes (user_id, start_date DESC);

-- mesocycles: lookup by programme within a user (getMesocyclesByProgramme)
CREATE INDEX idx_mesocycles_user_id_programme_id
  ON mesocycles (user_id, programme_id);

-- mesocycles: date-range queries for active/upcoming/most-recent mesocycle
CREATE INDEX idx_mesocycles_user_id_planned_start
  ON mesocycles (user_id, planned_start);

-- planned_sessions: date-range queries (getPlannedSessionsInRange, getUpcomingPlannedSessions)
CREATE INDEX idx_planned_sessions_user_id_planned_date
  ON planned_sessions (user_id, planned_date);

-- planned_sessions: lookup by mesocycle within a user
CREATE INDEX idx_planned_sessions_user_id_mesocycle_id
  ON planned_sessions (user_id, mesocycle_id);

-- session_logs: date-range queries (getRecentSessions, getSessionCountThisWeek,
-- getLastSessionDate, getSessionsInDateRange, getGradeProgressionData)
CREATE INDEX idx_session_logs_user_id_date
  ON session_logs (user_id, date DESC);

-- session_logs: type-filtered date-range queries (getSessionsByType)
CREATE INDEX idx_session_logs_user_id_session_type_date
  ON session_logs (user_id, session_type, date DESC);

-- readiness_checkins: date-based lookups (getTodaysCheckin, getRecentCheckins,
-- hasCheckedInToday, getAverageReadiness, getReadinessTrend, deleteTodaysCheckin)
CREATE INDEX idx_readiness_checkins_user_id_date
  ON readiness_checkins (user_id, date DESC);

-- injury_areas: active-only lookup (getActiveInjuryAreas filters WHERE is_active = true)
-- Partial index keeps it small and avoids scanning archived rows.
CREATE INDEX idx_injury_areas_user_id_active
  ON injury_areas (user_id, added_at)
  WHERE is_active = true;

-- weekly_templates: lookup by mesocycle within a user (getWeeklyTemplateByMesocycle)
CREATE INDEX idx_weekly_templates_user_id_mesocycle_id
  ON weekly_templates (user_id, mesocycle_id);

-- chat_messages: future time-ordered message queries within a user
CREATE INDEX idx_chat_messages_user_id_created_at
  ON chat_messages (user_id, created_at DESC);

-- chat_threads: listing threads by recency within a user
CREATE INDEX idx_chat_threads_user_id_updated_at
  ON chat_threads (user_id, updated_at DESC);
