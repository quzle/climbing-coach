# Flow 04: Session Planning & Execution

## Overview

A user with a programme, active mesocycle, and weekly template set up. Planned session records for the full mesocycle are auto-created at the end of weekly setup (Flow 03). The programme page shows the next 7 days by default; the user can load all sessions for the full mesocycle. The AI session plan is generated lazily the first time the user previews a session, using the freshest available context at that moment.

**Preconditions:** active programme, active mesocycle, weekly templates defined, planned session records created (auto-triggered after weekly setup).

---

## Sequence diagram

```mermaid
sequenceDiagram
    actor User
    participant App
    participant API
    participant Supabase
    participant Gemini

    User->>App: Navigates to /programme
    App->>API: GET /api/programme
    API->>Supabase: Query active programme, active mesocycle, weekly templates, planned sessions (next 7 days)
    Supabase-->>API: Snapshot with upcoming planned sessions (no ai_plan_text yet)
    API-->>App: ProgrammeBuilderSnapshot
    App-->>User: Programme page: upcoming sessions card (7 days), "Load all sessions" button

    Note over User,App: Sessions have metadata (type, date, label, intensity) but no AI plan yet

    alt User previews the plan (lazy generation)
        User->>App: Taps "▸ Plan" on an upcoming session
        App->>API: POST /api/planned-sessions/{id}/generate-plan
        API->>Supabase: getPlannedSessionById, getMesocycleById, getWeeklyTemplateById
        API->>API: buildAthleteContext() — fetches today's readiness, recent sessions, injury areas
        Supabase-->>API: Full athlete context (current state, not state at scheduling time)
        API->>Gemini: generateSessionPlan(session_type, additionalContext)
        Note over API,Gemini: additionalContext: phase, slot intensity/focus, last same-type session, 7-day readiness avg
        Gemini-->>API: Formatted session plan (goal, warm-up, main set, cool-down, coach notes)
        API->>Supabase: UPDATE planned_sessions SET generated_plan.ai_plan_text = ...
        API-->>App: { ai_plan_text }
        App-->>User: Plan content expanded inline (markdown rendered)
        Note over User,App: Subsequent taps toggle collapse/expand — no second Gemini call
    end

    alt User loads all sessions
        User->>App: Taps "Load all sessions"
        App->>API: GET /api/planned-sessions?start_date=today&end_date=2099-12-31
        API->>Supabase: Query all planned sessions from today onwards
        Supabase-->>API: Full session list
        API-->>App: { plannedSessions[] }
        App-->>User: All sessions shown in scrollable card; "All sessions loaded" replaces button
    end

    User->>App: Taps "Start session" on a planned session
    App->>App: Navigate to /session/log?planned_session_id={id}
    App->>API: GET /api/planned-sessions/{id}
    API-->>App: PlannedSession { planned_date, session_type, generated_plan }

    App->>App: Extract prefill values:<br/>date ← planned_date<br/>session_type ← session_type<br/>duration_mins ← generated_plan.duration_mins<br/>notes ← generated_plan.ai_plan_text + primary_focus
    App-->>User: Session log form pre-filled; "Planned Session" info card shown at top

    User->>App: Reviews/adjusts plan, adds performance data (rpe, quality_rating, log_data), submits
    App->>API: POST /api/sessions { ..., planned_session_id }
    API->>Supabase: INSERT into session_logs
    API->>Supabase: UPDATE planned_sessions SET status = 'completed'
    Note over API: If logged duration deviates >20% from planned, a note is appended to session record
    API-->>App: { session } 201
    App-->>User: Session logged. Planned session marked complete.

    alt User skips a planned session
        User->>App: Taps "Skip" button (only shown when status = 'planned')
        App->>API: PUT /api/planned-sessions/{id} { status: 'skipped' }
        API->>Supabase: UPDATE planned_sessions
        API-->>App: { plannedSession } 200
        App->>API: GET /api/programme (refetch snapshot)
        App-->>User: Snapshot refreshed
    end
```

---

## Journey map

| Stage | User action | System response | Friction / gap |
|---|---|---|---|
| **View programme page** | Navigates to /programme | Next 7 days of planned sessions shown; each session has type, date, status, "▸ Plan", "Skip", and "Start session" | Sessions have metadata immediately (type, label, intensity) even before AI plan is generated. |
| **Preview a plan** | Taps "▸ Plan" on a session | One Gemini call made with fresh athlete context; plan rendered as markdown inline | First tap takes ~2–4 s (Gemini call). Spinner on button while generating. Subsequent taps are instant (cached). |
| **Load all sessions** | Taps "Load all sessions" | All planned sessions for the full mesocycle loaded into the scrollable card | "All sessions loaded" indicator replaces the button. Sessions without a plan show the "▸ Plan" button to trigger lazy generation. |
| **Skip a session** | Taps "Skip" | Session status updated to `skipped`; snapshot refreshed | No reschedule affordance — skipped sessions cannot be moved to another date. |
| **Start a session** | Taps "Start session" | Navigated to /session/log with plan pre-filled | Plan text injected into notes as a single block. Structured sections (warm-up / main set / cool-down) lose markdown formatting in the textarea. |
| **Log the session** | Adds performance data, submits | Session logged; planned session marked `completed` | No "I changed this significantly" flag. Duration deviation >20% appends a note but does not set `modified` status. |

---

## Gap summary

### Resolved
- ~~**Upfront bulk Gemini calls.**~~ AI session plans are now generated lazily on first access with the freshest available context. No Gemini calls at planning time.
- ~~**Wasted tokens for skipped sessions.**~~ Skipped sessions never trigger a Gemini call — plans are only generated for sessions the user actually previews or starts.
- ~~**Sequential thundering-herd generation.**~~ Session record creation (without AI) is fast and happens automatically after weekly setup. No long loading screen for AI.
- ~~**Generated plan content hidden until session start.**~~ "▸ Plan" toggle on each upcoming session card shows the AI plan inline. The plan is generated on first tap and cached for subsequent views.
- ~~**No skip affordance.**~~ A "Skip" button appears on any planned session with status `planned`.
- ~~**No way to see sessions beyond 7 days.**~~ "Load all sessions" fetches all planned sessions from today to the end of the mesocycle.

### Open
- **Session plan displayed as a text block in the log form.** The `ai_plan_text` is injected into the session notes field as plain text. Structured sections (goal, warm-up, main set, cool-down) lose their formatting in the textarea.
- **No reschedule affordance.** Skipped sessions cannot be moved to another date.
- **No way to regenerate a single session plan.** Once a plan is cached, there is no "regenerate" action. The user can clear `generated_plan.ai_plan_text` manually via the DB, but there is no in-app affordance.
- **No "next mesocycle" prompt.** When the active mesocycle ends, there is no prompt to set up the weekly schedule for the next block. The user must navigate to `/programme/[id]/setup-week` manually.
