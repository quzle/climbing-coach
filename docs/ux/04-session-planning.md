# Flow 04: Weekly Session Planning

## Overview

A user who has a programme, active mesocycle, and weekly template set up, and wants to generate planned sessions for the coming week. The AI uses the weekly template (session types, intensity, duration) and the current athlete context (readiness trend, recent load, programme phase) to produce a detailed session plan for each scheduled day. The user then executes those plans by tapping "Start session" from the programme page.

**Preconditions:** active programme, active mesocycle with status `active`, at least one weekly template slot defined for the mesocycle.

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
    Supabase-->>API: Snapshot with weekly template slots, no planned sessions yet
    API-->>App: ProgrammeBuilderSnapshot
    App-->>User: Programme page: weekly structure visible, "Generate Week Sessions" button (disabled if no template slots), upcoming sessions card empty

    alt No weekly template slots exist
        Note over User,App: Button is disabled. Message shown:<br/>"Add weekly template slots below before generating sessions."<br/>User must define template slots first (see Flow 03).
    end

    User->>App: Taps "Generate Week Sessions" (enabled — template slots exist)
    App->>API: POST /api/planned-sessions/generate { week_start? }
    Note over API: week_start defaults to current Monday if omitted

    API->>Supabase: getActiveMesocycle()
    Supabase-->>API: Active mesocycle
    API->>Supabase: getWeeklyTemplateByMesocycle(mesocycle.id)
    Supabase-->>API: Template slots (e.g. Mon: bouldering, Wed: fingerboard, Fri: strength)

    loop For each template slot
        API->>API: buildAthleteContext() — fetches readiness, sessions, programme, injury areas
        API->>Supabase: getTodaysCheckin, getRecentSessions, getAverageReadiness, getActiveInjuryAreas, ...
        Supabase-->>API: Full athlete context
        API->>API: buildSystemPrompt(context) — assembles prompt with warnings, phase, injury rules
        API->>Gemini: generateSessionPlan(session_type, additionalContext)
        Note over API,Gemini: additionalContext includes phase focus, slot intensity, primary_focus from template
        Gemini-->>API: Formatted session plan (goal, warm-up, main set, cool-down, coach notes)
        API->>Supabase: INSERT into planned_sessions { mesocycle_id, template_id, planned_date, session_type, generated_plan, status: 'planned' }
        Supabase-->>API: PlannedSession row
    end

    API-->>App: { plannedSessions: PlannedSession[] }
    App->>API: GET /api/programme (refetch snapshot)
    API-->>App: Updated snapshot with planned sessions in upcoming card
    App-->>User: "Upcoming Sessions" card populated with this week's sessions

    Note over User,App: User can now execute any planned session

    User->>App: Taps "Start session" on a planned session
    App->>App: Navigate to /session/log?planned_session_id={id}
    App->>API: GET /api/planned-sessions/{id}
    API->>Supabase: Query planned_sessions by id
    Supabase-->>API: PlannedSession { planned_date, session_type, generated_plan: { session_label, primary_focus, duration_mins, ai_plan_text } }
    API-->>App: { plannedSession }

    App->>App: Extract prefill values from generated_plan:<br/>date ← planned_date<br/>session_type ← session_type<br/>duration_mins ← generated_plan.duration_mins<br/>notes ← generated_plan.ai_plan_text + primary_focus
    App-->>User: Session log form pre-filled with plan details and a "Planned Session" info card at top

    User->>App: Reviews plan, adjusts as needed, adds performance data (rpe, quality_rating, log_data), submits
    App->>API: POST /api/sessions { ..., planned_session_id }
    API->>Supabase: INSERT into session_logs
    API->>Supabase: UPDATE planned_sessions SET status = 'completed' WHERE id = planned_session_id
    Note over API: If logged duration deviates >20% from planned, a note is appended to session record
    Supabase-->>API: SessionLog row
    API-->>App: { session } 201
    App-->>User: Session logged. Planned session marked complete in upcoming card.

    alt User previews the plan before starting
        User->>App: Taps "▸ Plan" toggle on an upcoming session
        App-->>User: Plan content expanded inline (ai_plan_text from generated_plan)
        User->>App: Taps "▾ Plan" to collapse
    end

    alt User skips a planned session
        User->>App: Taps "Skip" button (only shown when status = 'planned')
        App->>API: PUT /api/planned-sessions/{id} { status: 'skipped' }
        API->>Supabase: UPDATE planned_sessions
        Supabase-->>API: Updated PlannedSession
        API-->>App: { plannedSession } 200
        App->>API: GET /api/programme (refetch)
        App-->>User: Session removed from upcoming list
    end

    alt User wants to regenerate sessions
        Note over User,App: Tapping "Generate Week Sessions" again is safe — the service<br/>deduplicates by date+template_id and skips slots that already have a session.<br/>Only slots without an existing planned session are regenerated.
    end
```

---

## Journey map

| Stage | User action | System response | Friction / gap |
|---|---|---|---|
| **View programme page** | Navigates to /programme | Snapshot loaded; weekly template visible; "Generate Week Sessions" button — disabled with message if no template slots | ~~Button had no guard~~ — resolved. Button is now disabled with explanatory message when no template slots exist. |
| **Generate sessions** | Taps "Generate Week Sessions" | API calls Gemini once per template slot; sessions created and appear in upcoming card | Generation can take several seconds (one Gemini call per slot, sequential). No visible progress indicator — the button shows "Generating sessions..." but the page otherwise appears static. |
| **Review generated sessions** | Sees upcoming sessions list | Each session shown with date, type, status badge, "▸ Plan" toggle, "Skip" button, and "Start session" button | ~~Plan content hidden until session start~~ — resolved. "▸ Plan" toggle shows the full `ai_plan_text` inline without committing to start the session. |
| **Skip a session** | Taps "Skip" button | Session status updated to 'skipped'; removed from upcoming list after snapshot refetch | ~~No skip affordance~~ — resolved. Skip button is shown for any session with status 'planned'. No reschedule affordance — skipped sessions cannot be moved to another date. |
| **Start a session** | Taps "Start session" | Navigated to /session/log with plan pre-filled | Pre-fill injects plan text into the notes field as a single block. The structured sections (warm-up / main set / cool-down) lose their formatting in the text area. |
| **Log the session** | Adds performance data alongside pre-filled content | Session logged; planned session marked completed | No way to flag "I changed this significantly". Duration deviation >20% appends a note, but no "modified" status is set. |
| **Session complete** | Returns to home or programme page | Session shown in last-session card on home; planned session marked completed | No session debrief prompt. The link between "session done" and "ask the coach about it" is not made explicitly. |

---

## Gap summary

### Resolved
- ~~**No guard against generating when no template exists.**~~ "Generate Week Sessions" is now disabled when `currentWeeklyTemplate.length === 0`, with an explanatory message: "Add weekly template slots below before generating sessions."
- ~~**No deduplication on regeneration.**~~ `sessionGenerator.ts` already deduplicates by `date:template_id` key — confirmed during audit. Pressing "Generate Week Sessions" again is safe and only creates sessions for slots that don't already have one.
- ~~**Generated plan content is hidden until session start.**~~ A "▸ Plan" toggle on each upcoming session card shows the `ai_plan_text` inline without navigating away.
- ~~**No skip affordance.**~~ A "Skip" button now appears on any planned session with status `'planned'`. Tapping it sets status to `'skipped'` and refreshes the snapshot.

### Open
- **Session plan displayed as a text block.** The `ai_plan_text` is injected into the session log notes field as plain text. The structured sections (goal, warm-up, main set, cool-down, coach notes) lose their formatting in the textarea.
- **No reschedule affordance.** Skipped sessions cannot be moved to another date. There is no "move to tomorrow" or "reschedule" action.
- **No way to regenerate a single session.** If one day's plan is inappropriate, the user must skip it and manually log a different session. There is no "regenerate this session" action.
- **Sequential Gemini calls, no progress feedback.** For a 5-day training week, generation makes 5 sequential Gemini calls. The button label changes to "Generating sessions..." but no per-slot progress is shown.
