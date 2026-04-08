-- DB-5: Enforce one active programme per user at database level
--
-- Adds a status column to programmes and a partial unique index that
-- prevents more than one row with status = 'active' per user_id.
-- The database constraint rejects any INSERT or UPDATE that would result
-- in a second active programme for the same user. Callers must explicitly
-- transition the existing active programme to 'completed' or 'paused'
-- before inserting or activating a new one.

ALTER TABLE programmes
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'paused'));

-- Partial unique index: at most one active programme per user at any time.
CREATE UNIQUE INDEX idx_programmes_one_active_per_user
  ON programmes (user_id)
  WHERE (status = 'active');
