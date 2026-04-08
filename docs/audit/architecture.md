# Architecture Audit

**Date:** 2026-04-08

---

## What is working well

### Layered architecture

The application follows a consistent three-layer model:

```
API Route (src/app/api/)
  └── Service (src/services/)
        └── Repository (src/services/data/)
              └── Supabase client
```

API routes are thin: auth check → Zod parse → service call → log → respond. Business logic lives in services. Database access is in repository functions. This makes the codebase easy to test at each layer and prevents logic from accumulating in routes.

### Consistent API response shape

All routes return `{ data: T | null, error: string | null }`. The error string is always a safe, human-readable message — never a raw DB error or stack trace. This makes client-side handling uniform and prevents information leakage.

### TypeScript configuration

`tsconfig.json` enables strict mode with additional guards:

- `noUncheckedIndexedAccess` — array indexing returns `T | undefined`
- `noImplicitReturns` — all code paths must return
- `noFallthroughCasesInSwitch` — switch exhaustiveness
- `strict: true` — covers `strictNullChecks`, `noImplicitAny`, etc.

This catches an entire class of runtime errors at compile time.

### Serverless-safe design

No global state, no persistent in-memory caches, no singleton DB connections. Each request rebuilds what it needs (Supabase client, auth context, AI context). This is the correct pattern for Next.js on Vercel where cold starts are the norm.

### Multi-user isolation

The multi-user migration (`feat/multi-user-mvp-migration`) is well-executed:

- `user_id NOT NULL` enforced at DB level on all domain tables
- `user_id` indexed on all domain tables for query performance
- RLS policies applied at the Postgres layer (not just the application layer)
- Integration tests verify cross-user isolation with real JWT sessions
- Server client always filters by `user_id` from the authenticated session (never trusts client-submitted user IDs)

---

## Findings

### A2 (High) — No CI/CD pipeline

There are no GitHub Actions workflows. There is no automated step that:

- Runs `npm run test` on pull request
- Runs `npm run lint` or `npm run build` to catch type errors
- Guards against merging broken code

All quality checks are manual. The integration test suite in particular (which verifies RLS and auth) is only run when a developer explicitly runs `npm run test:integration`.

**Recommended:** Add a minimal GitHub Actions workflow:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

Integration tests require a Supabase project and are harder to run in CI, but the unit/lint/build gate should be automated immediately.

---

### A2b (High) — Schema migrations are manual with no safeguards

The documented workflow requires manually running `supabase db push` against both the production and integration Supabase projects. There is no CI step that:

- Validates that migrations are syntactically correct before merge
- Reminds engineers to apply to both projects
- Checks that generated types (`database.types.ts`) are in sync with the current schema

A schema migration applied to production but not integration (or vice versa) will cause integration tests to pass against a schema that differs from production.

**Recommended:** Add a `supabase db diff` check in CI that fails if there are unapplied migrations. Supabase CLI supports this natively.

---

### B1 (Medium) — `chat_threads` excluded from `clear-all`

**File:** `src/app/api/dev/clear-all/route.ts:21–31`

`chat_threads` is not in `DELETE_ORDER`. Clearing all data deletes `chat_messages` (which references `thread_id`) but leaves orphaned rows in `chat_threads`. In a dev environment this causes visual noise (empty threads appear in the UI) and accumulated garbage in the test database.

**Fix:** Add `'chat_threads'` to `DELETE_ORDER` after `'chat_messages'`:

```ts
const DELETE_ORDER = [
  'session_logs',
  'planned_sessions',
  'weekly_templates',
  'mesocycles',
  'programmes',
  'readiness_checkins',
  'chat_messages',
  'chat_threads',   // <-- add this
  'injury_areas',
] as const
```

---

### B5 (Medium) — `next.config.ts` is effectively empty

```ts
const nextConfig: NextConfig = {
  /* config options here */
}
```

Several useful options are absent:

| Option | Why it matters |
|--------|---------------|
| `reactStrictMode: true` | Catches side effects and deprecated patterns in development |
| `images.remotePatterns` | Locks down which domains can serve optimised images |
| `headers()` | (See security audit A1) |
| `async redirects()` | Canonical redirects (e.g. `/` → `/dashboard`) are currently in middleware |

This is not a breaking issue but leaves configuration risk on the table.

---

### B2 (Medium) — No database seed for fresh development setup

There is no idiomatic `supabase/seed.sql` file. The dev routes (`/api/dev/seed-programme`, `/api/dev/seed-targets`) require the developer to already have:

1. A valid Supabase user account created via the invite flow
2. The `superuser` role set manually on their profile row

New contributors must complete a manual bootstrapping process that is not documented. A `seed.sql` run by `supabase db reset` that creates a seed superuser would make local setup reproducible.

---

### C3 (Low) — Coverage threshold not enforced

`package.json` defines a `test:coverage` script but no coverage thresholds are configured in `jest.config.js`. Coverage reports are generated but passing CI without any coverage is impossible to distinguish from failing with 0% coverage.

**Fix:** Add thresholds to `jest.config.js`:

```js
coverageThreshold: {
  global: {
    branches: 70,
    functions: 80,
    lines: 80,
    statements: 80,
  },
},
```

---

### C5 (Low) — Partially implemented features with no tracking

Several API routes exist without corresponding UI:

- `GET/POST /api/weekly-templates` and `PATCH /api/weekly-templates/[id]`
- `POST /api/planned-sessions/[id]/generate-plan`
- `POST /api/mesocycles/[id]/confirm-weekly`
- `POST /api/mesocycles/[id]/generate-weekly`

These appear to be infrastructure for a session-planning wizard that is not yet user-facing. There is no explicit tracking of in-progress features (no TODO comments, no GitHub issues referenced in the code, no ADR documenting the planned completion state).

This is not a problem for the current state, but may cause confusion for contributors who find implemented routes without visible entry points.

---

## Architecture decisions reviewed

The existing ADRs cover the key decisions well (monolith vs microservices, Gemini over OpenAI, injury area tracking, multi-user data model). One decision that lacks an ADR:

**Missing ADR: Application-layer role management vs. Supabase custom claims**

The `superuser` role is stored in `profiles.role` and checked by `requireSuperuser()`. This was a deliberate MVP choice but the trade-offs (DB round-trip, no JWT claim, service-role bypass risk) are not documented. An ADR would make the reasoning durable for future contributors.
