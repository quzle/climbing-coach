# Multi-User Migration Plan

This document defines the implementation checklist for migrating Climbing Coach from a single-user architecture to a multi-user MVP.

The architectural decisions behind this plan are recorded in `docs/architecture/decisions/005-multi-user-mvp-architecture.md`.

## Scope

This plan covers:

- database ownership and identity changes
- invite-only authentication
- `profiles` and `chat_threads` schema additions
- user-scoped repository and API refactors
- login, logout, and user account UI
- browser state isolation
- `/dev` superuser tooling changes
- logging baseline
- deletion rules
- post-MVP security hardening

This plan does not include:

- user-facing data export
- organisations or team accounts
- billing
- full audit logging
- shared programmes or shared chat threads

## Locked Decisions

| Decision | Resolution |
|---|---|
| Identity provider | Supabase Auth |
| Signup model | Invite-only via Supabase native invite |
| User metadata | `profiles` table |
| Chat storage | `chat_threads` plus `chat_messages` |
| Seeded demo data | Reset before reseed |
| Dev access | Development environment plus server-side `superuser` role check |
| Active programme rule | One active programme per user |
| Deletion model | Archive or soft-delete where history matters |
| Delivery order | Functionality first, security hardening after happy path works |

## Phase Checklist

### Phase 1: Database Foundation

Goal: create the final ownership model in the schema before application changes begin.

- [x] **DB-1** Create `profiles` table
  - Depends on: none
  - Deliverables:
    - one-to-one link to `auth.users`
    - fields for `email`, `display_name`, `role`, `invite_status`, timestamps

- [x] **DB-2** Create `chat_threads` table
  - Depends on: none
  - Deliverables:
    - `user_id` ownership
    - thread metadata fields for MVP and later thread history expansion

- [x] **DB-3** Add `user_id` to all user-owned domain tables
  - Depends on: none
  - Deliverables:
    - `programmes`, `mesocycles`, `planned_sessions`, `session_logs`, `readiness_checkins`, `chat_messages`, `injury_areas`, `weekly_templates`

- [x] **DB-4** Add `thread_id` to `chat_messages`
  - Depends on: DB-2, DB-3

- [x] **DB-5** Enforce one active programme per user at database level
  - Depends on: DB-3
  - Deliverables:
    - partial unique index or equivalent constraint

- [x] **DB-6** Add supporting indexes for expected user-scoped query patterns
  - Depends on: DB-1, DB-2, DB-3

- [x] **DB-7** Regenerate and verify `src/lib/database.types.ts`
  - Depends on: DB-1, DB-2, DB-3, DB-4, DB-5, DB-6
  - Note: this is the database gate for downstream implementation

#### Phase 1 Implementation Notes (completed 2026-03-31)

Applied to remote project `qsihlcmjjwarxrnmmsse` using `supabase db push`.

The following issues were encountered and resolved during execution:

- **Missing DB-2 migration**: `chat_threads` had no creation migration in the original set. A new migration (`20260330000002_add_chat_threads.sql`) was added covering the `CREATE TABLE chat_threads` statement with `user_id` FK.
- **Duplicate migration timestamps**: The original three files all shared the `20260330000002` prefix. Supabase uses the numeric timestamp as a primary key in `supabase_migrations.schema_migrations`, so all three collided. They were renumbered to `000002`, `000003`, `000004`, `000005` sequentially.
- **Legacy data truncation**: The remote database contained existing single-user rows that would have blocked the `NOT NULL` `user_id` constraint in DB-3. A `TRUNCATE ... CASCADE` was prepended to migration `000000`. This is consistent with constraint 2 in ADR 005: the database can be recreated and backwards-compatible data migration is not required.

Final migration sequence applied:

| File | Description |
|---|---|
| `20260330000000_add_user_id_to_domain_tables.sql` | DB-3: truncate legacy data + add `user_id` FK to all domain tables |
| `20260330000001_create_profiles_table.sql` | DB-1: create `profiles` table with role/invite_status/timestamps |
| `20260330000002_add_chat_threads.sql` | DB-2: create `chat_threads` table (added during DB-7 execution) |
| `20260330000003_add_programme_status_constraint.sql` | DB-5: `status` column + partial unique index for one active programme per user |
| `20260330000004_add_thread_id_to_chat_messages.sql` | DB-4: add `thread_id` FK on `chat_messages` |
| `20260330000005_add_user_id_indexes.sql` | DB-6: 12 composite user-scoped indexes |

`src/lib/database.types.ts` regenerated via `supabase gen types typescript --project-id qsihlcmjjwarxrnmmsse`. All 10 tables present. All 50 test suites (395 tests) pass.

### Phase 2: Authentication, Invites, and Profiles Lifecycle

Goal: establish invite-only auth and server-side user resolution.

- [x] **AUTH-1** Confirm Supabase Auth configuration and package readiness
  - Depends on: DB-7

#### Phase 2 Implementation Notes (AUTH-1 completed 2026-03-31)

**Packages verified:**

| Package | Version | Role |
|---|---|---|
| `@supabase/ssr` | `^0.9.0` | SSR-safe browser + server clients |
| `@supabase/supabase-js` | `^2.100.0` | Core Supabase client |

**Client infrastructure verified (`src/lib/supabase/`):**

- `client.ts`: `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Correct for client components and browser-side auth flows.
- `server.ts`: `createServerClient` with `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` (service role) and full cookie read/write handlers. Correct for server components and API routes. Cookie handling enables `auth.getUser()` to validate the user's JWT from cookies even though the service role key is used for DB queries (which bypass RLS during this phase). RLS enforcement is deferred to Phase 9 (SEC-1).
- `middleware.ts`: `createServerClient` with `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Calls `supabase.auth.getUser()` on every non-static request to refresh the session token. Matcher excludes static assets. Route gating is deferred to AUTH-3.

**Bug fixed during AUTH-1 verification:**

The previous `supabase gen types` command had accidentally appended the Supabase CLI update notice to `src/lib/database.types.ts`, causing TypeScript parse errors at line 580. The notice was removed and the file is now valid TypeScript.

The regenerated types introduced new required fields (`shoulder_health` on `readiness_checkins.Row`, `shoulder_flag` on `session_logs.Row`, `status` on `programmes.Row`) that were missing from test fixtures and the readiness API route schema. All affected files were updated. TypeScript reports zero errors and all 50 test suites (395 tests) pass.

- [x] **AUTH-2** Add login page and authenticated session entry flow
  - Depends on: AUTH-1

#### Phase 2 Implementation Notes (AUTH-2 completed 2026-03-31)

Added auth entry flow under `src/app/auth/`:

- `src/app/auth/layout.tsx`: auth-specific layout that omits global navigation chrome for unauthenticated screens.
- `src/app/auth/login/page.tsx`: email/password sign-in page using Supabase Auth (`signInWithPassword`) with RHF + Zod validation and safe generic error messaging.
- `src/app/auth/callback/route.ts`: server callback route that exchanges Supabase auth codes for sessions (`exchangeCodeForSession`) and redirects to a validated local `next` path or fallback `/`.

Test coverage added:

- `src/app/auth/login/page.test.tsx`: rendering, validation, success redirect, failed auth error handling, callback error state, and in-flight submit state.
- `src/app/auth/callback/route.test.ts`: success path, safe/unsafe `next` handling, missing code, and failed code exchange redirects.

AUTH-2 establishes a working login UI and successful authenticated session entry flow. Route-level gating of protected pages remains in AUTH-3.

- [x] **AUTH-3** Update middleware for route gating and unauthenticated redirect handling
  - Depends on: AUTH-2

#### Phase 2 Implementation Notes (AUTH-3 completed 2026-03-31)

Updated `src/middleware.ts` to gate all protected routes:

- Added `isPublicPath()` helper: returns `true` for `/auth/**` routes (login, callback), which remain accessible without a session.
- After refreshing the session via `supabase.auth.getUser()`, if no authenticated user is present and the request is not to a public path, the middleware redirects to `/auth/login` (307).
- All other routes — including `/`, `/chat`, `/profile`, `/history`, `/programme/**`, `/readiness`, `/session/**`, `/dev`, and `/api/**` — require a valid session.
- The existing matcher (excluding `_next/*`, `favicon.ico`, and static files) is unchanged.

Test coverage added in `src/middleware.test.ts`:

- Authenticated requests pass through for all protected and public routes (9 tests).
- Unauthenticated requests to protected routes redirect to `/auth/login` with status 307 (9 tests).
- Unauthenticated requests to `/auth/login` and `/auth/callback` are allowed through (2 tests).

55 test suites, 444 tests pass.

- [x] **AUTH-4** Add shared server auth helper for `getCurrentUser()`
  - Depends on: AUTH-1

- [x] **AUTH-5** Create or finalize `profiles` row on first successful invited sign-in
  - Depends on: DB-1, AUTH-4

#### Phase 2 Implementation Notes (AUTH-5 completed 2026-03-31)

Implemented invited-user profile lifecycle finalization during auth callback:

- Added `src/services/auth/authLifecycleService.ts` with `finalizeInvitedUserProfile()`.
- `src/app/auth/callback/route.ts` now calls `finalizeInvitedUserProfile()` after successful `exchangeCodeForSession`.
- The profile is upserted using authenticated `id` + `email` and normalized to `role: 'user'` and `invite_status: 'active'`.
- If profile finalization fails (or email is unexpectedly missing), callback redirects to `/auth/login?error=callback_failed`.

Test coverage updates:

- Added `src/services/auth/authLifecycleService.test.ts` (3 unit tests).
- Updated `src/app/auth/callback/route.test.ts` with profile finalization success/failure coverage.

Executed test commands:

- `npx jest src/services/auth/authLifecycleService.test.ts src/app/auth/callback/route.test.ts --no-coverage`
- `npx jest --no-coverage`

Results: all 56 suites, 449 tests passed.

- [x] **AUTH-6** Add `requireSuperuser()` server-side helper
  - Depends on: AUTH-4, REPO-0

- [x] **AUTH-7** Implement invite action using Supabase native invite flow
  - Depends on: AUTH-6, LOG-1

### Phase 3: Logging Baseline

Goal: introduce structured operational logging before feature refactors.

- [x] **LOG-1** Create structured logger utility
  - Depends on: none

- [x] **LOG-2** Add auth and access-control event logging
  - Depends on: LOG-1, AUTH-4

- [x] **LOG-3** Define the route logging standard and add it to repository instructions
  - Depends on: LOG-1

- [x] **LOG-4** Add AI/chat request logging contract
  - Depends on: LOG-1

### Phase 4: Profiles Repository

Goal: make profile access available for role checks and lifecycle hooks.

- [x] **REPO-0** Create `profilesRepository` ✅ — implemented 2026-03-31. Exports `getProfile`, `getProfileByEmail`, `upsertProfile`, `updateProfile`. 14/14 unit tests pass.
  - Depends on: DB-1, DB-7

### Phase 5: Repository Refactor

Goal: explicitly scope all data access by authenticated user.

- [x] **REPO-1** Refactor `programmeRepository`
  - Depends on: DB-3, DB-5, DB-7, AUTH-4, LOG-1

- [x] **REPO-2** Refactor `mesocycleRepository`
  - Depends on: DB-3, DB-7, AUTH-4, LOG-1

- [x] **REPO-3** Refactor `plannedSessionRepository`
  - Depends on: DB-3, DB-7, AUTH-4, LOG-1

- [x] **REPO-4** Refactor `sessionRepository`
  - Depends on: DB-3, DB-7, AUTH-4, LOG-1

- [x] **REPO-5** Refactor `readinessRepository`
  - Depends on: DB-3, DB-7, AUTH-4, LOG-1

- [x] **REPO-6** Refactor `injuryAreasRepository`
  - Depends on: DB-3, DB-7, AUTH-4, LOG-1

- [x] **REPO-7** Refactor `weeklyTemplateRepository` ✅ — implemented 2026-04-01. Added `user_id` scoping to weekly template repository read/update/delete operations and updated dependent call sites/tests.
  - Depends on: DB-3, DB-7, AUTH-4, LOG-1

- [x] **REPO-8** Add chat thread and chat message repositories ✅ — implemented 2026-04-01. Added user-scoped repositories for `chat_threads` and `chat_messages`, added unit coverage, and wired existing chat persistence/history callsites to use the new data layer.
  - Depends on: DB-2, DB-4, DB-7, AUTH-4, LOG-1, LOG-4

### Phase 6: API Route Refactor

Goal: resolve the authenticated user in every route and propagate ownership checks consistently.

- [x] **API-0** Add `POST /api/invites` ✅ — implemented 2026-04-01. Added superuser-protected invite endpoint with Zod validation, standard API envelope, and structured route logging.
  - Depends on: AUTH-7, LOG-2, REPO-0

- [x] **API-1** Refactor `src/app/api/programmes/route.ts` ✅ — implemented 2026-04-01. Added unauthenticated (401) error handling to GET and POST, extended test coverage for 401 and 500 paths.
  - Depends on: AUTH-4, REPO-1, LOG-3

- [x] **API-2** Refactor `src/app/api/mesocycles/route.ts` ✅ — implemented 2026-04-01. Added unauthenticated (401) error handling to GET and POST, extended test coverage for 401 and 500 paths.
  - Depends on: AUTH-4, REPO-2, LOG-3

- [x] **API-3** Refactor `src/app/api/planned-sessions/route.ts` ✅ — implemented 2026-04-01. Added structured route logging, unauthenticated (401) handling, and expanded GET/POST error-path test coverage.
  - Depends on: AUTH-4, REPO-3, LOG-3

- [x] **API-4** Refactor `src/app/api/sessions/route.ts` ✅ — implemented 2026-04-01. Replaced placeholder user scoping with auth session user resolution, added structured route logging and 401 handling, and expanded GET/POST error-path tests.
  - Depends on: AUTH-4, REPO-4, LOG-3

- [x] **API-5** Refactor `src/app/api/readiness/route.ts` ✅ — implemented 2026-04-01. Added structured route logging and explicit unauthenticated (401) handling for POST/GET/DELETE, plus expanded route test coverage including DELETE behavior.
  - Depends on: AUTH-4, REPO-5, LOG-3

- [x] **API-6** Refactor `src/app/api/injury-areas/route.ts` ✅ — implemented 2026-04-01. Added structured logging and explicit unauthenticated (401) handling to injury-areas routes, with expanded GET/POST/DELETE route test coverage.
  - Depends on: AUTH-4, REPO-6, LOG-3

- [x] **API-7** Refactor `src/app/api/weekly-templates/route.ts` ✅ — implemented 2026-04-01. Added structured logging and explicit unauthenticated (401) handling for GET/POST, and expanded route tests for validation/auth/repository failure paths.
  - Depends on: AUTH-4, REPO-7, LOG-3

- [x] **API-8** Refactor `src/app/api/chat/route.ts` ✅ — implemented 2026-04-01. Route now resolves authenticated user, validates/reuses or creates chat threads, persists chat messages with thread scope, and returns `thread_id` with explicit 401/404 handling.
  - Depends on: AUTH-4, REPO-8, LOG-3, LOG-4

- [x] **API-9** Refactor the programme setup flow route ✅ — implemented 2026-04-01. Added session user resolution, user-scoped persistence, structured logging, and explicit unauthenticated (401) handling across programme setup routes.
  - Depends on: AUTH-4, REPO-1, LOG-3

### Phase 7: Client Auth UI and State Isolation

Goal: add user-facing auth controls, account management, and ensure browser state does not leak across users.

- [ ] **CLIENT-1** Add auth/profile context for client components
  - Depends on: AUTH-2, AUTH-4, REPO-0
  - Deliverables:
    - React context provider exposing authenticated user identity (id, email, display name, role) to client components
    - Wraps the app layout so all authenticated pages have access

- [ ] **CLIENT-2** Add logout action and UI trigger
  - Depends on: CLIENT-1
  - Deliverables:
    - Call `supabase.auth.signOut()` and redirect to `/auth/login`
    - Accessible logout button in the navigation or user menu

- [ ] **CLIENT-3** Add user indicator to navigation
  - Depends on: CLIENT-1, CLIENT-2
  - Deliverables:
    - Display the logged-in user's email or display name in the app chrome
    - Provide access to logout and account settings from the indicator

- [ ] **CLIENT-4** Add user account/settings page
  - Depends on: CLIENT-1
  - Deliverables:
    - Page showing email, display name
    - Password change flow via Supabase Auth `updateUser`

- [ ] **CLIENT-5** Update `useDraftSession` local storage key to include `userId`
  - Depends on: CLIENT-1

- [ ] **CLIENT-6** Update `useChatHistory` local storage key to include `userId` and `threadId`
  - Depends on: CLIENT-1, REPO-8

- [ ] **CLIENT-7** Clear user-scoped local storage on logout
  - Depends on: CLIENT-2, CLIENT-5, CLIENT-6

- [ ] **CLIENT-8** Verify same-browser account switching isolation
  - Depends on: CLIENT-7

### Phase 8: `/dev` Superuser Tooling

Goal: update development tools without weakening auth boundaries.

- [ ] **DEV-1** Enforce `requireSuperuser()` in dev-only privileged handlers
  - Depends on: AUTH-6

- [ ] **DEV-2** Add invite management controls to `/dev`
  - Depends on: API-0, CLIENT-1

- [ ] **DEV-3** Enforce reset-before-reseed behaviour in seed tooling
  - Depends on: DEV-1, REPO-1, REPO-4

- [ ] **DEV-4** Add target-user selection for seeded demo data
  - Depends on: DEV-3, REPO-0

### Phase 9: MVP Security Baseline

Goal: add database-level enforcement after the multi-user happy path is working.

- [ ] **SEC-1** Add RLS to all user-owned tables
  - Depends on: Phases 5 and 6 completed and verified

- [ ] **SEC-2** Add RLS to `profiles`
  - Depends on: SEC-1, REPO-0

- [ ] **SEC-3** Add RLS to `chat_threads`
  - Depends on: SEC-1

- [ ] **SEC-4** Standardize forbidden and auth-failure route handling
  - Depends on: LOG-2, all API route work complete

- [ ] **SEC-5** Add integration coverage for auth and authorization rules
  - Depends on: all API route work complete

### Phase 10: Documentation

Goal: keep repository documentation consistent with the architecture changes.

- [ ] **DOCS-1** Update `.github/copilot-instructions.md`
  - Depends on: LOG-3, implementation complete

- [ ] **DOCS-2** Update `docs/api/README.md`
  - Depends on: API route work complete

- [ ] **DOCS-3** Update `docs/architecture/overview.md`
  - Depends on: implementation complete

- [ ] **DOCS-4** Create ADR 005 for this migration and access model
  - Depends on: none for drafting

## Staging Deployment and Regression Test Points

These are non-production deployments for verifying multi-user migration progress. Each checkpoint targets the delta introduced since the previous checkpoint.

### Deploy 1: After Phase 6 (API Route Refactor)

Trigger: all API routes resolve `getCurrentUser()` and pass `userId` through; `SINGLE_USER_PLACEHOLDER_ID` fully removed.

Delta test targets:
- Invite a test user, complete the login flow, verify profile is created
- Exercise every CRUD flow (programme, mesocycle, sessions, readiness, injuries, chat, weekly templates) as the authenticated user
- Verify unauthenticated requests to all `/api/*` endpoints return 401/redirect
- Create two test users; verify User B cannot see or modify User A's data via API calls
- Verify the programme setup and AI generation flows pass `userId` end-to-end

### Deploy 2: After Phase 7 (Client Auth UI and State Isolation)

Trigger: auth context, logout, user indicator, account page, and scoped localStorage are all in place.

Delta test targets:
- Verify logged-in user's identity is visible in the navigation
- Logout redirects to `/auth/login` and clears the session
- Account/settings page displays correct user info; password change works
- Login as User A, create a draft session and send chat messages, logout, login as User B — no draft or chat history leaks
- Rapidly switch between two accounts in the same browser; verify complete state isolation

### Deploy 3: After Phase 8 (Dev Tooling)

Trigger: `/dev` routes enforce `requireSuperuser()`, seed/clear are user-targeted.

Delta test targets:
- Non-superuser receives 403 on all `/dev` and `/api/dev/*` endpoints
- Superuser can send invites from the `/dev` UI
- Seed demo data for a specific target user; verify it does not appear for other users
- Clear-and-reseed does not affect other users' data

### Deploy 4: After Phase 9 (MVP Security Baseline)

Trigger: RLS policies active on all user-owned tables; error handling standardized.

Delta test targets:
- Manually craft a Supabase client query using User A's JWT against User B's rows — verify RLS blocks it
- Verify RLS on `profiles` and `chat_threads` tables
- Confirm 401/403 responses are consistent across all routes
- Run the full integration test suite for auth and authorization rules

## Critical Path

```text
DB-1, DB-2, DB-3
  -> DB-4, DB-5, DB-6
  -> DB-7
  -> AUTH-1, AUTH-4, REPO-0
  -> AUTH-2 -> AUTH-3
  -> AUTH-5 -> AUTH-6 -> AUTH-7
  -> REPO-1 through REPO-8
  -> API-0 through API-9
  -> CLIENT-1 through CLIENT-8
  -> DEV-1 through DEV-4
  -> SEC-1 through SEC-5
  -> DOCS-1 through DOCS-4
```

## Parallel Work Guidance

These tasks can run in parallel once their prerequisites are complete:

- DB-1, DB-2, DB-3
- REPO-1 through REPO-8
- API-1 through API-9
- CLIENT-4 can run in parallel with CLIENT-2 and CLIENT-3
- CLIENT-5 and CLIENT-6 can run in parallel

These tasks should remain sequential because they define access-control boundaries or destructive behaviour:

- AUTH-4 before AUTH-6
- AUTH-6 before AUTH-7
- CLIENT-1 before CLIENT-2 before CLIENT-3
- CLIENT-5 and CLIENT-6 before CLIENT-7 before CLIENT-8
- DEV-1 before DEV-2, DEV-3, DEV-4
- DEV-3 before DEV-4
- security phase after route and repository verification

## Completion Criteria

This plan is complete when:

1. the schema supports authenticated multi-user ownership
2. invite-only onboarding works end-to-end
3. all user data access is explicitly scoped by `userId`
4. browser state is isolated by user
5. users can log out, see their identity, and manage their account
6. `/dev` privileged actions require a server-side superuser check
7. deletion behaviour is implemented according to the approved archive and reset rules
8. logging is present before feature rollout
9. baseline RLS and auth tests are in place after the happy path is working
