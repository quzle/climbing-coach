# Multi-User MVP Migration Plan

## Overview

This document tracks the step-by-step migration of Climbing Coach from a single-user application to a multi-user application. Each step corresponds to one GitHub issue and one SQL migration file.

The architectural decisions behind this plan are documented in [ADR 005](decisions/005-multi-user-mvp-architecture.md).

---

## Migration Steps

| Step | Issue | Migration File | Status | Description |
|---|---|---|---|---|
| DB-1 | #DB-1 | `20260330000000_create_profiles_table.sql` | ✅ Done | Create `profiles` table linked to `auth.users` |
| DB-2 | — | — | ⬜ Pending | Add `user_id` to `session_logs`, `readiness_checkins`, `chat_messages` |
| DB-3 | — | — | ⬜ Pending | Add `user_id` to `programmes`, `mesocycles`, `weekly_templates`, `planned_sessions`, `injury_areas` |
| DB-4 | — | — | ⬜ Pending | Enable RLS on all tables; add `user_id`-scoped policies |
| DB-5 | — | — | ⬜ Pending | Seed `user_id` on existing rows (single-user data migration) |
| AUTH-1 | — | — | ⬜ Pending | Add Supabase Auth sign-up / sign-in UI and session handling |
| AUTH-2 | — | — | ⬜ Pending | Wire `user_id` into all repository queries |

---

## How to Apply Migrations

Migrations are plain SQL files under `supabase/migrations/`. They must be applied in filename order.

**Via Supabase CLI (recommended for local dev):**

```bash
supabase db push
```

**Via Supabase Dashboard SQL Editor (production / staging):**

Open each migration file and execute it in the SQL Editor in order.

---

## Rollback Notes

Each migration file should include a commented-out rollback block. Example:

```sql
-- Rollback:
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists public.handle_new_user();
-- drop table if exists public.profiles;
```

---

## Data Integrity Notes

- Until DB-5 is applied, existing rows in data tables have no `user_id`. The application continues to function as single-user during this window.
- DB-4 (RLS) must not be enabled until DB-2, DB-3, and DB-5 are complete, otherwise existing data becomes inaccessible.
