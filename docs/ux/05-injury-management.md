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

    User->>App: Types injury area name (e.g. "shoulder_right") and submits
    App->>API: POST /api/injury-areas { area: "shoulder_right" }
    API->>Supabase: INSERT into injury_areas (or reactivate if previously archived)
    Supabase-->>API: InjuryAreaRow
    API-->>App: { data: InjuryAreaRow } 201
    App-->>User: "shoulder_right" appears in tracked areas list

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
    App-->>User: Warning displayed on check-in confirmation

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
| **Notices pain** | Decides to track a new injury | — | There is no prompt from the app to add an injury area. The user must know to navigate to /profile and connect this to the coaching system. |
| **Navigate to Profile** | Taps "Profile" tab | Profile page loads with current tracked areas | /profile is the last tab in the bottom nav — least discoverable position. No contextual link from the readiness form ("track a new injury area →"). |
| **Add injury area** | Types area name and submits | Area added; appears in list | Area name is a free-text string — no autocomplete, no suggested values. The user must know valid area names (e.g. `finger_a2_left`, not just "finger") to get the right `getAreaRestriction()` mapping in the coaching rules. If they type "left shoulder", the restriction mapping won't apply. |
| **Complete readiness check-in** | Opens readiness form on a subsequent day | Dynamic field for the tracked area appears in the form | The injury area field appears alongside the standard metrics with no contextual explanation of what the rating means for coaching. |
| **See warnings** | Submits check-in with low area health | Warning displayed: 🟡 area low, restriction noted | Warning is shown once on submit and then disappears. It's not pinned to the home screen or visible in the chat without submitting another message. |
| **Chat with coach** | Opens chat and asks for session advice | Coach applies dynamic injury rules without needing to be told about the injury | The user has no visibility that the injury rule is active in the coach's context. There's no "I'm currently accounting for your shoulder_right (3/5)" acknowledgement unless the coach happens to mention it. |
| **Archive resolved injury** | Returns to /profile, archives the area | Area removed from active list; future check-ins no longer include it | No confirmation that archiving means "this won't affect coaching anymore". Historical ratings are retained but not surfaced anywhere (no trend view). |

---

## Gap summary

- **Area name is undiscoverable.** The `getAreaRestriction()` function maps area name prefixes (`shoulder_`, `finger_`, `elbow_medial_`, etc.) to training restrictions. If the user types an unrecognised name (e.g. "left finger" instead of `finger_a2_left`), the restriction silently doesn't apply. There are no suggested area names, no autocomplete, and no error for unrecognised values.
- **No entry point from readiness form.** The most natural moment to add a new injury area is while completing a readiness check-in ("my finger is sore today"). But the readiness form has no "add a new area to track" link — the user must leave the form, go to /profile, add the area, and return.
- **Warnings are transient.** Active injury warnings are surfaced on check-in submission and in the chat response, but they are not persistently visible anywhere. A user who submitted their check-in an hour ago has no reminder of their injury status when they open the session log.
- **No coaching acknowledgement.** The coach silently applies injury rules without telling the user it's doing so. A user who doesn't read the session plan carefully won't know their shoulder status influenced the recommendation.
- **No injury history view.** Archived areas and their historical health ratings exist in the database but are not shown anywhere in the UI. A user managing a recurring injury can't see their last flare-up's timeline.
- **Profile page is least-discoverable nav position.** The bottom nav orders tabs left-to-right: Home, Check-in, Log, Chat, History, Plan, Profile. Profile — which is the only place to manage injury areas — is last and least likely to be explored.
