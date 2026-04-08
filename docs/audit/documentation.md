# Documentation Audit

**Date:** 2026-04-08

---

## Inventory

| Document | Location | Status |
|----------|----------|--------|
| Architecture overview | `docs/architecture/overview.md` | Partially stale (pre-multi-user) |
| Database schema | `docs/architecture/database.md` | Partially stale (pre-multi-user) |
| Multi-user migration plan | `docs/architecture/multi-user-migration-plan.md` | Still accurate as a plan; should be marked complete |
| ADR 001: Monolith | `docs/architecture/decisions/` | Current |
| ADR 002: Gemini | `docs/architecture/decisions/` | Current |
| ADR 004: Injury areas | `docs/architecture/decisions/` | Current |
| ADR 005: Multi-user data model | `docs/architecture/decisions/` | Current |
| API route inventory | `docs/api/` | Unknown — not reviewed in detail |
| UX flows | `docs/ux/` | Present |
| Copilot instructions | `.github/copilot-instructions.md` | Up to date |
| AI context docs | `docs/ai-context/` | Present |
| Logging guide | `docs/logging/` | Present |
| Services README | `src/services/README.md` | Present |
| README | `README.md` | Present |
| CONTRIBUTING guide | — | Missing |
| Onboarding / local setup | — | Missing |

---

## What is working well

### Copilot instructions

`.github/copilot-instructions.md` is one of the stronger artefacts in the project. It encodes:

- Supabase client selection rules (which key to use where, and why)
- Serverless constraints (no global state, no persistent connections)
- TypeScript rules (strict mode, no `any`, explicit return types, Zod at boundaries)
- Testing rules (unit tests alongside implementation, integration tests for routes, RLS tests required)
- API route logging pattern
- Error handling conventions
- Naming conventions for migrations

This document reduces the review burden significantly and makes conventions self-documenting.

### Architecture Decision Records

ADRs 001, 002, 004, and 005 are present and readable. They follow a consistent format with context, decision, and consequences. The technology choices (monolith, Gemini, Supabase) are reasoned, not arbitrary.

### Inline JSDoc

Key functions in `src/lib/supabase/get-current-user.ts`, `src/lib/logger.ts`, and the auth routes have JSDoc comments that explain *why* decisions were made (e.g. why anon key is used in the auth callback, why `requireSuperuser()` throws rather than returns a boolean). This is the right level of commenting.

### Services README

`src/services/README.md` explains the directory structure and when to add a new service. This helps onboarding.

---

## Findings

### B6 (Medium) — Architecture docs are partially stale

`docs/architecture/overview.md` and `docs/architecture/database.md` were written before the multi-user migration. Sections that need updating:

**`overview.md`:**
- The "security model" section likely describes single-user assumptions
- The request lifecycle section may not mention the middleware auth gate
- RLS is not discussed in the context of the two-client model

**`database.md`:**
- The schema tables section needs to be verified against the current migration state — `chat_threads`, the `user_id` columns, and the RLS policies are all additions from the multi-user work
- The "migration workflow" section should mention that migrations must be applied to *both* the production and integration Supabase projects

**Recommended:** Do a pass on both documents against the current codebase. The multi-user migration plan (`multi-user-migration-plan.md`) can serve as a reference for what changed.

---

### C4 (Low) — No CONTRIBUTING guide or onboarding documentation

There is no document explaining how to:

1. Set up a local development environment (install deps, configure `.env.local`, initialise the local Supabase instance or point to the integration project)
2. Create the first superuser account
3. Run unit tests and integration tests
4. Apply a schema migration to both Supabase projects
5. Regenerate TypeScript types after a migration

This information exists in fragments (copilot instructions, `.env.example`, migration comments) but is not assembled into a single getting-started document.

The current team likely has this knowledge implicitly, but it represents a bus-factor risk and will slow down any new contributor.

**Recommended:** A `CONTRIBUTING.md` at the root with the following sections:

- Prerequisites
- Local setup (clone, install, env vars, Supabase project)
- Running the app
- Running tests (unit and integration)
- Making a schema change (migration + type regen + dual-project apply)
- Conventions (link to copilot instructions)

---

### Low — `multi-user-migration-plan.md` should be archived or marked complete

The migration plan document reads as an in-progress plan. Now that the migration is merged, it should either be:

- Updated with a "Status: Complete" header and the completion date, or
- Moved to `docs/architecture/decisions/` as a retrospective ADR

Leaving it as-is will cause confusion for future readers who cannot tell whether the plan was executed.

---

### Low — Missing ADR: application-layer role management

The decision to store `superuser` role in `profiles.role` (rather than as a Supabase Auth custom JWT claim) is a meaningful architectural choice with trade-offs (see architecture audit). It should be documented as an ADR so future contributors understand why the role check requires a DB round-trip.

---

### Low — Logging guide (`docs/logging/`) not reviewed

This directory is present but was not reviewed as part of this audit. Verify that it reflects the current `LoggerInput` schema in `src/lib/logger.ts` (particularly the `entityType`/`entityId` fields and the full `SENSITIVE_KEY_NAMES` set).
