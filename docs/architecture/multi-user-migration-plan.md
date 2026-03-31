# Multi-User Migration Plan

This document defines the implementation checklist for migrating Climbing Coach from a single-user architecture to a multi-user MVP.

The architectural decisions behind this plan are recorded in `docs/architecture/decisions/005-multi-user-mvp-architecture.md`.

## Scope

This plan covers:

- database ownership and identity changes
- invite-only authentication
- `profiles` and `chat_threads` schema additions
- user-scoped repository and API refactors
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

- [ ] **DB-1** Create `profiles` table
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

- [ ] **DB-4** Add `thread_id` to `chat_messages`
  - Depends on: DB-2, DB-3

- [ ] **DB-5** Enforce one active programme per user at database level
  - Depends on: DB-3
  - Deliverables:
    - partial unique index or equivalent constraint

- [x] **DB-6** Add supporting indexes for expected user-scoped query patterns
  - Depends on: DB-1, DB-2, DB-3

- [ ] **DB-7** Regenerate and verify `src/lib/database.types.ts`
  - Depends on: DB-1, DB-2, DB-3, DB-4, DB-5, DB-6
  - Note: this is the database gate for downstream implementation

### Phase 2: Authentication, Invites, and Profiles Lifecycle

Goal: establish invite-only auth and server-side user resolution.

- [ ] **AUTH-1** Confirm Supabase Auth configuration and package readiness
  - Depends on: DB-7

- [ ] **AUTH-2** Add login page and authenticated session entry flow
  - Depends on: AUTH-1

- [ ] **AUTH-3** Update middleware for route gating and unauthenticated redirect handling
  - Depends on: AUTH-2

- [ ] **AUTH-4** Add shared server auth helper for `getCurrentUser()`
  - Depends on: AUTH-1

- [ ] **AUTH-5** Create or finalize `profiles` row on first successful invited sign-in
  - Depends on: DB-1, AUTH-4

- [ ] **AUTH-6** Add `requireSuperuser()` server-side helper
  - Depends on: AUTH-4, REPO-0

- [ ] **AUTH-7** Implement invite action using Supabase native invite flow
  - Depends on: AUTH-6, LOG-1

### Phase 3: Logging Baseline

Goal: introduce structured operational logging before feature refactors.

- [ ] **LOG-1** Create structured logger utility
  - Depends on: none

- [ ] **LOG-2** Add auth and access-control event logging
  - Depends on: LOG-1, AUTH-4

- [ ] **LOG-3** Define the route logging standard and add it to repository instructions
  - Depends on: LOG-1

- [ ] **LOG-4** Add AI/chat request logging contract
  - Depends on: LOG-1

### Phase 4: Profiles Repository

Goal: make profile access available for role checks and lifecycle hooks.

- [ ] **REPO-0** Create `profilesRepository`
  - Depends on: DB-1, DB-7

### Phase 5: Repository Refactor

Goal: explicitly scope all data access by authenticated user.

- [ ] **REPO-1** Refactor `programmeRepository`
  - Depends on: DB-3, DB-5, DB-7, AUTH-4, LOG-1

- [ ] **REPO-2** Refactor `mesocycleRepository`
  - Depends on: DB-3, DB-7, AUTH-4, LOG-1

- [ ] **REPO-3** Refactor `plannedSessionRepository`
  - Depends on: DB-3, DB-7, AUTH-4, LOG-1

- [ ] **REPO-4** Refactor `sessionRepository`
  - Depends on: DB-3, DB-7, AUTH-4, LOG-1

- [ ] **REPO-5** Refactor `readinessRepository`
  - Depends on: DB-3, DB-7, AUTH-4, LOG-1

- [ ] **REPO-6** Refactor `injuryAreasRepository`
  - Depends on: DB-3, DB-7, AUTH-4, LOG-1

- [ ] **REPO-7** Refactor `weeklyTemplateRepository`
  - Depends on: DB-3, DB-7, AUTH-4, LOG-1

- [ ] **REPO-8** Add chat thread and chat message repositories
  - Depends on: DB-2, DB-4, DB-7, AUTH-4, LOG-1, LOG-4

### Phase 6: API Route Refactor

Goal: resolve the authenticated user in every route and propagate ownership checks consistently.

- [ ] **API-0** Add `POST /api/invites`
  - Depends on: AUTH-7, LOG-2, REPO-0

- [ ] **API-1** Refactor `src/app/api/programmes/route.ts`
  - Depends on: AUTH-4, REPO-1, LOG-3

- [ ] **API-2** Refactor `src/app/api/mesocycles/route.ts`
  - Depends on: AUTH-4, REPO-2, LOG-3

- [ ] **API-3** Refactor `src/app/api/planned-sessions/route.ts`
  - Depends on: AUTH-4, REPO-3, LOG-3

- [ ] **API-4** Refactor `src/app/api/sessions/route.ts`
  - Depends on: AUTH-4, REPO-4, LOG-3

- [ ] **API-5** Refactor `src/app/api/readiness/route.ts`
  - Depends on: AUTH-4, REPO-5, LOG-3

- [ ] **API-6** Refactor `src/app/api/injury-areas/route.ts`
  - Depends on: AUTH-4, REPO-6, LOG-3

- [ ] **API-7** Refactor `src/app/api/weekly-templates/route.ts`
  - Depends on: AUTH-4, REPO-7, LOG-3

- [ ] **API-8** Refactor `src/app/api/chat/route.ts`
  - Depends on: AUTH-4, REPO-8, LOG-3, LOG-4

- [ ] **API-9** Refactor the programme setup flow route
  - Depends on: AUTH-4, REPO-1, LOG-3

### Phase 7: Client State Isolation

Goal: ensure browser state does not leak across users.

- [ ] **CLIENT-1** Add auth/profile context for client components
  - Depends on: AUTH-2, AUTH-4, REPO-0

- [ ] **CLIENT-2** Update `useDraftSession` local storage key to include `userId`
  - Depends on: CLIENT-1

- [ ] **CLIENT-3** Update `useChatHistory` local storage key to include `userId` and `threadId`
  - Depends on: CLIENT-1, REPO-8

- [ ] **CLIENT-4** Clear user-scoped local storage on logout
  - Depends on: CLIENT-2, CLIENT-3

- [ ] **CLIENT-5** Verify same-browser account switching isolation
  - Depends on: CLIENT-4

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
  -> CLIENT-1 through CLIENT-5
  -> DEV-1 through DEV-4
  -> SEC-1 through SEC-5
  -> DOCS-1 through DOCS-4
```

## Parallel Work Guidance

These tasks can run in parallel once their prerequisites are complete:

- DB-1, DB-2, DB-3
- REPO-1 through REPO-8
- API-1 through API-9
- CLIENT-2 and CLIENT-3

These tasks should remain sequential because they define access-control boundaries or destructive behaviour:

- AUTH-4 before AUTH-6
- AUTH-6 before AUTH-7
- DEV-1 before DEV-2, DEV-3, DEV-4
- DEV-3 before DEV-4
- security phase after route and repository verification

## Completion Criteria

This plan is complete when:

1. the schema supports authenticated multi-user ownership
2. invite-only onboarding works end-to-end
3. all user data access is explicitly scoped by `userId`
4. browser state is isolated by user
5. `/dev` privileged actions require a server-side superuser check
6. deletion behaviour is implemented according to the approved archive and reset rules
7. logging is present before feature rollout
8. baseline RLS and auth tests are in place after the happy path is working
