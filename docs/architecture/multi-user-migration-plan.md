# Multi-User Migration Plan

**Status:** Approved for implementation  
**ADR:** [ADR 005 — Multi-User Migration Strategy](decisions/005-multi-user-migration.md)  
**Last updated:** 2026-03-30

---

## Overview

This document is the canonical implementation roadmap for migrating the Climbing Coach application from single-user to multi-user. Each phase is independently deployable; later phases depend on earlier ones completing successfully.

**Guiding principles:**
1. No user-visible regression at any phase boundary
2. Existing data is preserved and attributed correctly before RLS is enforced
3. Each phase is covered by unit tests before merge
4. Documentation is updated as part of each phase (not as a post-step)

---

## Phase 1 — Authentication Foundation

**Goal:** Users can sign in and sign out. The app knows who is making each request. No data is yet user-scoped.

**GitHub Issue:** `feat: authentication foundation (Supabase Auth + session middleware)`

### Steps

1. Configure Supabase Auth in the Supabase dashboard
   - Enable Email magic link provider
   - Enable Google OAuth provider
   - Configure redirect URL: `<APP_URL>/auth/callback`

2. Create `src/app/auth/login/page.tsx`
   - Show magic link email form + Google OAuth button
   - Redirect to `/` on successful sign-in

3. Create `src/app/auth/callback/route.ts`
   - Handle Supabase Auth code exchange
   - Redirect to `/` on success, `/auth/login?error=...` on failure

4. Update `src/middleware.ts`
   - Refresh Supabase Auth session on every request
   - Redirect unauthenticated users to `/auth/login`
   - Exclude `/auth/login` and `/auth/callback` from the redirect

5. Update `src/lib/supabase/server.ts`
   - Accept user session cookies so that API routes can call `supabase.auth.getUser()`
   - Provide a helper `getAuthenticatedUser()` that returns the user or throws `401`

6. Update `src/app/layout.tsx`
   - Add sign-out link / user avatar in navigation for authenticated users

7. Update `src/components/layout/Navigation.tsx`
   - Show display name and sign-out button when authenticated

### Definition of Done

- [ ] Unauthenticated requests to any page redirect to `/auth/login`
- [ ] Magic link email flow works end-to-end in Supabase Auth
- [ ] Google OAuth flow works end-to-end
- [ ] Authenticated user's email is displayed in navigation
- [ ] Sign-out clears the session and redirects to `/auth/login`
- [ ] `getAuthenticatedUser()` returns the correct user in all API routes
- [ ] All new auth pages are mobile-first with 44px minimum interactive element height
- [ ] Unit tests added/updated for middleware and auth helpers
- [ ] Unit tests pass (`npm test`)
- [ ] Test results documented as a comment on the GitHub issue
- [ ] `docs/ux/README.md` updated to reference the login/auth flow
- [ ] `docs/architecture/overview.md` updated with auth session model

---

## Phase 2 — Profiles Table and User Data Attribution

**Goal:** Every user has a profile row. Existing single-user data is attributed to the owner account.

**GitHub Issue:** `feat: profiles table and data attribution migration`

### Steps

1. Create Supabase migration: `supabase/migrations/001_add_profiles_table.sql`
   - Create `profiles` table (see ADR 005 for schema)
   - Add trigger `handle_new_user()` to auto-create a profile on `auth.users` insert
   - Add `is_superuser boolean not null default false` column

2. Create Supabase migration: `supabase/migrations/002_add_user_id_columns.sql`
   - Add nullable `user_id uuid references auth.users(id) on delete cascade` to:
     `programmes`, `mesocycles`, `weekly_templates`, `planned_sessions`,
     `readiness_checkins`, `session_logs`, `chat_messages`, `injury_areas`
   - Columns are nullable at this stage to allow existing rows to coexist

3. Create Supabase migration: `supabase/migrations/003_migrate_existing_data.sql`
   - `UPDATE <table> SET user_id = '<owner_uuid>'` for all existing rows
   - This must be run after the owner signs in (so their UUID exists in `auth.users`)
   - Document the required variable substitution in the migration file header

4. Create `src/services/data/profileRepository.ts`
   - `getProfile(userId)` — fetch profile by user ID
   - `updateProfile(userId, data)` — update display name and athlete profile fields
   - `upsertProfile(userId, data)` — upsert (used by the trigger fallback)

5. Create API routes for profiles:
   - `GET /api/profile` — returns authenticated user's profile
   - `PUT /api/profile` — updates authenticated user's profile

6. Create `src/app/profile/page.tsx`
   - Form to edit display name and athlete profile fields
   - Uses existing React Hook Form + Zod resolver pattern

7. Update `src/lib/database.types.ts`
   - Regenerate from Supabase (after migrations are applied)

### Definition of Done

- [ ] `profiles` table created in Supabase with auto-create trigger
- [ ] All data tables have a nullable `user_id` column
- [ ] Migration script documented and tested in development
- [ ] Existing rows attributed to owner's UUID in development environment
- [ ] `profileRepository.ts` unit tests pass covering get, update, upsert
- [ ] `GET /api/profile` returns the authenticated user's profile
- [ ] `PUT /api/profile` updates profile fields correctly
- [ ] Profile page renders and submits correctly on mobile
- [ ] Unit tests added/updated for profileRepository and API routes
- [ ] Unit tests pass (`npm test`)
- [ ] Test results documented as a comment on the GitHub issue
- [ ] `docs/architecture/database.md` updated with `profiles` table schema
- [ ] `docs/api/README.md` updated with `/api/profile` endpoints

---

## Phase 3 — Row Level Security

**Goal:** The database enforces per-user data isolation. No query can return another user's rows.

**GitHub Issue:** `feat: enable RLS on all data tables`

**Depends on:** Phase 2 complete (all rows attributed before RLS is enabled)

### Steps

1. Create Supabase migration: `supabase/migrations/004_enable_rls.sql`
   - Make `user_id` NOT NULL on all tables (all rows must be attributed first)
   - Enable RLS on all tables
   - Create `all_access_own_rows` policy on each table:
     ```sql
     create policy "Users can only access their own rows"
       on <table> for all
       using (auth.uid() = user_id)
       with check (auth.uid() = user_id);
     ```

2. Update `src/lib/supabase/server.ts`
   - Remove service role key for standard operations
   - Replace with session-scoped client that uses the user's JWT
   - Retain a separate `createAdminClient()` export for superuser/dev operations

3. Update all repositories in `src/services/data/`
   - Remove all implicit `user_id` filtering from queries (RLS handles it automatically)
   - Ensure all calls use the session-scoped client, not the admin client

4. Update all API routes in `src/app/api/`
   - Call `getAuthenticatedUser()` at the top of each handler
   - Pass the user's Supabase client to the service/repository layer

### Definition of Done

- [ ] RLS migration applied successfully in development
- [ ] A user cannot read or write another user's data (verified by test that creates two accounts)
- [ ] All existing queries return identical results after RLS is enabled (regression test)
- [ ] `createAdminClient()` is used only in dev/superuser routes
- [ ] All API routes return 401 when the session is expired or missing
- [ ] Integration tests cover the 401 paths for all API routes
- [ ] Unit tests pass (`npm test`)
- [ ] Test results documented as a comment on the GitHub issue
- [ ] `docs/architecture/overview.md` updated to describe the new client model
- [ ] `docs/architecture/database.md` updated with RLS policy details

---

## Phase 4 — AI Context Scoped to Current User

**Goal:** The AI coach builds context exclusively from the authenticated user's data. Chat messages are persisted per user.

**GitHub Issue:** `feat: scope AI context and chat history to authenticated user`

**Depends on:** Phase 3 complete (RLS ensures correct scoping)

### Steps

1. Update `src/services/ai/contextBuilder.ts`
   - All repository calls receive the user-scoped Supabase client
   - No explicit `user_id` filtering needed in query logic (RLS handles it)
   - Confirm `buildAthleteContext()` signature passes the client through

2. Update `src/app/api/chat/route.ts`
   - Call `getAuthenticatedUser()` and pass session client to `sendChatMessage()`

3. Update `src/app/api/chat/history/route.ts`
   - Fetch chat history filtered by session client (RLS scopes automatically)

4. Update `src/services/data/` repositories that support chat:
   - `chatRepository.ts` (new): `getChatHistory(limit)`, `saveChatMessage(role, content)`

5. Verify that coach warnings are computed from the current user's data only

### Definition of Done

- [ ] Two users can have independent chat conversations simultaneously
- [ ] Each user's chat history is isolated (user A cannot see user B's messages)
- [ ] AI coaching context reflects only the authenticated user's sessions, readiness, and programme
- [ ] `chatRepository.ts` unit tests pass
- [ ] `contextBuilder.ts` tests updated to verify user-scoped queries
- [ ] Unit tests pass (`npm test`)
- [ ] Test results documented as a comment on the GitHub issue
- [ ] `docs/ai-context/coaching-system-prompt.md` updated to document per-user context model

---

## Phase 5 — Dev / Superuser Access Replatform

**Goal:** Dev tools are accessible to superusers in all environments. The `NODE_ENV` guard is replaced with an `is_superuser` check.

**GitHub Issue:** `feat: superuser access control for dev endpoints`

**Depends on:** Phase 2 complete (profiles table with `is_superuser` column)

### Steps

1. Create `src/lib/auth/requireSuperuser.ts`
   - Fetch the authenticated user's profile
   - Return `403` if `is_superuser !== true`

2. Update `src/app/api/dev/seed-programme/route.ts`
   - Replace `if (NODE_ENV === 'production') return 404` with `requireSuperuser()`

3. Update `src/app/api/dev/clear-all/route.ts`
   - Same replacement as above
   - Use `createAdminClient()` (service role key) for truncate operations — cannot use RLS client

4. Create `src/app/dev/page.tsx` (or update existing)
   - Protected by `requireSuperuser()`
   - Links to seed and clear endpoints with confirmation dialogs

5. Create a helper to set `is_superuser = true` for the owner account
   - Document this as a one-time manual step in the migration runbook

### Definition of Done

- [ ] `/api/dev/seed-programme` returns 403 for non-superusers
- [ ] `/api/dev/clear-all` returns 403 for non-superusers
- [ ] A superuser account can successfully call both endpoints in production
- [ ] The `NODE_ENV` guard is completely removed from both routes
- [ ] Unit tests updated for both dev routes covering the 403 path
- [ ] Unit tests pass (`npm test`)
- [ ] Test results documented as a comment on the GitHub issue
- [ ] `docs/api/README.md` updated to document the superuser requirement

---

## Phase 6 — Programme Wizard and Session Logic Multi-User Readiness

**Goal:** All programme and session generation flows correctly attribute newly created data to the authenticated user.

**GitHub Issue:** `feat: multi-user programme and session generation`

**Depends on:** Phase 3 (RLS) and Phase 4 (scoped context)

### Steps

1. Update `src/services/training/programmeService.ts`
   - All `createProgramme`, `createMesocycle`, etc. calls set `user_id` on insert
   - Use session-scoped client (RLS enforces user_id automatically via `auth.uid()`)

2. Update `src/app/api/programme/confirm/route.ts`
   - Ensure programme creation includes user attribution

3. Update `src/app/api/mesocycles/[id]/confirm-weekly/route.ts`
   - Ensure weekly template and planned session creation includes user attribution

4. Update `src/services/training/sessionGenerator.ts`
   - Athlete context is built from the session client (scoped to current user)

5. Update `src/services/data/programmeSeed.ts`
   - Dev seed creates data attributed to the requesting superuser's `user_id`

### Definition of Done

- [ ] Two users can independently run the programme wizard without data crossover
- [ ] Newly generated planned sessions are attributed to the correct user
- [ ] Dev seed creates data for the requesting user (not a hardcoded UUID)
- [ ] `programmeService.ts` unit tests updated and passing
- [ ] `programmeSeed.ts` unit tests updated and passing
- [ ] Unit tests pass (`npm test`)
- [ ] Test results documented as a comment on the GitHub issue
- [ ] `docs/ux/03-programme-setup.md` updated if UX flows changed

---

## Phase 7 — End-to-End Validation and Documentation Finalisation

**Goal:** All phases are validated together. All documentation reflects the multi-user state of the system.

**GitHub Issue:** `chore: multi-user migration end-to-end validation and docs finalisation`

**Depends on:** All phases 1–6 complete

### Steps

1. Run the full test suite in CI (`npm test`)

2. Manual end-to-end test with two separate accounts:
   - Create two users (Google OAuth + magic link)
   - Each runs the programme wizard independently
   - Each logs sessions, readiness, and chats with the coach
   - Verify zero data crossover

3. Run a database query to confirm no orphaned rows (`user_id IS NULL`)

4. Archive single-user architecture notes in existing ADRs:
   - Update ADR 001 status to reference ADR 005
   - Update `docs/architecture/overview.md` to reflect multi-user model
   - Update `docs/architecture/database.md` to reflect all schema changes
   - Update `docs/api/README.md` to reflect auth requirements on all endpoints

5. Update README.md:
   - Replace single-user setup instructions with multi-user setup
   - Document Supabase Auth provider configuration steps
   - Document the owner data migration step

6. Create a `MIGRATION_RUNBOOK.md` in `/docs/` documenting:
   - Step-by-step instructions to migrate from single-user to multi-user
   - How to run each Supabase migration in order
   - The owner data attribution step
   - Verification queries to run post-migration

### Definition of Done

- [ ] Full test suite passes with zero failures (`npm test`)
- [ ] Two-user manual end-to-end test completed and documented
- [ ] No rows with `user_id IS NULL` in any table
- [ ] All ADRs updated to reflect multi-user status
- [ ] `docs/architecture/overview.md` fully updated
- [ ] `docs/architecture/database.md` fully updated
- [ ] `docs/api/README.md` fully updated with auth requirements
- [ ] `README.md` updated with multi-user setup instructions
- [ ] `MIGRATION_RUNBOOK.md` created and reviewed
- [ ] Test results documented as a comment on the GitHub issue

---

## Dependency Graph

```
Phase 1 (Auth Foundation)
    │
    ▼
Phase 2 (Profiles + Data Attribution)
    │
    ├──► Phase 5 (Superuser Dev Access)  [depends on Phase 2 only]
    │
    ▼
Phase 3 (Row Level Security)
    │
    ├──► Phase 4 (AI Context Scoping)   [depends on Phase 3]
    │
    └──► Phase 6 (Programme Generation) [depends on Phase 3 + Phase 4]
              │
              ▼
         Phase 7 (E2E Validation + Docs) [depends on all phases]
```

## Estimated Effort

| Phase | Complexity | Key Risk |
|---|---|---|
| Phase 1 | Medium | Auth callback URL configuration in Supabase |
| Phase 2 | Medium | Trigger auto-creation of profiles |
| Phase 3 | High | All repositories must use session client; regression risk |
| Phase 4 | Low | Context builder already parameterised |
| Phase 5 | Low | Simple guard function |
| Phase 6 | Medium | Programme service creates many related rows |
| Phase 7 | Low | Documentation and validation only |

## Rollback Plan

Each phase can be independently rolled back before the next phase begins:

- **Phase 1:** Disable auth middleware; revert to open access
- **Phase 2:** Columns are nullable; existing rows unaffected; drop columns if needed
- **Phase 3:** Drop RLS policies; set `user_id` back to nullable
- **Phases 4–6:** Code-only changes; revert individual commits
- **Phase 7:** Documentation changes only; no rollback needed

**Critical point of no return:** Once Phase 3 is deployed and the migration script in Phase 2 has been run, rolling back requires disabling RLS and is not recommended. Take a full Supabase database backup before Phase 3.
