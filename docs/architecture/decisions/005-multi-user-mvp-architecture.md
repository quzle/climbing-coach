# ADR 005: Multi-User MVP Architecture and Access Model

## Status

Accepted and implemented for the multi-user MVP baseline.

Implementation outcome snapshot updated 2026-04-02.

## Date

2026-03-30

## Context

The current application was built as a single-user tool. The data model, repository layer, API routes, browser persistence, and chat storage all assume one implicit athlete.

This is no longer acceptable because the application is moving into a small multi-user MVP phase.

The migration must satisfy the following constraints:

1. MVP delivery should prioritise working functionality over full security hardening.
2. The database can be recreated. There is no need for backwards-compatible data migration.
3. The MVP should remain viable on free hosting plans for a very small user base.
4. The architecture should remain suitable for later growth to roughly 1500 users without requiring a schema rewrite.
5. Signup must be invite-only.
6. The `/dev` page remains development-only, but privileged actions on it must also be access-controlled.
7. Logging, deletion rules, and chat persistence rules must be defined before implementation starts.

## Decision

### Identity and Access

Use Supabase Auth as the identity provider for the MVP.

- `auth.users.id` is the canonical user identifier.
- Application-owned user metadata lives in a new `profiles` table.
- Signup is invite-only using the Supabase native invite flow.
- Protected server-side code must resolve the authenticated user from Supabase session context. Client-submitted user identifiers are never trusted for authorization.

### Profiles Table

Add a `profiles` table with a one-to-one relationship to `auth.users`.

Minimum MVP fields:

- `id uuid primary key references auth.users(id)`
- `email text not null`
- `display_name text null`
- `role text not null default 'user'`
- `invite_status text not null default 'invited'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Supported role values for MVP:

- `user`
- `superuser`

Supported invite status values for MVP:

- `invited`
- `active`

### Ownership Model

Every domain record belongs to exactly one authenticated user.

Add `user_id uuid not null references auth.users(id)` to all user-owned tables:

- `programmes`
- `mesocycles`
- `planned_sessions`
- `session_logs`
- `readiness_checkins`
- `chat_messages`
- `injury_areas`
- `weekly_templates`

This project does not support shared records, teams, coach-managed workspaces, or organisations in the MVP.

### Active Programme Rule

Each user may have multiple historical programmes, but only one active programme at a time.

This rule must be enforced in two places:

1. Database constraint, using a partial unique index or equivalent.
2. Repository and service logic, so user-facing errors are predictable.

### Chat Persistence Model

Define chat persistence as thread-based from the start.

Add a `chat_threads` table owned by `user_id`.
`chat_messages` should reference `thread_id`.

The MVP may expose only one default thread per user in the UI, but the schema must support multiple threads later without another data-model redesign.

### Dev Tooling and Superuser Access

The `/dev` page remains restricted to development environments.

In addition, privileged actions within `/dev` must require a server-side `superuser` role check based on `profiles.role`.

This applies to actions such as:

- sending invites
- seeding demo data
- resetting seeded data
- destructive cleanup operations

UI visibility alone is not sufficient authorization.

### Seeded Demo Data Policy

Seeded demo data is allowed through `/dev` tooling for invited users.

The approved behaviour is reset-before-reseed:

- existing user data must be explicitly reset before a seed can be applied again
- the system must not silently overwrite live user records

### Deletion Model

Deletion behaviour is defined before implementation.

- `programmes` are archived, not hard-deleted
- `mesocycles` and `weekly_templates` should use archive or soft-delete semantics where history depends on them
- `planned_sessions` should be cancellable or archivable once referenced by logs
- `session_logs`, `readiness_checkins`, and `chat_messages` should not expose broad destructive deletion in MVP user flows
- destructive resets are limited to development-only superuser tooling

### Logging Model

Add structured operational logging before feature work starts.

Initial log fields should include where available:

- `event`
- `user_id`
- `profile_role`
- `route`
- `entity_type`
- `entity_id`
- `outcome`
- `duration_ms`
- `request_id`
- `environment`

Initial events should cover:

- login success and failure
- invite sent and invite accepted
- ownership denial
- privileged dev action execution
- repository write failure
- AI/chat request execution

Sensitive data such as tokens and chat message bodies must not be logged.

### Security Rollout Strategy

Delivery is functionality-first, not security-first.

The implementation order is:

1. final multi-user schema shape
2. auth and invite flow
3. explicit user-scoped repository and API behaviour
4. client-side state isolation
5. development tooling updates
6. baseline RLS and authorization hardening

Row Level Security remains part of the target architecture, but it is introduced after the multi-user happy path is working end-to-end.

## Consequences

### Positive

- The schema is future-proofed for real authenticated users from the first implementation pass.
- The MVP remains simple enough to build on the current free Supabase and Vercel setup.
- Invite-only onboarding reduces abuse and support noise during early rollout.
- Thread-based chat storage avoids a second redesign if chat history expands later.
- The `profiles` table provides a clean place for role checks, onboarding state, and future user metadata.

### Negative

- The migration touches most layers of the application even though no new user-facing feature is being added yet.
- The application must now manage user lifecycle, profile creation, invite flow, and role-based dev controls.
- Deferring full RLS means the app will temporarily rely more heavily on correct server-side user scoping until hardening is complete.

## Alternatives Considered

### Third-Party Auth Provider Such as Clerk

Rejected for MVP.

Reason:

- It adds another identity system to integrate into a Supabase-owned data layer.
- It increases implementation complexity without a clear MVP benefit.
- Supabase Auth already fits the database ownership model and the planned RLS path.

### Open Signup

Rejected for MVP.

Reason:

- Invite-only better matches a demonstrator rollout.
- It reduces abuse risk before rate limits and broader hardening are in place.

### Flat Chat Message Storage Without Threads

Rejected.

Reason:

- It would simplify the MVP slightly, but would create another schema migration when multiple chat histories are needed.

### Hard Delete for All User Data

Rejected.

Reason:

- It conflicts with preserving training history.
- It increases the risk of accidental destructive actions.
- It makes later export and audit-style features harder.

## Implementation Notes

The execution order and dependency structure for this ADR are documented in `docs/architecture/multi-user-migration-plan.md`.

## Implementation Outcomes (2026-04-02 Snapshot)

### Completed Outcomes

- Multi-user ownership model is implemented across user-owned domain tables with explicit `user_id` scoping.
- `profiles` lifecycle is implemented for invite-only onboarding, with server-side `role` and `invite_status` transitions.
- Chat persistence is thread-based (`chat_threads` + `chat_messages.thread_id`) and route/repository support is in place.
- API route auth resolution and ownership propagation are implemented across core route families (`programmes`, `mesocycles`, `planned_sessions`, `sessions`, `readiness`, `injury_areas`, `weekly_templates`, `chat`).
- Privileged `/api/dev/*` actions enforce server-side `requireSuperuser()` checks.
- Structured logging baseline is implemented (`logInfo`, `logWarn`, `logError`) with ADR-aligned field conventions.
- Baseline RLS hardening is in place for user-owned tables, `profiles`, and `chat_threads`.
- Integration auth/RLS test harness is implemented and validated against a dedicated integration Supabase project.

### Operational Model in Use

- Production Supabase project: `qsihlcmjjwarxrnmmsse`.
- Integration Supabase project: `tmtspymjfnemygpquyhw`.
- Migration policy: every schema migration is applied to both projects, then `src/lib/database.types.ts` is regenerated from production.

### Known Transitional Items

- Supabase dashboard email-template setup steps (allowed redirect URLs and token-hash invite/magic-link templates) remain explicit operational prerequisites in the migration plan.
- A small number of legacy route behaviors are documented transparently in API docs and tracked for follow-up refactor hardening.
