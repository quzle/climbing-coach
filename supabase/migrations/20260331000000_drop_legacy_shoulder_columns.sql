-- ADR 004 (Phase 2-D / cutover): drop legacy shoulder-specific columns.
-- shoulder_health on readiness_checkins and shoulder_flag on session_logs were
-- replaced by the generic injury_area_health / injury_areas system. The
-- application layer already has a legacy-compat retry shim that back-fills
-- shoulder_health for any remote database that still carries the column; once
-- this migration is applied that shim becomes dead code (removed separately).

ALTER TABLE readiness_checkins DROP COLUMN IF EXISTS shoulder_health;
ALTER TABLE session_logs DROP COLUMN IF EXISTS shoulder_flag;
