# GitHub Copilot Instructions

This file is automatically read by GitHub Copilot. Follow these conventions precisely when generating or editing code in this repository.

---

## Project Overview

Next.js 14 App Router, TypeScript strict mode, single-user AI-powered climbing training assistant. Stack: Supabase Postgres, Google Gemini 2.5 Pro, shadcn/ui (Radix), Recharts, Zod, React Hook Form, Jest, React Testing Library.

See `docs/architecture/overview.md` for full architecture documentation.

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
- Log errors server-side with enough context to reproduce: function name, input values, original error.

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
