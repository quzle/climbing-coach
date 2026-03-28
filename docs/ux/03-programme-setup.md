# Flow 03: Programme & Mesocycle Setup

## Overview

A user who wants to set up a structured training programme. This flow covers creating the macrocycle (programme), defining training blocks within it (mesocycles), and building the weekly session template for the active mesocycle. All three steps must be completed before the AI can generate meaningful planned sessions.

This flow all takes place on a single page (`/programme`) via an inline editor. The entire setup is done in-app — no manual database population or dev seeding is needed in production.

**Preconditions:** none — this is the starting point for a new user or when beginning a new training programme.

---

## Sequence diagram

```mermaid
sequenceDiagram
    actor User
    participant App
    participant API
    participant Supabase

    User->>App: Navigates to /programme
    App->>API: GET /api/programme
    API->>Supabase: Query programmes WHERE status = 'active'
    Supabase-->>API: null (no active programme)
    API-->>App: { currentProgramme: null, mesocycles: [], weeklyTemplate: [], upcomingPlannedSessions: [] }
    App-->>User: "Start Your Programme" empty-state card + ProgrammeBuilderEditor (create mode)

    rect rgb(240, 248, 255)
        Note over User,Supabase: Step 1 — Create Programme (macrocycle)
        User->>App: Fills programme form: name, goal, start_date, target_date, notes
        App->>API: POST /api/programmes
        API->>Supabase: INSERT into programmes
        Supabase-->>API: Programme row
        API-->>App: { programme } 201
        App->>API: GET /api/programme (refetch snapshot)
        API->>Supabase: Query mesocycles WHERE programme_id = id
        Supabase-->>API: [] (no mesocycles yet)
        API-->>App: Updated snapshot: programme exists, mesocycles empty
        App-->>User: Programme overview visible. Mesocycle section: empty state.
    end

    rect rgb(240, 255, 240)
        Note over User,Supabase: Step 2 — Create Mesocycle (training block)
        User->>App: Fills mesocycle form: name, phase_type, planned_start, planned_end, focus, status
        App->>API: POST /api/mesocycles { programme_id, name, phase_type, planned_start, planned_end, focus }
        API->>Supabase: INSERT into mesocycles
        Supabase-->>API: Mesocycle row
        API-->>App: { mesocycle } 201
        App->>API: GET /api/programme (refetch)
        API->>Supabase: Query mesocycles, getActiveMesocycle
        Supabase-->>API: Mesocycle (status: active)
        API-->>App: Updated snapshot: active mesocycle visible
        App-->>User: Active mesocycle card visible. Weekly structure section: empty state.
    end

    rect rgb(255, 248, 240)
        Note over User,Supabase: Step 3 — Define Weekly Template (repeat per training day)
        loop For each training day
            User->>App: Fills template slot: day_of_week, session_label, session_type, intensity, duration_mins, primary_focus
            App->>API: POST /api/weekly-templates { mesocycle_id, day_of_week, session_label, session_type, intensity, ... }
            API->>Supabase: INSERT into weekly_templates
            Supabase-->>API: WeeklyTemplate row
            API-->>App: { weeklyTemplate } 201
            App-->>User: Slot added to weekly structure card
        end
        Note over User,App: User defines as many or as few slots as desired.<br/>Unscheduled days are implicitly rest days.
    end

    Note over User,Supabase: Setup complete. Programme, mesocycle, and weekly template all exist.<br/>The AI coach now has full programme context.<br/>User can proceed to generate planned sessions (see Flow 04).

    alt User edits an existing programme
        User->>App: Modifies programme details in editor
        App->>API: PUT /api/programmes/{id} { ...changes }
        API->>Supabase: UPDATE programmes
        API-->>App: { programme } 200
        App-->>User: Updated programme card
    end

    alt User edits an existing mesocycle (e.g. marks interrupted)
        User->>App: Updates mesocycle status or dates
        App->>API: PUT /api/mesocycles/{id} { status: 'interrupted', interruption_notes: '...' }
        API->>Supabase: UPDATE mesocycles
        API-->>App: { mesocycle } 200
        App-->>User: Updated mesocycle card
    end

    alt User edits a weekly template slot
        User->>App: Changes a slot's intensity or session type
        App->>API: PUT /api/weekly-templates/{id} { ...changes }
        API->>Supabase: UPDATE weekly_templates
        API-->>App: { weeklyTemplate } 200
        App-->>User: Updated weekly structure
    end
```

---

## Journey map

| Stage | User action | System response | Friction / gap |
|---|---|---|---|
| **Arrive at programme page** | Taps "Plan" tab | Empty-state card with user-facing copy and create form visible | ~~Developer copy~~ resolved. The empty state now explains the purpose of programme setup in plain language. |
| **Create programme** | Fills name, goal, dates | Programme created; "Getting started" step indicator appears with step 2 highlighted | No suggested goal templates or examples. `target_date` has no validation against `start_date`. |
| **Add first mesocycle** | Fills mesocycle details | Mesocycle created; step indicator advances to step 3 | `phase_type` enum values have no descriptions. The user must know what "power_endurance" means in a climbing context. `planned_start`/`planned_end` have no validation against programme dates. |
| **Build weekly template** | Adds slots one by one | Each slot appears; step indicator advances to step 4 | "Generate Week Sessions" button is now disabled until at least one slot exists — the user knows they need to add slots before generating. No bulk-add affordance. |
| **Edit existing setup** | Changes a mesocycle's status to 'interrupted' | Update applied | `interruption_notes` has no prompt. The coach uses this field — its value matters — but the user has no guidance on what to write. |
| **Setup complete** | Generates sessions | Sessions appear; "Getting started" step indicator hides automatically | The indicator disappearing is the implicit completion signal. No explicit "setup complete" confirmation. |

---

## Gap summary

### Resolved
- ~~**No step-by-step progression.**~~ A "Getting started" step indicator on `/programme` communicates the four-step sequence (programme → mesocycle → weekly template → generate sessions) and shows which steps are complete. It hides automatically when all four steps are done.

### Open
- **Phase type jargon unexplained.** `base`, `power`, `power_endurance`, `climbing_specific`, `performance`, `deload` are displayed as raw enum values with no descriptions. Tooltips or inline descriptions would lower the barrier for athletes unfamiliar with periodisation.
- **No date validation between layers.** A mesocycle's dates can fall outside the programme's dates, and a programme's target date can precede its start date, without any error.
- **Editing a mesocycle status is undiscoverable.** Marking a mesocycle as `interrupted` requires the user to find the status field in the inline editor. There is no prominent "interrupt this block" action.
- **Multiple mesocycles per programme.** The UI shows only the active mesocycle. A user working through a multi-block programme has no overview of the full mesocycle history.
