-- SEC-3: add RLS policy to chat_threads.
--
-- Authenticated users can access only rows where user_id equals auth.uid().

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_threads_user_access_policy
  ON public.chat_threads
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);