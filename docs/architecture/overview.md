# System Architecture Overview

This document describes the technical architecture of the Climbing Coach application for developers and AI assistants working in this codebase.

## Request Lifecycle

A typical API request flows through these layers in order:

```
Browser (React component)
  → fetch('/api/...')
  → API route (src/app/api/...)
      validates input with Zod
      calls a service function
  → Service (src/services/...)
      orchestrates business logic
      calls repository or AI client
  → Repository (src/services/data/...)
      executes Supabase query
      returns typed data
  → Supabase Postgres
      single source of truth
  ← Response flows back up the chain
```

No layer may skip a level. API routes do not query the database directly. Services do not call `fetch()` to `/api/` routes.

## Why Modular Monolith

This application is a single-developer, single-user personal tool. The primary architectural constraint is **maintenance burden** — every additional service boundary, deployment unit, or inter-service contract is overhead that slows development.

A modular monolith gives:
- Logical separation enforced through folder structure and code review
- A single deployment unit — one Vercel project, one Supabase project
- Simple debugging — one log stream, one process (per request)
- Clear upgrade path — the services layer can be extracted into separate processes later if needed without rewriting the domain logic

See [ADR 001](decisions/001-monolith-over-microservices.md) for the full decision record.

## Serverless Constraint

Vercel deploys API routes (`src/app/api/`) as serverless functions. This has important implications:

- **No persistent memory between requests.** Every invocation starts with a fresh process.
- **All state lives in Supabase.** Nothing is stored in module-level variables or in-memory caches.
- **AI context is rebuilt on every request.** The prompt builder fetches the athlete's current programme state, recent sessions, and today's readiness from Supabase before every Gemini call.
- **Chat history is stored in Supabase.** The `chat_messages` table is the source of truth for conversation history. The last N messages are fetched and injected into the prompt.

Concretely: if a user sends two chat messages in quick succession, each hits a separate serverless function invocation. There is no shared memory between them.

## Two Supabase Clients

Two Supabase client factories exist in `src/lib/supabase/`:

| File | Key used | Where it runs | RLS |
|---|---|---|---|
| `client.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser (Client Components) | Enforced |
| `server.ts` | `SUPABASE_SECRET_KEY` | Server only (API routes, Server Components) | Bypassed |

**Rules:**
- `client.ts` is safe to use in Client Components. It uses the anon key which is intentionally public.
- `server.ts` must **never** be imported from a file that runs in the browser. It uses the service role key which bypasses Row Level Security and has full database access.
- API routes always use `server.ts`.
- Client Components that need to read data call API routes — they do not query Supabase directly using `server.ts`.

## Layered Architecture

Each layer has a single responsibility. Violating these boundaries is the most common source of bugs and test difficulties.

| Layer | Location | Responsibility |
|---|---|---|
| Pages | `src/app/**/page.tsx` | Render UI, fetch data from API routes |
| API Routes | `src/app/api/**` | Validate input with Zod, call one service function, return response |
| Services | `src/services/` | Business logic, orchestration across repositories and AI client |
| Repositories | `src/services/data/` | Database queries only — no logic |
| Database | Supabase Postgres | Persistent state, single source of truth |

**Key rules:**
- API routes must be thin. If an API route has branching logic, it belongs in a service.
- Repositories return raw data. Transformation happens in services.
- Services are pure functions where possible — easier to unit test.

## Security Model

| Secret | Location | Rule |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Server-side only | Never referenced in any file that runs in the browser. Never in a `NEXT_PUBLIC_` variable. |
| `GEMINI_API_KEY` | Server-side only | Never referenced in any file that runs in the browser. |
| `NEXT_PUBLIC_SUPABASE_URL` | Intentionally public | Supabase project URL — not sensitive |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Intentionally public | Anon key — restricted by RLS |

**RLS policy:** Row Level Security is enabled on all Supabase tables. The anon key (used in the browser) is blocked from accessing data unless a specific RLS policy permits it. This is a safety net — the primary access control is using the server client for all data operations.

No secret must ever appear in a `NEXT_PUBLIC_` prefixed environment variable. The `NEXT_PUBLIC_` prefix causes Next.js to bundle the value into the client-side JavaScript bundle.

## Deployment

The application deploys automatically to Vercel on every push to `main`.

- **Build command:** `next build` (Vercel default)
- **Environment variables:** must be configured in the Vercel project dashboard — copy from `.env.local`
- **Database:** Supabase is not managed by Vercel. Schema migrations must be run manually against the Supabase project. See `database.md` for the schema.
- **No preview environments** — single-user app, `main` → production.
