-- DB-4: Add thread_id FK to chat_messages
--
-- Links each chat message to the thread it belongs to.
-- NULL is allowed so that messages created before threading was introduced
-- remain valid. Future migrations or application logic can back-fill this
-- column once threads are in active use.
--
-- Rollback:
--   ALTER TABLE chat_messages DROP COLUMN IF EXISTS thread_id;

ALTER TABLE chat_messages
  ADD COLUMN thread_id uuid NULL REFERENCES chat_threads(id) ON DELETE SET NULL;
