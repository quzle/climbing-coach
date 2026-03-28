# Flow 05: Injury Management

## Overview

A user notices a new injury or recurring pain and wants the app to account for it in coaching recommendations. This is a cross-cutting flow: the user adds an injury area in their Profile, it appears as a field in subsequent readiness check-ins, those ratings are read by the context builder, and the prompt builder generates dynamic coaching rules from the data.

This flow replaced hard-coded shoulder tracking (Phase 1) with a flexible, user-managed system (ADR 004, Phase 2). Any body part can be tracked — e.g. `finger_a2_left`, `shoulder_right`, `elbow_medial_left`.

**Preconditions:** none — injury areas can be added at any time, independent of programme state.

---

## Sequence diagram

```mermaid
sequenceDiagram
    actor User
    participant App
    participant API
    participant Supabase
    participant Gemini

    Note over User,Supabase: Part 1 — Adding an injury area

    User->>App: Navigates to /profile
    App->>API: GET /api/injury-areas
    API->>Supabase: Query injury_areas WHERE archived = false
    Supabase-->>API: [] (no tracked areas yet)
    API-->>App: { data: [] }
    App-->>User: Profile page: "No tracked injury areas" + add form

    User->>App: Selects "Shoulder (right)" from dropdown of known areas and taps Track
    App->>API: POST /api/injury-areas { area: "shoulder_right" }
    API->>Supabase: INSERT into injury_areas (or reactivate if previously archived)
    Supabase-->>API: InjuryAreaRow
    API-->>App: { data: InjuryAreaRow } 201
    App-->>User: "Shoulder (right)" appears in tracked areas list

    Note over User,Supabase: Part 2 — Readiness check-in with injury area

    User->>App: Navigates to /readiness on a subsequent day
    App->>API: GET /api/injury-areas (to build dynamic form fields)
    API->>Supabase: Query injury_areas WHERE archived = false
    Supabase-->>API: [{ area: "shoulder_right" }]
    API-->>App: Active injury areas
    App-->>User: Readiness form includes a "shoulder_right" health field (1–5 scale + notes)

    User->>App: Rates shoulder_right as 3/5, adds note "clicking on overhead moves", submits form
    App->>API: POST /api/readiness { ..., injury_area_health: [{ area: "shoulder_right", health: 3, notes: "clicking on overhead moves" }] }
    API->>Supabase: INSERT into readiness_checkins with injury_area_health JSONB
    Supabase-->>API: ReadinessCheckin row
    API->>API: computeWarnings() evaluates shoulder_right health = 3
    Note over API: getAreaRestriction("shoulder_right") → "avoid pressing and overhead loading"
    API->>API: Generates warning: "🟡 shoulder_right low (3/5) — avoid pressing and overhead loading, monitor carefully"
    API-->>App: { checkin, warnings: ["🟡 shoulder_right low (3/5)..."] }
    App-->>User: Warning displayed on check-in confirmation. Warning also returned by GET /api/readiness and shown on home page.

    Note over User,Gemini: Part 3 — AI coach applies injury rules

    User->>App: Opens chat (/chat), sends a message
    App->>API: POST /api/chat { message, history }
    API->>API: buildAthleteContext()
    API->>Supabase: getTodaysCheckin() — returns today's check-in with injury_area_health
    API->>Supabase: getActiveInjuryAreas() — returns [shoulder_right]
    Supabase-->>API: Context data
    API->>API: parseInjuryAreaHealth(todaysReadiness.injury_area_health)
    Note over API: → [{ area: "shoulder_right", health: 3, notes: "clicking on overhead moves" }]
    API->>API: computeWarnings() — generates warning for shoulder_right 3/5
    API->>API: buildSystemPrompt(context)
    Note over API: buildInjurySection() generates:<br/>"TRACKED INJURY AREAS:<br/>shoulder_right: 3/5 [LOW]<br/>Low health areas (shoulder_right):<br/>→ Reduce load on affected area by 50%<br/>→ Monitor carefully during session<br/>→ If worsens mid-session: stop"
    API->>Gemini: sendMessage with full system prompt including dynamic injury rules
    Gemini-->>API: Coaching response respecting shoulder restriction
    API-->>App: { response, warnings }
    App-->>User: Coach response avoids overhead pressing, acknowledges shoulder status

    Note over User,Supabase: Part 4 — Archiving a resolved injury

    User->>App: Injury resolves; navigates to /profile
    App-->>User: "shoulder_right" listed as active
    User->>App: Taps archive/remove button on shoulder_right
    App->>API: DELETE /api/injury-areas/shoulder_right
    API->>Supabase: UPDATE injury_areas SET archived = true WHERE area = "shoulder_right"
    Supabase-->>API: Archived InjuryAreaRow
    API-->>App: { data: InjuryAreaRow } 200
    App-->>User: "shoulder_right" removed from active list

    Note over User,Supabase: Subsequent readiness check-ins no longer include the shoulder_right field.<br/>Historical check-in data (injury_area_health JSONB) is retained for trend analysis.
```

---

## Journey map

| Stage | User action | System response | Friction / gap |
|---|---|---|---|
| **Notices pain** | Decides to track a new injury | — | There is no prompt from the app to add an injury area. The user must know to navigate to /profile or the readiness form's injury step and connect this to the coaching system. |
| **Navigate to Profile or readiness form** | Taps "Profile" tab, or proceeds to the injury step in the daily check-in | Profile shows a dropdown of all known body parts. Readiness form's injury step also includes the same dropdown inline | ~~No entry point from readiness form~~ — resolved. The readiness form's injury area step includes an inline "Track" control using the same `KNOWN_AREAS` dropdown, so the user can add a new area without leaving the check-in. |
| **Add injury area** | Selects area from dropdown and submits | Area added; appears in list with human-readable label | ~~Free-text with no autocomplete~~ — resolved. Both profile and readiness form use a `<select>` populated from `KNOWN_AREAS`. Only known areas can be added, ensuring `getAreaRestriction()` mappings always apply. |
| **Complete readiness check-in** | Opens readiness form on a subsequent day | Dynamic field for the tracked area appears in the form with 1–5 health scale | The health scale labels (Cannot train / Painful / Sore / Good / Pain-free) are visible but no tooltip explains how the rating affects coaching recommendations. |
| **See warnings** | Submits check-in with low area health | Warning displayed on submission; warning also shown on home page via `GET /api/readiness` | ~~Warnings transient~~ — resolved. Warnings are now computed server-side and returned by `GET /api/readiness`, so the home page shows them persistently whenever the user has checked in with active flags. |
| **Chat with coach** | Opens chat and asks for session advice | Coach applies dynamic injury rules without needing to be told about the injury | The coach silently applies injury rules. There's no explicit "I'm accounting for your shoulder_right (3/5)" confirmation unless the coach happens to mention it in the response. |
| **Archive resolved injury** | Returns to /profile, archives the area | Area removed from active list; future check-ins no longer include it | No confirmation that archiving means "this won't affect coaching anymore". Historical health ratings are retained in the database but not shown in the UI. |

---

## Gap summary

### Resolved
- ~~**Area name is undiscoverable.**~~ Both the profile page and the readiness form's injury step use a `<select>` populated from `KNOWN_AREAS`. Only known, labelled areas can be added, ensuring `getAreaRestriction()` mappings always apply correctly.
- ~~**No entry point from readiness form.**~~ The readiness form's injury step includes an inline "Track" control (same `KNOWN_AREAS` dropdown) so the user can add a new area without leaving the check-in.
- ~~**Warnings are transient.**~~ `GET /api/readiness` now computes and returns `warnings[]`. The home page shows warning banners persistently whenever the user has checked in with active flags.

### Open
- **No coaching acknowledgement.** The coach applies injury rules silently. A user who doesn't read the session plan carefully won't know their injury status influenced the recommendation.
- **No injury history view.** Archived areas and historical health ratings exist in the database but are not surfaced in the UI. A user managing a recurring injury cannot see their previous flare-up's timeline.
- **Profile page is least-discoverable nav position.** Profile is the last tab in the bottom nav. While the readiness form now provides an inline add control, managing and archiving areas still requires navigating to /profile.
