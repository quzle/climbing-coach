# UX Flow Documentation

Descriptive documents of the application's current user-facing flows. Each file contains a Mermaid sequence diagram (the technical flow) and a journey map table (the human experience layer, including friction points and gaps).

These documents describe the app **as it is built today**, not as it should be designed. Their purpose is to make current flows explicit so that gaps are visible when planning UX improvements and new features.

## Flows

| File | Flow | Key question answered |
|---|---|---|
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
