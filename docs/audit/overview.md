# Codebase Audit: Overview

**Date:** 2026-04-08
**Branch audited:** `feat/multi-user-mvp-migration`
**Scope:** Architecture, security, and documentation practices

---

## Summary

This is a well-engineered Next.js application with a strong overall posture. The multi-user migration work is sound, RLS coverage is comprehensive, and the layered architecture is followed consistently. The audit identifies a small number of concrete gaps — primarily around missing HTTP security headers, absent CI/CD automation, a handful of input validation gaps, and some documentation that has fallen behind the current implementation state.

### Ratings by dimension

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Architecture | Good | Clean layering, consistent patterns, good separation of concerns |
| Security | Good | RLS coverage complete, auth checks consistent; missing HTTP headers is the main gap |
| Testing | Good | Unit + integration tests present; RLS tests verify data isolation |
| Documentation | Fair | Existing docs are high quality but some are stale or missing |
| CI/CD | Poor | No automated pipeline; all deployments and migrations are manual |

---

## Top findings (prioritised)

### Critical / High

| # | Area | Finding |
|---|------|---------|
| A1 | Security | No HTTP security headers configured (`Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, etc.). `next.config.ts` is effectively empty. |
| A2 | CI/CD | No CI pipeline. Tests are never run automatically on push or PR. Schema migrations must be manually applied to both Supabase projects with no guard rails. |
| A3 | Security | `type` parameter in `/auth/confirm` is cast directly to a union type without allowlist validation. An unexpected value passes the type guard and falls through to the "unsupported type" path, but the OTP has already been verified by then. |

### Medium

| # | Area | Finding |
|---|------|---------|
| B1 | Architecture | `chat_threads` table is missing from the `DELETE_ORDER` in `/api/dev/clear-all`. Orphaned thread records will accumulate in the dev environment. |
| B2 | Architecture | The `profiles` table is excluded from `DELETE_ORDER` in `clear-all`, which is intentional, but is not documented. If test users are cleaned up at the Supabase Auth level, orphaned profile rows may remain. |
| B3 | Security | Rate limiting is entirely absent. The `/api/invites`, `/api/chat`, and `/api/programme/generate` routes have no per-user or per-IP throttling. Invite spam and AI cost amplification attacks are possible. |
| B4 | Security | The AI context builder fetches the full programme tree on every chat message. There is no budget cap or token-count guard before the Gemini call. A user with a large programme history could drive significant latency or cost. |
| B5 | Architecture | `next.config.ts` has no configuration at all. The serverless/edge runtime is entirely implicit. Missing: `images.domains`, `experimental.serverActions`, output mode, `reactStrictMode: true`. |
| B6 | Documentation | `docs/architecture/overview.md` and `docs/architecture/database.md` pre-date the multi-user migration and still describe single-user patterns in some sections. |

### Low / Improvement

| # | Area | Finding |
|---|------|---------|
| C1 | Security | Supabase service role key is named `SUPABASE_SECRET_KEY` in `.env.example`. This deviates from the Supabase convention (`SUPABASE_SERVICE_ROLE_KEY`) and could cause confusion for new contributors. |
| C2 | Architecture | There is no database seed script for a fresh development environment. The `seed-programme` dev route depends on a superuser account already existing. New developers must manually create their first user via the invite flow. |
| C3 | Testing | `test:coverage` script does not set a minimum coverage threshold. The coverage report is generated but never enforced. |
| C4 | Documentation | No `CONTRIBUTING.md` or onboarding guide exists. The copilot instructions capture conventions well but are not human-friendly as a contributor guide. |
| C5 | Architecture | The `weekly_templates` feature and `planned_sessions` feature appear partially implemented; several routes exist but there is no corresponding UI. This is fine for an MVP but should be tracked. |
| C6 | Security | Logging emits structured objects directly to `console.info/warn/error`. In Vercel, this works. If the runtime ever changes, there is no log transport abstraction — all logs would need updating. |

---

## Detailed reports

See the companion files in this directory:

- [`security.md`](./security.md) — full security findings with line references
- [`architecture.md`](./architecture.md) — architecture patterns review
- [`documentation.md`](./documentation.md) — documentation coverage and gaps
