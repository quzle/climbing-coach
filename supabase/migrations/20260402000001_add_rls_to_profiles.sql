-- SEC-2: add RLS policies to profiles.
--
-- Authenticated users can read and update only their own profile row.
-- No INSERT or DELETE policy is granted to authenticated users.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own_profile_policy
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_update_own_profile_policy
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
