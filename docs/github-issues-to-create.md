# GitHub Issues to Create

This file documents all GitHub issues that need to be created for the multi-user migration.
Each issue references the relevant documentation and includes a definition of done.

**Reference documentation:**
- ADR: `docs/architecture/decisions/005-multi-user-migration.md`
- Implementation Plan: `docs/architecture/multi-user-migration-plan.md`
- Migration Runbook: `docs/MIGRATION_RUNBOOK.md`

---

## Issue 1

**Title:** `feat: authentication foundation (Supabase Auth + session middleware)`

**Labels:** `enhancement`, `multi-user-migration`, `phase-1`

**Body:**

```
## Overview

Implement Supabase Auth sign-in (magic link + Google OAuth) as the first step in the
multi-user migration. After this phase, users can sign in and sign out, and the
application knows who is making each request.

No data scoping changes are made in this phase — that comes in Phase 2 and 3.

## References

- ADR 005: docs/architecture/decisions/005-multi-user-migration.md
- Implementation Plan (Phase 1): docs/architecture/multi-user-migration-plan.md#phase-1--authentication-foundation

## Depends on

None — this is the first phase.

## Implementation Tasks

- [ ] Configure Supabase Auth (magic link + Google OAuth) in Supabase dashboard
- [ ] Create `src/app/auth/login/page.tsx` (magic link email form + Google button)
- [ ] Create `src/app/auth/callback/route.ts` (OAuth code exchange)
- [ ] Update `src/middleware.ts` to redirect unauthenticated users to `/auth/login`
- [ ] Update `src/lib/supabase/server.ts` to expose `getAuthenticatedUser()` helper
- [ ] Update `src/app/layout.tsx` and navigation to show user email and sign-out link
- [ ] Add NEXT_PUBLIC_APP_URL to Vercel environment variables if not present

## Definition of Done

- [ ] Unauthenticated requests to any page redirect to `/auth/login`
- [ ] Magic link email flow works end-to-end in a Supabase Auth test environment
- [ ] Google OAuth flow works end-to-end
- [ ] Authenticated user's email is displayed in navigation
- [ ] Sign-out clears the session and redirects to `/auth/login`
- [ ] `getAuthenticatedUser()` returns the correct user in all API routes
- [ ] All new auth pages are mobile-first with 44px minimum interactive element height
- [ ] Unit tests added/updated for middleware and `getAuthenticatedUser()` helper
- [ ] `npm test` passes with zero failures — results posted as a comment on this issue
- [ ] `docs/ux/README.md` updated to reference the login/auth flow
- [ ] `docs/architecture/overview.md` updated to describe the auth session model
```

---

## Issue 2

**Title:** `feat: profiles table, user_id columns, and existing data attribution`

**Labels:** `enhancement`, `multi-user-migration`, `phase-2`

**Body:**

```
## Overview

Create the `profiles` table to hold per-user settings (athlete profile data, superuser
flag). Add a nullable `user_id` column to all data tables. Attribute all existing
single-user rows to the owner's account.

This phase deliberately keeps `user_id` nullable and does NOT yet enable RLS, so the
application continues to work during the migration.

## References

- ADR 005: docs/architecture/decisions/005-multi-user-migration.md
- Implementation Plan (Phase 2): docs/architecture/multi-user-migration-plan.md#phase-2--profiles-table-and-user-data-attribution
- Migration Runbook (Phase 2 steps): docs/MIGRATION_RUNBOOK.md#phase-2--create-profiles-table-and-add-user_id-columns

## Depends on

Issue 1 (Phase 1 — Auth Foundation) — owner must exist in auth.users before data can be attributed

## Implementation Tasks

- [ ] Supabase migration 001: create `profiles` table + auto-create trigger (see runbook)
- [ ] Supabase migration 002: add nullable `user_id` columns to all data tables (see runbook)
- [ ] Supabase migration 003: attribute existing rows to owner UUID (see runbook)
- [ ] Create `src/services/data/profileRepository.ts` with `getProfile`, `updateProfile`, `upsertProfile`
- [ ] Create `GET /api/profile` and `PUT /api/profile` routes
- [ ] Create `src/app/profile/page.tsx` with React Hook Form + Zod resolver
- [ ] Regenerate `src/lib/database.types.ts` from Supabase after migrations

## Definition of Done

- [ ] `profiles` table created with auto-create trigger verified (sign in → profile row appears)
- [ ] All data tables have a nullable `user_id` column
- [ ] All existing rows attributed to owner UUID in the development environment (zero NULL user_id rows)
- [ ] Owner account has `is_superuser = true` (see runbook step 2.5)
- [ ] `profileRepository.ts` unit tests cover `getProfile`, `updateProfile`, `upsertProfile`
- [ ] `GET /api/profile` returns the authenticated user's profile
- [ ] `PUT /api/profile` updates profile fields correctly
- [ ] Profile page renders and submits correctly on mobile
- [ ] `npm test` passes with zero failures — results posted as a comment on this issue
- [ ] `docs/architecture/database.md` updated with `profiles` table schema and `user_id` column details
- [ ] `docs/api/README.md` updated with `/api/profile` endpoints
```

---

## Issue 3

**Title:** `feat: enable Row Level Security on all data tables`

**Labels:** `enhancement`, `multi-user-migration`, `phase-3`, `security`

**Body:**

```
## Overview

Make `user_id` NOT NULL and enable Row Level Security (RLS) on all tables. Configure
per-user access policies using `auth.uid() = user_id`. Switch the application from
the service role key (which bypasses RLS) to a session-scoped client for standard
data operations.

⚠️ This is the point of no return — take a full database backup before this phase.

## References

- ADR 005: docs/architecture/decisions/005-multi-user-migration.md (RLS section)
- Implementation Plan (Phase 3): docs/architecture/multi-user-migration-plan.md#phase-3--row-level-security
- Migration Runbook (Phase 3 steps): docs/MIGRATION_RUNBOOK.md#phase-3--enable-row-level-security

## Depends on

Issue 2 (Phase 2) — all rows must be attributed before `user_id` can be made NOT NULL

## Implementation Tasks

- [ ] Take a full Supabase database backup before starting
- [ ] Supabase migration 004: make `user_id` NOT NULL, enable RLS, add policies (see runbook)
- [ ] Update `src/lib/supabase/server.ts` to provide a session-scoped client + `createAdminClient()`
- [ ] Update all `src/services/data/` repositories to use the session-scoped client
- [ ] Update all `src/app/api/` routes to call `getAuthenticatedUser()` and pass session client

## Definition of Done

- [ ] RLS migration applied successfully — no row with `user_id IS NULL` in any table
- [ ] A user cannot read or write another user's data (manual test: create two accounts, verify isolation)
- [ ] All existing queries return identical results after RLS is enabled (regression check)
- [ ] `createAdminClient()` is used only in dev/superuser routes
- [ ] All API routes return 401 when the session is expired or missing
- [ ] Integration tests cover 401 paths for at least one representative route per resource
- [ ] `npm test` passes with zero failures — results posted as a comment on this issue
- [ ] `docs/architecture/overview.md` updated to describe the session-scoped client model
- [ ] `docs/architecture/database.md` updated with RLS policy details
```

---

## Issue 4

**Title:** `feat: scope AI context and chat history to authenticated user`

**Labels:** `enhancement`, `multi-user-migration`, `phase-4`

**Body:**

```
## Overview

Update the AI coach context builder and chat endpoints so that each user's coaching
context and chat history are fully isolated. With RLS already in place, this primarily
involves ensuring all queries use the session-scoped client.

## References

- ADR 005: docs/architecture/decisions/005-multi-user-migration.md (Chat Persistence section)
- Implementation Plan (Phase 4): docs/architecture/multi-user-migration-plan.md#phase-4--ai-context-scoped-to-current-user

## Depends on

Issue 3 (Phase 3 — RLS enabled) — RLS is what provides the actual isolation

## Implementation Tasks

- [ ] Update `src/services/ai/contextBuilder.ts` — all repo calls receive the session-scoped client
- [ ] Update `src/app/api/chat/route.ts` — call `getAuthenticatedUser()` and pass session client
- [ ] Update `src/app/api/chat/history/route.ts` — fetch history via session-scoped client
- [ ] Create `src/services/data/chatRepository.ts` with `getChatHistory(limit)` and `saveChatMessage(role, content)`
- [ ] Verify coaching warnings computed from current user's data only

## Definition of Done

- [ ] Two users can have independent chat conversations simultaneously
- [ ] Each user's chat history is isolated (user A cannot see user B's messages)
- [ ] AI coaching context reflects only the authenticated user's sessions, readiness, and programme
- [ ] `chatRepository.ts` unit tests cover `getChatHistory` and `saveChatMessage`
- [ ] `contextBuilder.ts` tests updated to verify user-scoped query calls
- [ ] `npm test` passes with zero failures — results posted as a comment on this issue
- [ ] `docs/ai-context/coaching-system-prompt.md` updated to document per-user context model
```

---

## Issue 5

**Title:** `feat: superuser access control for dev endpoints`

**Labels:** `enhancement`, `multi-user-migration`, `phase-5`, `security`

**Body:**

```
## Overview

Replace the `NODE_ENV !== 'production'` guard on the dev endpoints with a proper
`is_superuser` check against the `profiles` table. This allows a designated admin
account to use dev tools in production without code deployments, while keeping
those tools completely inaccessible to regular users.

## References

- ADR 005: docs/architecture/decisions/005-multi-user-migration.md (Dev/Superuser Access section)
- Implementation Plan (Phase 5): docs/architecture/multi-user-migration-plan.md#phase-5--dev--superuser-access-replatform

## Depends on

Issue 2 (Phase 2) — requires `profiles` table with `is_superuser` column

## Implementation Tasks

- [ ] Create `src/lib/auth/requireSuperuser.ts` — returns 403 if user is not superuser
- [ ] Update `src/app/api/dev/seed-programme/route.ts` — replace env check with `requireSuperuser()`
- [ ] Update `src/app/api/dev/clear-all/route.ts` — replace env check with `requireSuperuser()`; use `createAdminClient()` for truncate
- [ ] Update or create `src/app/dev/page.tsx` — protected by `requireSuperuser()`, with confirmation dialogs
- [ ] Document how to set `is_superuser = true` for the owner account in `docs/MIGRATION_RUNBOOK.md`

## Definition of Done

- [ ] `/api/dev/seed-programme` returns 403 for non-superusers in all environments
- [ ] `/api/dev/clear-all` returns 403 for non-superusers in all environments
- [ ] A superuser account can successfully call both endpoints in production
- [ ] The `NODE_ENV` guard is completely removed from both routes
- [ ] Unit tests cover the 403 path for both dev routes
- [ ] `npm test` passes with zero failures — results posted as a comment on this issue
- [ ] `docs/api/README.md` updated to document the superuser requirement for dev endpoints
```

---

## Issue 6

**Title:** `feat: multi-user programme and session generation`

**Labels:** `enhancement`, `multi-user-migration`, `phase-6`

**Body:**

```
## Overview

Ensure all programme wizard flows, session generation, and dev seeding correctly
attribute newly created data to the authenticated user. With RLS in place, this is
primarily ensuring inserts flow through the session-scoped client (which injects
`auth.uid()` automatically), and that no service function hardcodes a user ID.

## References

- Implementation Plan (Phase 6): docs/architecture/multi-user-migration-plan.md#phase-6--programme-wizard-and-session-logic-multi-user-readiness

## Depends on

Issue 3 (Phase 3 — RLS) and Issue 4 (Phase 4 — AI context scoping)

## Implementation Tasks

- [ ] Audit `src/services/training/programmeService.ts` — confirm all inserts use session client
- [ ] Audit `src/app/api/programme/confirm/route.ts` — confirm user attribution
- [ ] Audit `src/app/api/mesocycles/[id]/confirm-weekly/route.ts` — confirm user attribution
- [ ] Update `src/services/training/sessionGenerator.ts` — use session client for athlete context
- [ ] Update `src/services/training/programmeSeed.ts` — seed creates data for the requesting user

## Definition of Done

- [ ] Two users can independently run the programme wizard without data crossover
- [ ] Newly generated planned sessions are attributed to the correct user
- [ ] Dev seed creates data for the requesting user (not a hardcoded UUID)
- [ ] `programmeService.ts` unit tests updated with user attribution assertions
- [ ] `programmeSeed.ts` unit tests updated
- [ ] `npm test` passes with zero failures — results posted as a comment on this issue
- [ ] `docs/ux/03-programme-setup.md` updated if any UX flows changed
```

---

## Issue 7

**Title:** `chore: multi-user migration end-to-end validation and documentation finalisation`

**Labels:** `documentation`, `multi-user-migration`, `phase-7`

**Body:**

```
## Overview

Final validation pass for the complete multi-user migration. Run the full test suite,
complete a two-user end-to-end manual test, verify data integrity, and update all
documentation to reflect the multi-user state of the system.

## References

- Implementation Plan (Phase 7): docs/architecture/multi-user-migration-plan.md#phase-7--end-to-end-validation-and-documentation-finalisation
- Migration Runbook: docs/MIGRATION_RUNBOOK.md

## Depends on

All phases 1–6 complete

## Implementation Tasks

- [ ] Run full test suite: `npm test`
- [ ] Manual end-to-end test with two separate accounts (Google OAuth + magic link)
- [ ] Run post-migration verification queries from `docs/MIGRATION_RUNBOOK.md`
- [ ] Update ADR 001 status to reference ADR 005
- [ ] Update `docs/architecture/overview.md` to reflect multi-user model
- [ ] Update `docs/architecture/database.md` to reflect all schema changes
- [ ] Update `docs/api/README.md` to document auth requirements on all endpoints
- [ ] Update `README.md` with multi-user setup instructions

## Definition of Done

- [ ] Full test suite passes with zero failures — `npm test` results posted as a comment on this issue
- [ ] Two-user manual end-to-end test documented (screenshots or written summary posted as a comment)
- [ ] Zero rows with `user_id IS NULL` in any table (query results posted as a comment)
- [ ] All ADRs updated
- [ ] `docs/architecture/overview.md` fully reflects multi-user state
- [ ] `docs/architecture/database.md` fully reflects multi-user schema
- [ ] `docs/api/README.md` documents auth requirements on all endpoints
- [ ] `README.md` updated with multi-user setup
- [ ] `docs/MIGRATION_RUNBOOK.md` reviewed and confirmed accurate
```
