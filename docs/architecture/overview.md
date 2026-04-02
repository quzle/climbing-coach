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

This application is a single-developer tool now migrating to an invite-only multi-user MVP. The primary architectural constraint is **maintenance burden** — every additional service boundary, deployment unit, or inter-service contract is overhead that slows development.

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

## Server Auth Helpers

`src/lib/supabase/get-current-user.ts` exports the canonical `getCurrentUser()` and `requireSuperuser()` functions for server-side identity and role checks:

```ts
import { getCurrentUser, requireSuperuser } from '@/lib/supabase/get-current-user'

// Inside an API route or Server Component:
const user = await getCurrentUser() // throws UnauthenticatedError if no valid session
// user.id — the Supabase Auth UUID
// user.email — the user's email address (may be undefined)

await requireSuperuser() // throws UnauthenticatedError, ForbiddenError, or AuthorizationCheckError
```

**Rules:**
- All API routes that require authentication must call `getCurrentUser()` to identify the user. Never use a hardcoded user ID.
- `getCurrentUser()` throws `UnauthenticatedError` if there is no valid session. API routes should delegate to the shared route auth handler and return a `401` response.
- Routes that execute privileged actions (for example under `/api/dev`) must call `requireSuperuser()` before performing the action.
- `requireSuperuser()` validates `profiles.role === 'superuser'` server-side and throws `ForbiddenError` for non-superusers.
- `AuthorizationCheckError` means the server could not verify authorization safely; routes should let that fall through to their normal `500` path.
- Never call `getCurrentUser()` from a Client Component. Call it in an API route or Server Component only.

## Middleware and Route Gating

`src/proxy.ts` runs on every request that is not a static asset. It:

1. Refreshes the user's Supabase session by calling `supabase.auth.getUser()`.
2. Redirects any unauthenticated request to `/auth/login` (307) unless the path starts with `/auth/`.

**Public routes** (accessible without a valid session):
- `/auth/login` — sign-in page
- `/auth/callback` — auth code exchange
- `/auth/confirm` — OTP verification for invite, recovery, and magic link flows

All other routes — including `/`, `/api/**`, `/chat`, `/dev`, `/history`, `/profile`, `/programme/**`, `/readiness`, and `/session/**` — require an authenticated session.

The proxy uses the anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) and **not** the service role secret. This is intentional: the anon key is safe for Edge/proxy because session validation only reads the JWT from cookies.

## Auth Entry Flow

Authentication entry points for invited users live under `src/app/auth/`:

- `GET /auth/login`: email/password sign-in page backed by Supabase Auth client sign-in.
- `GET /auth/login`: email-only magic-link sign-in page backed by `supabase.auth.signInWithOtp({ email })`.
- `GET /auth/callback`: exchanges Supabase auth codes for a cookie-backed session, finalizes the user's `profiles` row (`invite_status: active`, `role: user`), then redirects to a validated local `next` path (or `/`).
- `GET /auth/confirm`: verifies Supabase OTP tokens for invite, magic-link, and recovery flows, then redirects to a validated local `next` path (or `/`).

Client components that need identity or profile metadata read it from a shared auth provider mounted in the root layout. The provider is seeded server-side using `getCurrentUser()` plus `getProfile()` and exposes `id`, `email`, `displayName`, `role`, and `inviteStatus` to the navigation and account settings UI.

The callback route validates `next` to local paths only (`/something`) to prevent open redirect attacks.

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

**RLS policy:** Row Level Security is enabled on all user-owned domain tables, `profiles`, and `chat_threads`. The anon key (used in the browser) is blocked from accessing data unless a specific RLS policy permits it. This is a safety net — the primary access control is using the server client for all data operations.

No secret must ever appear in a `NEXT_PUBLIC_` prefixed environment variable. The `NEXT_PUBLIC_` prefix causes Next.js to bundle the value into the client-side JavaScript bundle.

## Structured Logging

Structured operational logging is centralized in `src/lib/logger.ts`.

- Use `createStructuredLog()` when a caller needs the sanitized payload without emitting it yet.
- Use `logInfo()`, `logWarn()`, and `logError()` to emit structured logs with stable snake_case fields.
- Standard fields align with ADR 005: `event`, `user_id`, `profile_role`, `route`, `entity_type`, `entity_id`, `outcome`, `duration_ms`, `request_id`, and `environment`.
- Additional metadata belongs under `data` and is sanitized before logging.
- Sensitive values such as tokens, cookies, passwords, prompts, chat message bodies, and raw response text must never be logged.
- Auth and access-control logging currently covers login success/failure, superuser access denial, invite sending, and privileged dev action execution.
- API routes log at the route boundary with `event`, `outcome`, and `route` on every entry, plus `userId`, `profileRole`, `entityType`, `entityId`, and safe `data` when available.
- Route handlers use `logInfo()` for successful completions, `logWarn()` for expected handled failures, and `logError()` for unexpected exceptions.
- AI and chat logging covers route handling, Gemini execution, context dependency failures, and message persistence failures using safe metadata such as duration, model identifier, message length, history count, warning count, session type, and dependency names only.

## Deployment

The application deploys automatically to Vercel on every push to `main`.

- **Build command:** `next build` (Vercel default)
- **Environment variables:** must be configured in the Vercel project dashboard — copy from `.env.local`
- **Database:** Supabase is not managed by Vercel. Schema migrations must be run manually against the Supabase project. See `database.md` for the schema.
- **No preview environments** — single-user app, `main` → production.
