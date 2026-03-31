# Services Layer

This document is the primary reference for AI assistants and developers working in `src/services/`.

## Rule

**API routes must not contain business logic or direct database queries. They call service functions only.**

If you find logic in an API route that is not input validation or response formatting, move it to a service.

## Structure

### `services/ai/`

AI coaching intelligence. All Gemini API calls originate here.

| File | Responsibility |
|---|---|
| `geminiClient.ts` | Gemini API wrapper — initialises the client, handles the raw API call, exposes a typed `chat()` function |
| `promptBuilder.ts` | Assembles the system prompt from static sections and dynamic context |
| `contextBuilder.ts` | Fetches and formats athlete context from Supabase (programme state, sessions, readiness, chat history) |
| `sessionGenerator.ts` | Generates planned sessions using Gemini (Phase 2) |
| `deviationDetector.ts` | Compares planned vs actual sessions and flags deviations (Phase 2) |

### `services/data/`

Database access layer. All Supabase queries live here. No business logic.

| File | Responsibility |
|---|---|
| `readinessRepository.ts` | All queries against `readiness_checkins` |
| `sessionRepository.ts` | All queries against `session_logs` |
| `programmeRepository.ts` | All queries against `programmes`, `mesocycles`, `weekly_templates`, `planned_sessions` (Phase 2) |

### `services/training/`

Climbing-specific domain logic. Pure functions where possible.

| File | Responsibility |
|---|---|
| `loadCalculator.ts` | Calculates finger load score and weekly volume from session logs (Phase 2) |
| `periodisation.ts` | Block logic: deload detection, mesocycle progression rules (Phase 2) |
| `progressionRules.ts` | Determines when intensity should increase based on recent performance (Phase 2) |

### `services/auth/`

Authentication lifecycle orchestration. Business logic that runs around auth events.

| File | Responsibility |
|---|---|
| `authLifecycleService.ts` | Finalizes invited-user profile lifecycle after auth callback sign-in |

## Testing

- Every function in `services/` must have a unit test.
- Tests live alongside their source file: `geminiClient.test.ts` next to `geminiClient.ts`.
- **Never call real APIs in tests.** Mock `@supabase/supabase-js` and `@google/generative-ai` using Jest mocks.
- Import from `@/lib/test-utils` rather than directly from `@testing-library/react` to pick up any global test providers.

## Adding a New Service Function

1. Identify the correct layer: data access → `services/data/`, business logic → `services/ai/`, `services/training/`, or `services/auth/`
2. Export a named function with an explicit return type
3. Write the unit test alongside the file
4. Add a thin API route in `src/app/api/` that calls the function — do not put logic in the route
