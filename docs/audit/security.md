# Security Audit

**Date:** 2026-04-08

---

## What is working well

### Row Level Security (RLS)

All 10 user-owned tables have RLS enabled with consistent, correct policies:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY <table>_user_access_policy
  ON <table> FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Tables covered: `programmes`, `mesocycles`, `planned_sessions`, `session_logs`, `readiness_checkins`, `chat_messages`, `injury_areas`, `weekly_templates`, `profiles`, `chat_threads`.

The `WITH CHECK` clause is present on all policies, meaning RLS prevents unauthorised writes as well as reads. Integration tests verify cross-user data isolation with real Supabase Auth sessions (`src/test/integration/`).

### Authentication checks in API routes

Every protected API route calls `getCurrentUser()` as the first operation. Privileged routes call `requireSuperuser()`. The pattern is consistent across all ~20 route files. Server-side auth helpers (`src/lib/supabase/get-current-user.ts`) use `supabase.auth.getUser()`, which validates the JWT with Supabase rather than simply decoding it client-side.

### Two-client separation

| Client | Key used | Purpose | File |
|--------|----------|---------|------|
| Browser client | Anon key | UI data reads; always RLS-restricted | `src/lib/supabase/client.ts` |
| Server client | Service role key | API routes; explicit `user_id` filter always applied | `src/lib/supabase/server.ts` |

The service role key (`SUPABASE_SECRET_KEY`) is never in `NEXT_PUBLIC_*` variables and is not reachable from the browser. Auth routes (`/auth/callback`, `/auth/confirm`) correctly use the anon key for code/OTP exchange.

### Structured logging with sanitisation

`src/lib/logger.ts` redacts a comprehensive set of sensitive field names:

```
accesstoken, apikey, authorization, chatmessage, content, cookie,
messagebody, password, prompt, rawtext, refreshtoken, responsebody,
responsetext, secret, setcookie, token
```

Sanitisation is applied recursively to nested objects and arrays. Stack traces are suppressed in production. The error message returned to the browser is always generic; full errors are logged server-side only.

### Input validation

All API route handlers validate request bodies with Zod `safeParse()` before use. Invalid inputs return 400 without touching the database. Dynamic route segments (e.g. `/api/programmes/[id]`) are validated as UUIDs where applicable.

### Open redirect prevention

Both `/auth/callback` and `/auth/confirm` validate the `next` parameter:

```ts
const safeNext = next.startsWith('/') ? next : '/'
```

This prevents redirecting authenticated users to an external attacker-controlled URL.

### Dev route hardening

`/api/dev/*` routes return 404 in production:

```ts
if (process.env.NODE_ENV === 'production') {
  return NextResponse.json({ data: null, error: 'Not found.' }, { status: 404 })
}
```

All dev routes additionally require `requireSuperuser()`, providing a second gate even if `NODE_ENV` is unexpectedly misconfigured.

---

## Findings

### A1 (High) — No HTTP security headers

`next.config.ts` is empty. There are no `headers()` rules configured. The application is served without:

| Header | Risk without it |
|--------|----------------|
| `Content-Security-Policy` | XSS payloads can load arbitrary scripts |
| `X-Frame-Options` / `frame-ancestors` | Clickjacking attacks possible |
| `Strict-Transport-Security` | Protocol downgrade attacks on first load |
| `X-Content-Type-Options: nosniff` | MIME-sniffing attacks on uploaded content |
| `Referrer-Policy` | Auth tokens or sensitive paths may leak via Referer header |
| `Permissions-Policy` | Browser features (camera, microphone, etc.) unrestricted |

**Recommended fix:** Add a `headers()` function to `next.config.ts`. A starting point:

```ts
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ]
}
```

CSP requires more careful tuning given the app uses Supabase, Gemini, and inline styles from Tailwind/Radix.

---

### A3 (High) — Unvalidated `type` in `/auth/confirm`

**File:** `src/app/auth/confirm/route.ts:83`

```ts
const {
  data: { user },
  error,
} = await supabase.auth.verifyOtp({
  token_hash: tokenHash,
  type: type as 'invite' | 'recovery' | 'magiclink',
})
```

`type` is cast directly from the query string to the union type without an allowlist check. If an attacker crafts a URL with an unexpected `type` value, the OTP is still submitted to Supabase's `verifyOtp` (which may reject it), but the cast itself bypasses TypeScript's narrowing. More importantly, if a valid token exists, it will be consumed and the user ends up at the "unsupported type" redirect — which is a silent failure.

**Recommended fix:** Validate `type` against an allowlist before calling `verifyOtp`:

```ts
const VALID_TYPES = ['invite', 'recovery', 'magiclink'] as const
type ConfirmType = typeof VALID_TYPES[number]

function isValidConfirmType(t: string): t is ConfirmType {
  return (VALID_TYPES as readonly string[]).includes(t)
}

if (!isValidConfirmType(type)) {
  // log and redirect to login
}
```

---

### B3 (Medium) — No rate limiting

There is no rate limiting on any API route. Routes most at risk:

| Route | Risk |
|-------|------|
| `POST /api/invites` | Invite spam; each invite consumes a Supabase auth slot and sends email |
| `POST /api/chat` | AI cost amplification; each message triggers a Gemini API call |
| `POST /api/programme/generate` | AI cost amplification; generates a full programme via Gemini |
| `POST /api/planned-sessions/generate` | Same pattern |

Supabase itself rate-limits auth operations, but application-level routes are unrestricted.

**Options:**
- Vercel Edge middleware with IP-based rate limiting (e.g. using `@vercel/kv` or Upstash Redis)
- A simple per-user per-minute counter stored in a short-TTL Supabase table
- Vercel's built-in DDoS protection covers volumetric attacks but not application-level abuse

---

### B4 (Medium) — Unbounded AI context size

The context builder fetches the athlete's full programme history, recent sessions, and readiness check-ins before every Gemini call. As the dataset grows, this increases both latency and token consumption with no cap.

There is no guard that checks the estimated token count before submitting the context to Gemini. The Gemini `maxOutputTokens: 1024` limit only bounds the response, not the input.

**Recommended:** Add a configurable limit on how many sessions/check-ins are fetched (e.g. last 30 days), and consider a lightweight token estimation step before the API call.

---

### B5 (Medium) — Superuser role is application-managed, not Supabase Auth claim

`requireSuperuser()` reads the `profiles.role` column to check for `superuser`. This role is not embedded in the Supabase JWT as a custom claim. This means:

1. A compromised service-role key could escalate any user to superuser by updating `profiles.role` directly.
2. The role check always requires a DB round-trip (profile lookup), which cannot be short-circuited by RLS alone.

This is an acceptable design choice for an MVP, but it means the entire privilege model relies on application-layer checks rather than cryptographic JWT claims.

**Recommended (longer term):** Embed `role` as a custom Supabase Auth claim using a database trigger on `profiles` updates, then read it from `auth.jwt()` in both RLS policies and server-side code.

---

### C1 (Low) — Non-standard environment variable naming

`.env.example` uses `SUPABASE_SECRET_KEY` for the service role key. Supabase's own documentation and CLI tooling use `SUPABASE_SERVICE_ROLE_KEY`. This mismatch could cause confusion when a new developer follows Supabase docs and cannot find the environment variable.

---

### C6 (Low) — No log transport abstraction

`logger.ts` writes directly to `console.info/warn/error`. This works on Vercel, which captures stdout as structured logs. However, there is no transport interface, so changing the log destination (e.g. to a log aggregation service like Datadog or Axiom) would require touching every call site.

This is low risk for the current deployment target but is worth noting as the app scales.
