# ADR 005: Multi-User Migration Strategy

## Status

Planned — approved for implementation.

## Date

2026-03-30

## Context

The Climbing Coach application was built as a single-user personal tool. All architectural decisions up to this point (ADRs 001–004) assume exactly one user:

- No `user_id` column in any database table
- All Supabase queries use the service role key, bypassing Row Level Security
- No authentication layer — the application is assumed to run in a private Vercel project
- "Active" programme is implicitly the most recently created one
- Daily check-in uniqueness is enforced by `date` alone (not `user_id + date`)
- All AI context is built from the full database (not filtered by user)
- Chat history is a single global log, not per-user

The owner of this project wishes to expand the application to support multiple users (e.g. family members, training partners, or a commercial audience) while preserving all existing functionality for the current single user.

**Key constraints for the migration:**

1. **Zero data loss** — the existing athlete's data must be fully preserved and correctly attributed to their new user account
2. **Backwards compatibility** — the application must continue to function during a rolling migration (not a big-bang cutover)
3. **Minimal disruption** — the feature set should not regress during migration
4. **Security first** — once multi-user mode is enabled, no user should ever read or write another user's data
5. **Cost awareness** — Supabase and Vercel free-tier constraints must be respected; AI costs (Gemini) are per-request and will scale with users

## Decision

### Authentication Provider

Use **Supabase Auth** (built-in to the existing Supabase project) rather than a third-party identity provider.

**Rationale:**
- Already included at no extra cost in the existing Supabase project
- Native integration with Supabase RLS — `auth.uid()` is available in all RLS policies without extra setup
- Supabase Auth supports OAuth (Google, GitHub) and magic link email — no password management required
- Avoids adding a new vendor dependency (Auth0, Clerk, etc.) and a separate billing relationship
- The `@supabase/ssr` package already in the dependency tree supports server-side session handling in Next.js

**Supported auth methods (Phase 1):**
- Email + magic link (no password to lose or reset)
- Google OAuth (one-click sign-in)

### Profiles Table

A `profiles` table will be created to store user-specific settings and athlete profile data that currently lives in `programmes.athlete_profile` JSONB.

```sql
create table profiles (
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
```

A database trigger will auto-create a profile row when a new `auth.users` record is inserted.

### User ID in All Data Tables

All existing tables will have a `user_id uuid not null references auth.users(id) on delete cascade` column added. This is a breaking schema change handled via Supabase migration.

**Tables affected:**
- `programmes`
- `mesocycles` (inherited through `programme_id` but direct `user_id` still required for efficient RLS)
- `weekly_templates` (same rationale)
- `planned_sessions`
- `readiness_checkins`
- `session_logs`
- `chat_messages`
- `injury_areas`

### Row Level Security

RLS will be enabled on all tables. All policies will use `auth.uid() = user_id` to ensure strict per-user data isolation.

**Policy pattern applied to every table:**

```sql
alter table <table> enable row level security;

create policy "Users can only access their own rows"
  on <table> for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### Supabase Client Changes

The server Supabase client (`src/lib/supabase/server.ts`) currently uses the **service role key** which bypasses RLS. In the multi-user world, API routes must use the **user's session-scoped client** so that RLS filters rows automatically.

The service role key will be retained only for:
- Admin/superuser operations
- Dev/seed utilities
- The trigger that creates profile rows

### Deletion Model

Deleting an account (`auth.users` row) will cascade delete all user data via foreign key constraints. This provides GDPR-compliant full erasure with no orphaned records. The cascade chain is:

```
auth.users
  → profiles (cascade)
  → programmes (cascade)
    → mesocycles (cascade)
      → weekly_templates (cascade)
      → planned_sessions (set null on mesocycle_id)
  → readiness_checkins (cascade)
  → session_logs (cascade)
  → chat_messages (cascade)
  → injury_areas (cascade)
```

`planned_sessions.mesocycle_id` uses `set null` because sessions may be created ad hoc without a mesocycle.

### Dev/Superuser Access

The existing `/api/dev/seed-programme` and `/api/dev/clear-all` endpoints are currently protected by `NODE_ENV !== 'production'`. This will be replaced with a `is_superuser` check on the `profiles` table so that a designated admin account can access these tools in production without code deployments.

### Chat Persistence

`chat_messages` already has a `user_id` column in the multi-user design — each message is attributed to the user who sent it. The existing client-side history array (passed in the POST body) continues to work; the server additionally reads `chat_messages` from Supabase filtered by `user_id` for history persistence.

### Data Migration for Existing User

The existing single-user data will be migrated to the new owner's account using a one-time migration script. The migration sequence is:

1. Create the owner's Supabase Auth account
2. Insert a `profiles` row for the owner
3. `UPDATE <table> SET user_id = '<owner_uuid>'` for all existing rows across all tables
4. Enable RLS after data is attributed

This migration is non-destructive and reversible before RLS is enabled.

## Alternatives Considered

### Third-party Auth (Clerk, Auth0)

**Rejected.** These add a paid dependency, a separate dashboard, and require webhook-based user provisioning. Supabase Auth is already available and natively integrated with RLS.

### Multi-tenancy via separate Supabase projects

**Rejected.** Completely impractical for a shared application. One project, one schema, RLS for isolation.

### Soft multi-tenancy (no RLS, application-level filtering)

**Rejected.** Application-level filtering is error-prone and cannot be audited at the database level. A single missed `WHERE user_id = ?` clause would expose another user's data. RLS provides defence-in-depth.

## Consequences

**Positive:**
- Any number of users can safely use the application
- Supabase RLS provides a security layer independent of application code
- The profiles table enables per-user settings without JSONB juggling
- The migration path is incremental and can be rolled back at any phase before RLS is enabled
- Google OAuth reduces friction — no account creation flow required

**Negative:**
- All existing repositories must be updated to pass user context
- The Supabase client factories require significant refactoring
- All existing tests mock the Supabase client and will need updating
- The AI context builder must now scope all queries to the current user
- The dev seed endpoints must be reprotected with the new superuser mechanism

**Risk — Data Migration:**
Attributing all existing rows to the owner's UUID is a one-time, non-reversible operation after RLS is enabled. A full database backup must be taken before this migration is run.

## Implementation Plan

See [multi-user-migration-plan.md](../multi-user-migration-plan.md) for the phased implementation checklist with GitHub issue references.

## Files Requiring Changes

**Database (Supabase migrations)**

- [ ] `supabase/migrations/001_add_profiles_table.sql`
- [ ] `supabase/migrations/002_add_user_id_columns.sql`
- [ ] `supabase/migrations/003_enable_rls.sql`
- [ ] `supabase/migrations/004_migrate_existing_data.sql`

**Authentication**

- [ ] `src/lib/supabase/server.ts` — switch to session-scoped client
- [ ] `src/lib/supabase/client.ts` — update for auth session handling
- [ ] `src/middleware.ts` — add auth session refresh middleware
- [ ] `src/app/auth/` — login, callback, and sign-out pages
- [ ] `src/app/layout.tsx` — wrap with auth provider

**Services and Repositories**

- [ ] All files in `src/services/data/` — add `user_id` to all queries
- [ ] `src/services/ai/contextBuilder.ts` — scope context to current user
- [ ] `src/services/training/programmeService.ts` — pass user_id through

**API Routes**

- [ ] All API routes in `src/app/api/` — extract user from session, pass to service
- [ ] `src/app/api/dev/seed-programme/route.ts` — replace env check with superuser check
- [ ] `src/app/api/dev/clear-all/route.ts` — replace env check with superuser check

**UI Components**

- [ ] `src/app/page.tsx` — redirect unauthenticated users to login
- [ ] `src/components/layout/Navigation.tsx` — add user avatar/sign-out
- [ ] New: `src/app/auth/login/page.tsx`
- [ ] New: `src/app/auth/callback/route.ts`
- [ ] New: `src/app/profile/page.tsx` — view/edit athlete profile from profiles table
