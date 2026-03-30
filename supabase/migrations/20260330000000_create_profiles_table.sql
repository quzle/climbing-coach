-- Migration: create profiles table
-- Part of: multi-user MVP migration (DB-1)
--
-- Creates a profiles table with a one-to-one link to auth.users.
-- A row is inserted automatically when a new user signs up via the
-- handle_new_user trigger defined below.

create table public.profiles (
  id            uuid        not null references auth.users (id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_pkey primary key (id)
);

-- Row Level Security: each user may only read and update their own profile row.
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: automatically create a profile row when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Rollback:
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.handle_new_user();
-- drop policy if exists "Users can update their own profile" on public.profiles;
-- drop policy if exists "Users can view their own profile" on public.profiles;
-- drop table if exists public.profiles;
