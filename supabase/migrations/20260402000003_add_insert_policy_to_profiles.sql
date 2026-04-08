-- SEC-2 addendum: add INSERT policy to profiles.
--
-- The upsert in authLifecycleService.finalizeInvitedUserProfile sends a POST
-- to the REST API, which requires INSERT privilege even when it resolves to an
-- UPDATE on conflict. Without this policy, the authenticated user cannot call
-- upsertProfile during the invite confirmation flow.
--
-- WITH CHECK (auth.uid() = id) ensures users can only insert their own row.
--
-- Rollback:
--   DROP POLICY IF EXISTS profiles_insert_own_profile_policy ON public.profiles;

CREATE POLICY profiles_insert_own_profile_policy
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
