# UX Flow Documentation

Descriptive documents of the application's current user-facing flows. Each file contains a Mermaid sequence diagram (the technical flow) and a journey map table (the human experience layer, including friction points and gaps).

These documents describe the app **as it is built today**, not as it should be designed. Their purpose is to make current flows explicit so that gaps are visible when planning UX improvements and new features.

## Addressed gaps

The following gaps from the initial audit have been resolved in code:

| Gap | Fix |
|---|---|
| Developer copy ("Phase 2C is now live") in programme empty state | Replaced with user-facing copy in `programme/page.tsx` |
| No "today" view on home page | Added today's planned session card and active warnings to `page.tsx`; `GET /api/readiness` now returns `warnings[]` |
| Generate sessions button had no guard when no template exists | Button disabled + explanatory message added in `programme-builder-editor.tsx` |
| Generated plan content hidden until session starts | Expandable plan preview added to upcoming sessions list in `programme/page.tsx` |
| No skip affordance for planned sessions | Skip button added to upcoming sessions list in `programme/page.tsx` |
| Invisible dependency chain for programme setup | "Getting started" step indicator card added to `programme/page.tsx` |
| Warnings transient (only shown on submission) | Warnings now returned by `GET /api/readiness` and shown persistently on home page |

Gaps that were found to be already implemented: deduplication on session regeneration (`sessionGenerator.ts`), injury area autocomplete (`InjuryAreaSelector.tsx`), inline add-area flow in readiness form.

## User testing

| File | Purpose |
|---|---|
| [user-testing-journey.md](./user-testing-journey.md) | End-to-end user journey for testing sessions — observation prompts and feedback capture tables for each stage, from account activation through to daily training habit. |

## Technical flows

| File | Flow | Key question answered |
|---|---|---|
| [00-account-creation.md](./00-account-creation.md) | Account creation | How does a new user get invited and activate their account? |
| [01-first-time-setup.md](./01-first-time-setup.md) | First-time setup | What does a brand new user experience with no data? |
| [02-daily-training-loop.md](./02-daily-training-loop.md) | Daily training loop | How does a returning user get through a training day? |
| [03-programme-setup.md](./03-programme-setup.md) | Programme & mesocycle setup | How does a user build a structured training programme? |
| [04-session-planning.md](./04-session-planning.md) | Weekly session planning | How do planned sessions get created and used? |
| [05-injury-management.md](./05-injury-management.md) | Injury management | How does an injury area flow from profile through to coaching? |

## How to read these documents

Each file is structured as:

1. **Overview** — one paragraph describing the flow and its preconditions
2. **Sequence diagram** — actors are `User`, `App` (pages/components), `API` (route handlers), `Supabase`, and `Gemini` where relevant. Shows requests, responses, conditional branches, and dead ends.
3. **Journey map** — the same flow staged as the user experiences it. Columns: stage, user action, system response, friction / gap.
4. **Gap summary** — specific issues surfaced by mapping the journey.

## Maintenance

When a page or user-facing flow changes, update the relevant file in `docs/ux/`. If a new significant flow is added (e.g. a Phase 3 dashboard feature), create a new numbered file and add it to the table above.
