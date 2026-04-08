-- DB-2: Create chat_threads table
--
-- Thread-based chat persistence from the start (see ADR 005).
-- Each thread is owned by a single user via user_id FK.
-- chat_messages will reference threads via thread_id (see add_thread_id_to_chat_messages migration).

CREATE TABLE chat_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  title       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
