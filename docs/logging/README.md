# Logging Guide

This document explains how logging is currently implemented in the application, what data is included in log entries, what data is intentionally excluded, and where developers can access logs during development and after deployment.

## Overview

Structured logging is centralized in `src/lib/logger.ts`.

The logger exposes three public helpers:

- `logInfo()` for successful operations
- `logWarn()` for expected handled failures
- `logError()` for unexpected failures and catch blocks

All three helpers produce a structured object with stable snake_case fields before writing to the server console.

## Log shape

Each emitted log entry includes the following core fields:

- `timestamp`
- `level`
- `event`
- `user_id`
- `profile_role`
- `route`
- `entity_type`
- `entity_id`
- `outcome`
- `duration_ms`
- `request_id`
- `environment`
- `data`
- `error`

Routes and services do not need to populate every field. Unavailable values are written as `null`.

## Redaction and safe handling

The logger sanitizes metadata before writing it.

- Sensitive keys such as `token`, `authorization`, `cookie`, `password`, `prompt`, `content`, `chat_message`, and similar variants are replaced with `[REDACTED]`.
- Long strings are truncated.
- `Error` objects are serialized into a safe `{ name, message, stack }` shape.
- In production, error stacks are omitted.
- Additional operational metadata must go under `data` and should contain only safe values.

Because of that sanitization layer, the application can attach operational context such as counts, durations, dependency names, or entity identifiers without logging secrets or full payload content.

## Where logging is implemented

### Route boundary logging

API routes log at the route boundary and should include:

- `event`
- `outcome`
- `route`
- `userId` and `profileRole` when auth context is already available
- `entityType` and `entityId` when the route targets a specific resource
- `data` for safe operational context

Current route-level structured logging is implemented in these areas:

- auth callback and access-control routes
- privileged developer routes
- chat request handling

### Service-level logging

Services log internal operational failures when that information would be lost or too coarse at the route boundary.

Current service-level structured logging is implemented in these areas:

- auth and access-control checks
- Gemini chat and session-plan execution
- AI context dependency failures
- chat message persistence failures

## Current logging coverage

The current logging rollout covers these event categories:

- auth success and failure
- access-control denial and authorization check failure
- invite sending
- privileged developer actions
- chat request handling
- AI chat execution
- AI session plan generation
- AI context dependency degradation
- chat message persistence failures

## Where developers can access logs

### Local development

Server-side logs are written to the terminal running the Next.js app.

Typical access pattern:

```bash
npm run dev
```

Then trigger the relevant page load or API call and inspect the terminal output.

Important notes:

- API route logs do not appear in the browser console because the routes execute on the server.
- Service logs emitted by `src/services/` also appear in the same server terminal.
- Jest test runs can also surface logger output when a test exercises logging paths, although many tests mock the logger directly.

### Production and deployed environments

The app is deployed on Vercel, so server-side logs are available in the Vercel project logs for the deployed environment.

Developers should look in the Vercel dashboard for the runtime logs associated with the relevant request or function execution.

Use the structured fields to filter and inspect events:

- `event`
- `route`
- `outcome`
- `entity_type`
- `user_id`
- `timestamp`

If a request fails in production, the expected workflow is:

1. Identify the failing route.
2. Find the matching Vercel runtime log entry.
3. Filter by `route` and `event`.
4. Inspect `outcome`, `data`, and `error` for safe diagnostic context.

## What is not logged

The current implementation intentionally avoids logging:

- auth tokens
- cookies
- passwords
- AI prompts
- chat message bodies
- raw model responses
- other secret-bearing request payloads

This is especially important for the chat and AI flows, where request and response content may contain private or sensitive user information.

## Recommended debugging workflow

When investigating an issue:

1. Start with the route-level log entry for the failing request.
2. Check whether the failure is an expected handled path (`warn`) or an unexpected failure (`error`).
3. Follow related service-level log entries using matching route, event family, timestamps, and entity context.
4. Use structured fields in `data` to understand counts, durations, dependency failures, and execution path without needing raw payload content.

## Related files

- `src/lib/logger.ts`
- `docs/architecture/overview.md`
- `docs/api/README.md`
- `.github/copilot-instructions.md`