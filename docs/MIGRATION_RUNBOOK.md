# Multi-User Migration Runbook

This runbook provides step-by-step instructions to migrate the Climbing Coach application from single-user to multi-user. Execute each phase in order and do not proceed to the next phase until the current phase is fully verified.

> **Warning:** Phase 3 (enabling RLS) combined with the data attribution script in Phase 2 is irreversible in practice. **Take a full Supabase database backup before beginning Phase 3.**

---

## Prerequisites

- Supabase project with admin access
- Vercel project access to update environment variables
- Node.js environment with `npm` available
- Access to the Supabase SQL Editor or `supabase` CLI

---

## Phase 1 — Configure Supabase Auth

### Step 1.1 — Enable Auth Providers

1. Go to your Supabase dashboard → **Authentication → Providers**
2. Enable **Email** with "Magic Link" (disable password to keep it simple)
3. Enable **Google** OAuth:
   - Create a Google OAuth app in [Google Cloud Console](https://console.cloud.google.com)
   - Add the Supabase callback URL to the allowed redirect URIs: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
   - Copy the Client ID and Client Secret into Supabase

### Step 1.2 — Configure Redirect URLs

In Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://<your-app>.vercel.app`
- **Additional Redirect URLs:** `http://localhost:3000/auth/callback` (for local dev)

### Step 1.3 — Update Environment Variables

Add to Vercel project settings and `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=...           # already present
NEXT_PUBLIC_SUPABASE_ANON_KEY=...     # already present
SUPABASE_SECRET_KEY=...               # already present (service role key)
```

No new environment variables are required for Phase 1.

---

## Phase 2 — Create Profiles Table and Add user_id Columns

### Step 2.1 — Run Migration 001: Profiles Table

Open Supabase SQL Editor and run:

```sql
-- Create profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  current_grade_bouldering text,
  current_grade_sport text,
  current_grade_onsight text,
  goal_grade text,
  strengths text,
  weaknesses text,
  additional_context text,
  is_superuser boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on new user sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

**Verify:** Insert a test user via Supabase Auth and confirm a profile row is auto-created.

### Step 2.2 — Run Migration 002: Add user_id Columns

```sql
-- Add nullable user_id to all data tables
alter table programmes     add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table mesocycles     add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table weekly_templates add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table planned_sessions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table readiness_checkins add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table session_logs    add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table chat_messages   add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table injury_areas    add column if not exists user_id uuid references auth.users(id) on delete cascade;
```

**Verify:** All tables have a `user_id` column (nullable). Existing rows remain intact.

### Step 2.3 — Sign In as the Owner

1. Deploy the Phase 1 application changes
2. Visit your application and sign in using Google OAuth or magic link
3. Record the owner's UUID from Supabase → **Authentication → Users**

### Step 2.4 — Run Migration 003: Attribute Existing Data

Replace `<OWNER_UUID>` with the UUID from step 2.3. UUIDs look like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
(e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`):

```sql
-- Attribute all existing rows to the owner
update programmes       set user_id = '<OWNER_UUID>' where user_id is null;
update mesocycles       set user_id = '<OWNER_UUID>' where user_id is null;
update weekly_templates set user_id = '<OWNER_UUID>' where user_id is null;
update planned_sessions set user_id = '<OWNER_UUID>' where user_id is null;
update readiness_checkins set user_id = '<OWNER_UUID>' where user_id is null;
update session_logs     set user_id = '<OWNER_UUID>' where user_id is null;
update chat_messages    set user_id = '<OWNER_UUID>' where user_id is null;
update injury_areas     set user_id = '<OWNER_UUID>' where user_id is null;
```

**Verify:** Run `select count(*) from programmes where user_id is null;` — result must be `0` for all tables.

### Step 2.5 — Set Owner as Superuser

```sql
update public.profiles
set is_superuser = true
where id = '<OWNER_UUID>';
```

---

## Phase 3 — Enable Row Level Security

> **⚠️ Point of no return.** Take a full database backup before this step.

### Step 3.1 — Supabase Backup

In Supabase → **Settings → Database → Backups** — create a manual backup. Wait for it to complete.

### Step 3.2 — Run Migration 004: Enable RLS

```sql
-- Make user_id NOT NULL (all rows must be attributed)
alter table programmes       alter column user_id set not null;
alter table mesocycles       alter column user_id set not null;
alter table weekly_templates alter column user_id set not null;
alter table planned_sessions alter column user_id set not null;
alter table readiness_checkins alter column user_id set not null;
alter table session_logs     alter column user_id set not null;
alter table chat_messages    alter column user_id set not null;
alter table injury_areas     alter column user_id set not null;

-- Enable RLS on all tables
alter table programmes         enable row level security;
alter table mesocycles         enable row level security;
alter table weekly_templates   enable row level security;
alter table planned_sessions   enable row level security;
alter table readiness_checkins enable row level security;
alter table session_logs       enable row level security;
alter table chat_messages      enable row level security;
alter table injury_areas       enable row level security;
alter table profiles           enable row level security;

-- Policies: users can only access their own rows
create policy "Own rows only" on programmes         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own rows only" on mesocycles         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own rows only" on weekly_templates   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own rows only" on planned_sessions   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own rows only" on readiness_checkins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own rows only" on session_logs       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own rows only" on chat_messages      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own rows only" on injury_areas       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own profile only" on profiles        for all using (auth.uid() = id) with check (auth.uid() = id);
```

### Step 3.3 — Verify RLS

Run as two different authenticated users and confirm isolation:

```sql
-- Should return only the querying user's rows
select count(*) from programmes;
select count(*) from readiness_checkins;
```

---

## Phase 4 — Deploy Application Code Changes

Deploy each phase's code changes via Vercel:

1. Push the Phase 1 branch (auth foundation) → verify sign-in works
2. Push the Phase 2 branch (profiles + repositories) → verify profile page works
3. Push the Phase 3 branch (session-scoped client) → verify data still loads correctly
4. Push the Phase 4 branch (AI context scoping) → verify chat works
5. Push the Phase 5 branch (superuser dev tools) → verify dev tools require superuser
6. Push the Phase 6 branch (programme generation) → verify wizard creates attributed data

---

## Post-Migration Verification Queries

Run in Supabase SQL Editor to confirm data integrity:

```sql
-- Verify no orphaned rows
select 'programmes' as table_name, count(*) as null_user_id_count from programmes where user_id is null
union all
select 'mesocycles', count(*) from mesocycles where user_id is null
union all
select 'readiness_checkins', count(*) from readiness_checkins where user_id is null
union all
select 'session_logs', count(*) from session_logs where user_id is null
union all
select 'chat_messages', count(*) from chat_messages where user_id is null
union all
select 'injury_areas', count(*) from injury_areas where user_id is null;

-- All counts should be 0

-- Verify owner data is intact
select count(*) as programme_count from programmes where user_id = '<OWNER_UUID>';
select count(*) as session_count from session_logs where user_id = '<OWNER_UUID>';
select count(*) as checkin_count from readiness_checkins where user_id = '<OWNER_UUID>';
```

---

## Rollback Procedures

### Rollback Phase 1 (Auth)

1. Revert the `src/middleware.ts` to remove auth redirect
2. Deploy the reverted code

### Rollback Phase 2 (Columns)

```sql
-- Drop user_id columns (only if no rows have been attributed yet)
alter table programmes       drop column if exists user_id;
-- Repeat for all tables
```

### Rollback Phase 3 (RLS)

```sql
-- Disable RLS (only practical before Phase 2 attribution)
alter table programmes         disable row level security;
-- Repeat for all tables

-- Drop policies
drop policy if exists "Own rows only" on programmes;
-- Repeat for all tables

-- Make user_id nullable again
alter table programmes alter column user_id drop not null;
-- Repeat for all tables
```

> **Note:** Rollback from Phase 3 after data attribution is very high risk. Restore from the backup taken before Phase 3 instead.
