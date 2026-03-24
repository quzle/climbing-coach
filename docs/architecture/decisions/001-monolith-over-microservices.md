# ADR 001: Modular Monolith Over Microservices

## Status

Accepted

## Date

2026-03-24

## Context

This is a single-developer, single-user personal training tool. The application has one user (the author) and is not expected to serve multiple tenants or scale horizontally.

Key constraints:
- One developer — no team available to own separate services
- One user — no scale requirements that justify service isolation
- Personal project — maintenance burden is a first-class concern
- Vercel + Supabase already provide managed infrastructure; additional service deployments would add DevOps complexity with no benefit

Microservices would introduce:
- Network latency between services
- Distributed tracing and debugging complexity
- Multiple deployment pipelines
- Inter-service authentication
- Independent versioning — all for a project with one user

## Decision

Build a **modular monolith** with clear internal layer separation enforced by folder structure and code conventions.

The `src/services/` layer enforces logical separation between concerns (AI, data access, training logic) without requiring physical service boundaries. Each module has a defined responsibility and public interface.

## Consequences

**Positive:**
- Single deployment unit — one Vercel project, one `next build`
- Trivial to debug — one log stream, sequential call stack
- Low cognitive overhead — no service discovery, no inter-service contracts
- Easy to refactor — moving code between layers is a file move, not a deployment change

**Negative:**
- All logic shares the same runtime — a memory leak in one area affects all
- Cannot scale individual concerns independently (not a concern for single-user)

**Upgrade path:** If the application ever needs to serve multiple users or extract a compute-heavy service (e.g. a training plan generator), the services layer provides a clean extraction boundary. The domain logic does not need to be rewritten — only the transport layer changes.
