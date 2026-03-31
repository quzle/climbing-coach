# GitHub Copilot Instructions

This file is automatically read by GitHub Copilot. Follow these conventions precisely when generating or editing code in this repository.

---

## Project Overview

Next.js 14 App Router, TypeScript strict mode, single-user AI-powered climbing training assistant. Stack: Supabase Postgres, Google Gemini 2.5 Pro, shadcn/ui (Radix), Recharts, Zod, React Hook Form, Jest, React Testing Library.

See `docs/architecture/overview.md` for full architecture documentation.

---

## Database Rules

- **All schema changes must go through a migration file** in `supabase/migrations/`. Never alter the remote database directly via the Supabase dashboard or any other means.
- **`src/lib/database.types.ts` must never be edited manually.** It is generated exclusively by running:
  ```
  supabase gen types typescript --project-id <project-id> 2>/dev/null > src/lib/database.types.ts
  ```
  Redirect stderr to `/dev/null` to prevent the Supabase CLI update notice from being appended to the file. Run this command immediately after every `supabase db push`.
- The correct sequence for any schema change is:
  1. Write a new migration file in `supabase/migrations/`
  2. Run `supabase db push` to apply it to the remote database
  3. Regenerate `database.types.ts` via the CLI command above
  4. Fix any downstream TypeScript errors caused by the updated types
- If `database.types.ts` contains fields that application code has intentionally removed (e.g. after an ADR cutover), that means the migration to drop those columns has not been applied yet — write and push the migration rather than adjusting the types or working around them.

---

## Architecture Rules

- **API routes are thin.** Validate input with Zod, call one service function, return a response. No business logic, no direct database calls.
- **All Supabase queries live in `src/services/data/` only.** Never query Supabase from a component or API route directly.
- **All Gemini API calls live in `src/services/ai/` only.**
- **Training logic lives in `src/services/training/` only.**
- No layer may skip a level. Components call API routes. API routes call services. Services call repositories.

---

## TypeScript Rules

- Strict mode is enabled. Respect all strict checks — do not disable them with `// @ts-ignore` or `// @ts-expect-error`.
- **Never use `any`.** Use `unknown` and narrow with type guards.
- All exported functions must have explicit return types.
- Use Zod for all external data validation (API inputs, Supabase responses at boundaries).
- Prefer `type` over `interface` for object shapes.
- Use discriminated unions for variants (session types, phase types, result types, etc.).

---

## Naming Conventions

| Category | Convention | Example |
|---|---|---|
| Files | kebab-case | `session-log-form.tsx` |
| Components | PascalCase | `SessionLogForm` |
| Functions | camelCase | `createSession` |
| Types | PascalCase | `SessionLog` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_ATTEMPTS` |
| Database columns | snake_case | matches Supabase schema |
| CSS | Tailwind utility classes only | no custom CSS unless unavoidable |

---

## Component Rules

- **Mobile-first.** Write base (mobile) Tailwind classes first, then `md:` and `lg:` overrides.
- **44px minimum height** on all interactive elements (buttons, links, inputs).
- All forms use **React Hook Form** with a **Zod resolver** (`@hookform/resolvers/zod`). Never manage form state with `useState`.
- Import shadcn components from `@/components/ui/` only. Never import directly from `@radix-ui/*`.
- **Never edit `src/components/ui/` files.** They are shadcn-managed and will be overwritten on updates. Run `npx shadcn@latest add [component]` to add or update.

---

## Testing Rules

- **Always write tests alongside implementation.** Tests are part of the same unit of work — never commit code without tests.
- Every service function needs a unit test.
- Every API route needs an integration test.
- Every form component needs a component test.
- Every custom hook needs a unit test.
- Test files sit alongside their source file: `foo.ts` → `foo.test.ts`.
- Import `render` from `@/lib/test-utils`, not directly from `@testing-library/react`.
- Import `renderHook` and `act` directly from `@testing-library/react` (not test-utils).
- **Always mock Supabase and Gemini. Never call real APIs in tests.**
- Mock `localStorage` using an in-memory store + `Object.defineProperty(window, 'localStorage', { value: mock })` — see `useDraftSession.test.ts` for the pattern.
- Test name format:
  ```ts
  describe('functionName', () => {
    it('does X when Y condition', () => { ... })
  })
  ```
- End every implementation session with a `git add . && git commit -m "..."` command using Conventional Commits format.

---

## Documentation Rules

- When adding or modifying an API route, update `docs/api/README.md` to reflect the change.
- When a page or user-facing flow changes, update the relevant file in `docs/ux/`.
- Every exported function needs JSDoc:
  ```ts
  /**
   * @description What this function does
   * @param paramName Description of the parameter
   * @returns Description of the return value
   * @throws Description of errors this may throw
   */
  ```
- Inline comments explain **why**, not what. The code explains what.
- New architecture decisions → create an ADR in `docs/architecture/decisions/` following the existing format.

---

## Error Handling

- API routes return a consistent shape:
  ```ts
  { data: T | null, error: string | null }
  ```
- **Never expose raw error messages or stack traces to the browser.** Log the full error server-side; return a safe generic message to the client.
- API routes must use the structured logger from `src/lib/logger.ts` instead of ad-hoc `console.error` or `console.warn`.

## API Route Logging

- API routes log with `logInfo()`, `logWarn()`, and `logError()` from `@/lib/logger`.
- Every route log must include `event`, `outcome`, and `route`.
- Include `userId` and `profileRole` whenever the route already resolved auth context.
- Include `entityType` and `entityId` whenever the route is operating on a specific resource.
- Put extra operational context under `data` as a plain object with safe, non-sensitive values only.
- Never log tokens, cookies, passwords, prompts, chat message bodies, raw model responses, or other secrets.
- `logInfo()` is for successful route completion.
- `logWarn()` is for expected failure paths such as validation failures, denied access, or service/repository errors that are handled without throwing.
- `logError()` is for unexpected exceptions, catch blocks, and unexpected states.
- Route logs should stay at the route boundary. Repositories and services can log their own concerns, but routes should not duplicate lower-level logs unless they are adding route-specific context.

Preferred route pattern:

```ts
import { logError, logInfo, logWarn } from '@/lib/logger'

export async function GET(): Promise<NextResponse<ApiResponse<ResourceResponse>>> {
  try {
    const result = await getResource()

    if (result.error !== null || result.data === null) {
      logWarn({
        event: 'resource_fetch_failed',
        outcome: 'failure',
        route: '/api/resource',
        entityType: 'resource',
        error: result.error,
      })

      return NextResponse.json(
        { data: null, error: 'Failed to fetch resource.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'resource_fetched',
      outcome: 'success',
      route: '/api/resource',
      entityType: 'resource',
      entityId: result.data.id,
    })

    return NextResponse.json({ data: result.data, error: null }, { status: 200 })
  } catch (error) {
    logError({
      event: 'resource_fetch_failed',
      outcome: 'failure',
      route: '/api/resource',
      entityType: 'resource',
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to fetch resource.' },
      { status: 500 },
    )
  }
}
```

---

## Sub-Agent Usage (Context Management)

To keep the main agent's context window efficient, **always delegate the following task types to a sub-agent** using the `Explore` agent via `runSubagent`. The main agent must not perform these tasks directly.

### Always use a sub-agent for:

**1. Context-intensive research and data reading**
Any task that requires reading many files, traversing large directory trees, or aggregating information from across the codebase before the main agent can act. Examples:
- "What does the current session log flow look like end-to-end?"
- "Find all places that reference `ReadinessCheckin`"
- Gathering an inventory of files before starting a large feature

**2. Code review and audits**
Checking existing code against the standards in this file (architecture rules, naming, TypeScript rules, testing rules, etc.). The sub-agent reads and evaluates; the main agent acts on the findings. Examples:
- "Review `src/services/` for architecture violations"
- "Check all API routes return the correct `{ data, error }` shape"
- "Audit components for missing `min-h-[44px]` on interactive elements"

**3. Reading debug output and logs**
When debugging, the main agent should fix code. A sub-agent should read and interpret terminal output, error logs, stack traces, or test failure output. The sub-agent returns a diagnosis; the main agent applies the fix. Examples:
- Interpreting a wall of Jest failure output
- Reading a Vercel build log to find the root cause
- Analysing a TypeScript error cascade

### How to invoke
Use the `Explore` agent. Specify thoroughness (`quick`, `medium`, or `thorough`) and exactly what to return:
```
runSubagent('Explore', 'Read src/services/ai/ and return: all exported function signatures, whether each has JSDoc, and any direct Supabase imports that violate architecture rules. Thoroughness: medium.')
```

The sub-agent's result is passed back to the main agent as a single message. The main agent then acts on it — it does **not** re-read the same files.

---

## Git Commits (Conventional Commits)

| Prefix | Use for |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `style:` | Formatting, no logic change |
| `refactor:` | Restructure, no behaviour change |
| `test:` | Adding or updating tests |
| `chore:` | Dependencies, config, build |

Format: `type: short description in present tense`

```
feat: add readiness check-in API route
test: add unit tests for readiness repository
fix: handle null session date in log form
```
