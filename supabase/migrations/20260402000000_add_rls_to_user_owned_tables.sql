-- SEC-1: add RLS policies to all user-owned domain tables.
--
-- Each table gets a single owner policy for authenticated users:
-- users can access only rows where user_id equals auth.uid().

ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
CREATE POLICY programmes_user_access_policy
  ON programmes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE mesocycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY mesocycles_user_access_policy
  ON mesocycles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE planned_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY planned_sessions_user_access_policy
  ON planned_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_logs_user_access_policy
  ON session_logs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE readiness_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY readiness_checkins_user_access_policy
  ON readiness_checkins
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_user_access_policy
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE injury_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY injury_areas_user_access_policy
  ON injury_areas
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE weekly_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY weekly_templates_user_access_policy
  ON weekly_templates
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
