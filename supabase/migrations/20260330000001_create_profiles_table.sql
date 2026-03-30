-- DB-1: Create profiles table
-- One-to-one relationship with auth.users.
-- Stores application-owned user metadata for the multi-user MVP.

CREATE TABLE public.profiles (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          text        NOT NULL,
  display_name   text        NULL,
  role           text        NOT NULL DEFAULT 'user'     CHECK (role IN ('user', 'superuser')),
  invite_status  text        NOT NULL DEFAULT 'invited'  CHECK (invite_status IN ('invited', 'active')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Application-owned user metadata. One row per auth.users entry.';
COMMENT ON COLUMN public.profiles.role IS 'MVP values: user, superuser';
COMMENT ON COLUMN public.profiles.invite_status IS 'MVP values: invited, active';

-- Automatically keep updated_at current on every row modification.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
