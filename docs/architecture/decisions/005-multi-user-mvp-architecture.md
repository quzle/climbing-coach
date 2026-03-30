# ADR 005: Multi-User MVP Architecture

## Status

Accepted — implementation in progress.

## Date

2026-03-30

## Context

The Climbing Coach application was built as a single-user tool: there is no authentication, no Row Level Security enforcement, and all data in every table belongs implicitly to one athlete. This was a deliberate Phase 1 shortcut to ship fast.

To support multiple athletes — or even to let the single developer share the app with a partner — the application needs:

1. An identity layer (Supabase Auth).
2. A profiles table that extends `auth.users` with application-level fields.
3. Row Level Security on all tables, scoped to the authenticated user.
4. A `user_id` foreign key column on every existing data table.

Doing all of this in one large migration would be high-risk. A phased, issue-by-issue approach is tracked in `docs/architecture/multi-user-migration-plan.md`.

## Decision

### User identity

Use **Supabase Auth** as the identity provider. No third-party identity service is introduced. Email/password sign-up is the initial supported method.

### Profiles table

A `profiles` table is created in the `public` schema with a **one-to-one primary-key foreign key** to `auth.users(id)`.

- `id` is both the primary key of `profiles` and a foreign key referencing `auth.users(id)`.
- `ON DELETE CASCADE` ensures a profile is automatically removed when the auth user is deleted.
- A `handle_new_user` trigger (running as `SECURITY DEFINER`) inserts the profile row automatically on sign-up. Callers never insert directly.

This is the standard Supabase profiles pattern and avoids nullable user columns on the core entity.

### MVP profile fields

| Field | Rationale |
|---|---|
| `display_name` | Personalise the coaching UI; populated from sign-up metadata when available. |

Additional fields (e.g. `avatar_url`, `timezone`, `experience_level`) are deferred to post-MVP to avoid premature schema commitment.

### Row Level Security

RLS is enabled on `profiles` from the start:

- `SELECT`: `auth.uid() = id`
- `UPDATE`: `auth.uid() = id`
- No public `INSERT` policy — inserts are trigger-only.

RLS on existing tables (`session_logs`, `readiness_checkins`, etc.) is added in subsequent migration steps once `user_id` columns are in place.

### Migration strategy

Each migration step is a separate issue and a separate SQL file under `supabase/migrations/`. Files are named `YYYYMMDDHHMMSS_description.sql` and applied in order. See `multi-user-migration-plan.md` for the full sequence.

## Consequences

**Positive:**
- Supabase Auth is already available in every environment (no extra service).
- Phased approach keeps PRs small and reviewable.
- Trigger-based profile creation removes a class of bugs (missing profile row).

**Negative / Trade-offs:**
- Existing single-user data in the database becomes orphaned once `user_id` columns are added. A data-seeding step is required (tracked in the migration plan).
- The `handle_new_user` trigger uses `SECURITY DEFINER`; it must be reviewed carefully to avoid privilege escalation.

## Alternatives Considered

| Alternative | Reason Rejected |
|---|---|
| Store user metadata only in `auth.users.raw_user_meta_data` | Not queryable with RLS; difficult to join; Supabase discourages it for app data |
| Separate `user_settings` table instead of `profiles` | No meaningful difference for MVP; `profiles` is the established Supabase convention |
| Add multi-user in one big migration | Too high-risk; hard to review; harder to roll back |
