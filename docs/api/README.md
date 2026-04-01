# API Reference

All endpoints are Next.js App Router API routes served as Vercel serverless functions. There is no separate backend — API routes are the backend.

## Common conventions

### Response envelope

Every endpoint returns the same wrapper shape:

```ts
{ data: T | null, error: string | null }
```

On success: `data` is populated, `error` is `null`.
On failure: `data` is `null`, `error` is a safe human-readable message (never a raw stack trace).

### Date format

All dates are `YYYY-MM-DD` strings. Never ISO 8601 datetime — date only.

### Shared enums

| Enum | Values |
|---|---|
| `SessionType` | `bouldering` · `kilterboard` · `lead` · `fingerboard` · `strength` · `aerobic` · `rest` · `mobility` |
| `PhaseType` | `base` · `power` · `power_endurance` · `climbing_specific` · `performance` · `deload` |
| `MesocycleStatus` | `planned` · `active` · `completed` · `interrupted` |
| `PlannedSessionStatus` | `planned` · `completed` · `skipped` · `modified` |
| `Intensity` | `high` · `medium` · `low` |

### Validation

All `POST` and `PUT` routes validate input with Zod. Invalid input returns `400` with a message listing which fields failed and why.

### Logging and observability

API routes use the structured logger in `src/lib/logger.ts`.

- Every route log includes `event`, `outcome`, and `route`.
- Add `userId` and `profileRole` when auth context is already available.
- Add `entityType` and `entityId` when the route targets a specific domain record.
- Put extra safe operational context under `data`.
- Use `logInfo()` for successful route completion.
- Use `logWarn()` for expected handled failures such as validation issues, denied access, and service or repository errors returned in-band.
- Use `logError()` for unexpected exceptions and catch blocks.
- Never log secrets or sensitive payloads such as tokens, cookies, prompts, chat message bodies, or raw model responses.

---

## Chat

### `POST /api/chat`

Send a user message to the AI coach. Builds a fresh athlete context on every call (readiness, sessions, programme, injury areas) and injects it into the Gemini system prompt.

Operational logging for this route records request outcome, duration, message length, history count, warning count, and model identifier. Prompt text, chat history content, and AI response content are never logged.

**Request body**

```ts
{
  message: string        // 1–2000 chars
  history: ChatMessage[] // previous messages; defaults to []
}
```

`history` is the full conversation so far, passed from client state. The last 20 messages are sent to Gemini as conversation history. Both the user message and the AI response are saved as a fire-and-forget operation through the chat message repository layer (`chat_messages` table).

Chat persistence is now repository-backed for both `chat_threads` and `chat_messages`, establishing thread-aware storage primitives ahead of the `/api/chat` route refactor.

**Response** `200`

```ts
{
  data: {
    response: string    // AI coach reply (markdown)
    warnings: string[]  // active training warnings derived from today's readiness
  }
}
```

---

### `GET /api/chat/history`

Fetch recent chat messages for display on page load.

**Query parameters**

| Param | Type | Default | Constraint |
|---|---|---|---|
| `limit` | number | `20` | 1–50 |

**Response** `200`

```ts
{
  data: {
    messages: ChatMessage[] // ordered oldest → newest
  }
}
```

---

## Readiness

### `POST /api/readiness`

Submit today's readiness check-in for the authenticated user. One check-in per calendar date is enforced per user — a second submission on the same day returns `409`.

Returns active training warnings (same set the AI coach sees) so the UI can surface them immediately after submission.

**Request body**

```ts
{
  sleep_quality:       number          // 1–5
  fatigue:             number          // 1–5 (inverted: higher = more tired)
  finger_health:       number          // 1–5
  life_stress:         number          // 1–5 (inverted: higher = more stressed)
  illness_flag:        boolean
  injury_area_health:  {               // one entry per tracked injury area
    area:   string
    health: number    // 1–5
    notes:  string | null
  }[]                                  // defaults to []
  notes:               string | null   // max 500 chars; optional
}
```

**Response** `201`

```ts
{
  data: {
    checkin:  ReadinessCheckin
    warnings: string[]          // active coach warnings, e.g. 🔴 finger health critical
  }
}
```

**Status codes**

| Code | Meaning |
|---|---|
| `201` | Check-in saved |
| `400` | Validation failure |
| `409` | Already checked in today |
| `500` | Database error |

---

### `GET /api/readiness`

Retrieve recent check-ins for the authenticated user with today's summary and a rolling weekly average.

**Query parameters**

| Param | Type | Default | Constraint |
|---|---|---|---|
| `days` | number | `7` | 1–90 |

**Response** `200`

```ts
{
  data: {
    checkins:         ReadinessCheckin[]  // last N days, newest first
    todaysCheckin:    ReadinessCheckin | null
    hasCheckedInToday: boolean
    weeklyAvg:        number              // 7-day mean readiness_score (0–5)
  }
}
```

Individual query failures return partial results rather than a `500` — missing fields default to `null` / `[]` / `false`.

---

## Sessions

### `POST /api/sessions`

Log a completed training session for the authenticated user.

If `planned_session_id` is supplied and the planned session has status `planned`, it is automatically marked `completed`. If the logged duration deviates from the planned duration by more than 20%, a note is appended to the session record.

**Request body**

```ts
{
  date:               string          // YYYY-MM-DD
  session_type:       SessionType
  location:           string | null   // max 100 chars; optional
  duration_mins:      number          // 1–480; optional
  quality_rating:     number          // 1–5; optional
  rpe:                number          // 1–10 (Rate of Perceived Exertion); optional
  injury_flags:       string[]        // area names flagged during session; defaults to []
  notes:              string | null   // max 1000 chars; optional
  planned_session_id: string | null   // UUID; links to planned session; optional
  log_data:           object | null   // session-type-specific structured data (see below)
}
```

**`log_data` shapes by session type**

| Session type | Shape |
|---|---|
| `bouldering` · `kilterboard` · `lead` | `{ problems: { grade, attempts, result, notes? }[], location?, board_angle? }` |
| `fingerboard` | `{ protocol, sets: { edge_size_mm, hang_time_s, rest_s, reps, added_weight_kg, grip }[] }` |
| `strength` | `{ exercises: { name, sets, reps, weight_kg, notes? }[] }` |
| `aerobic` | `{ modality, duration_minutes, average_grade?, notes? }` |
| `rest` · `mobility` | `null` or free-form object |

**Response** `201`

```ts
{ data: { session: SessionLog } }
```

---

### `GET /api/sessions`

Retrieve recent sessions for the authenticated user, optionally filtered by type.

**Query parameters**

| Param | Type | Default | Constraint |
|---|---|---|---|
| `days` | number | `30` | 1–365 |
| `type` | SessionType | — | any valid session type; omit for all |

**Response** `200`

```ts
{ data: { sessions: SessionLog[] } }
```

Returns `400` if `type` is not a valid `SessionType`.

---

## Programmes

### `GET /api/programmes`

List programmes for the authenticated user, ordered by most recent `start_date` first.

**Response** `200`

```ts
{ data: { programmes: Programme[] } }
```

---

### `POST /api/programmes`

Create a new programme for the authenticated user.

**Request body**

```ts
{
  name:        string        // 1–120 chars
  goal:        string        // 1–300 chars
  start_date:  string        // YYYY-MM-DD
  target_date: string        // YYYY-MM-DD
  notes:       string | null // max 1000 chars; optional
}
```

**Response** `201`

```ts
{ data: { programme: Programme } }
```

---

### `GET /api/programmes/[id]`

Fetch one programme by UUID, scoped to the authenticated user.

**Response** `200` · `404` if not found.

```ts
{ data: { programme: Programme } }
```

---

### `PUT /api/programmes/[id]`

Partial update (authenticated user's programme only) — all fields optional, at least one required.

**Request body:** any subset of the `POST` fields above.

**Response** `200`

```ts
{ data: { programme: Programme } }
```

---

### `GET /api/programme`

Aggregated planning snapshot — returns the active programme, the active mesocycle, the active mesocycle's weekly template, and the next 7 days of planned sessions in a single round-trip. Used by the programme page.

**Response** `200`

```ts
{
  data: {
    currentProgramme:         Programme | null
    activeMesocycle:          Mesocycle | null
    currentWeeklyTemplate:    WeeklyTemplate[]
    upcomingPlannedSessions:  PlannedSession[]  // next 7 days
  }
}
```

---

### `POST /api/programme/generate`

AI wizard — step 1. Accepts a training goal description and generates a periodised programme plan (mesocycle blocks with names, phase types, durations, focus, and objectives). Does **not** write to the database; the generated plan is returned for review.

**Request body**

```ts
{
  goal:                      string    // 1–300 chars; e.g. "Onsight 7b by October"
  start_date:                string    // YYYY-MM-DD
  duration_weeks:            number    // 4–52
  focus:                     string    // "power" | "endurance" | "technique" | "general"
  strengths:                 string    // 1–500 chars; what the athlete is good at
  weaknesses:                string    // 1–500 chars; areas to develop
  current_grade_bouldering?: string    // e.g. "7a Font"; optional
  current_grade_sport?:      string    // e.g. "6c+"; optional
  current_grade_onsight?:    string    // e.g. "6c"; optional
  goal_grade?:               string    // e.g. "7b onsight"; optional
  peak_event_label?:         string    // optional event name, max 100 chars
  injuries?:                 string    // optional free-text injury notes, max 500 chars
  additional_context?:       string    // optional free-text, max 1000 chars
}
```

**Response** `200`

```ts
{
  data: {
    programme: {
      name:  string
      goal:  string
      notes: string | null
    }
    mesocycles: {
      name:           string
      focus:          string
      phase_type:     PhaseType
      duration_weeks: number
      objectives:     string    // human-readable objectives for review UI
    }[]
  }
}
```

---

### `POST /api/programme/confirm`

AI wizard — step 2. Persists the reviewed plan: creates the programme row and all mesocycle rows with computed dates. Stores `strengths`, `weaknesses`, `additional_context`, and grade fields in the `athlete_profile` JSONB column on the programme. Returns the new programme ID and the first mesocycle ID so the client can navigate to weekly schedule setup.

**Request body**

```ts
{
  wizard_input: { /* same shape as POST /api/programme/generate request body */ }
  plan:         { /* same shape as POST /api/programme/generate response data */ }
}
```

**Response** `201`

```ts
{ data: { programme_id: string; first_mesocycle_id: string } }
```

---

## Mesocycles

### `GET /api/mesocycles`

List mesocycles for a programme, scoped to the authenticated user.

**Query parameters**

| Param | Type | Required |
|---|---|---|
| `programme_id` | UUID | Yes |

**Response** `200`

```ts
{ data: { mesocycles: Mesocycle[] } }
```

---

### `POST /api/mesocycles`

Create a mesocycle within a programme for the authenticated user.

**Request body**

```ts
{
  programme_id:        string          // UUID
  name:                string          // 1–120 chars
  focus:               string          // 1–500 chars
  phase_type:          PhaseType
  planned_start:       string          // YYYY-MM-DD
  planned_end:         string          // YYYY-MM-DD
  status:              MesocycleStatus // optional; defaults to 'planned'
  actual_start:        string | null   // YYYY-MM-DD; optional
  actual_end:          string | null   // YYYY-MM-DD; optional
  interruption_notes:  string | null   // max 1000 chars; optional
}
```

**Response** `201`

```ts
{ data: { mesocycle: Mesocycle } }
```

---

### `GET /api/mesocycles/[id]`

Fetch one mesocycle by UUID, scoped to the authenticated user. Returns `404` if not found.

**Response** `200`

```ts
{ data: { mesocycle: Mesocycle } }
```

---

### `PUT /api/mesocycles/[id]`

Partial update (authenticated user's mesocycle only) — all fields optional, at least one required.

**Request body:** any subset of the `POST` fields above.

**Response** `200`

```ts
{ data: { mesocycle: Mesocycle } }
```

---

### `POST /api/mesocycles/[id]/generate-weekly`

Weekly setup wizard — step 1. Accepts athlete preferences (available days, session duration, preferred styles, optional day pins) and generates a suggested weekly session schedule for the mesocycle using Gemini. Does **not** write to the database; the generated slots are returned for the tap-to-place review board.

**Request body**

```ts
{
  available_days:        number[]  // 0 (Mon) – 6 (Sun); at least one required
  preferred_duration_mins: number // e.g. 90
  preferred_styles:      string[] // subset of session types; at least one required
  day_pins:              {        // optional day preferences per style
    style:       string
    day_of_week: number
    locked:      boolean          // true = AI must not move this slot
  }[]
}
```

**Response** `200`

```ts
{
  data: {
    session_label:  string
    session_type:   SessionType
    intensity:      Intensity
    day_of_week:    number
    duration_mins:  number | null
    primary_focus:  string | null
  }[]
}
```

---

### `POST /api/mesocycles/[id]/confirm-weekly`

Weekly setup wizard — step 2. Replaces all existing weekly templates for the mesocycle with the confirmed slot arrangement. Idempotent — safe to call multiple times (delete-then-insert).

**Request body**

```ts
{ slots: GeneratedWeeklyTemplate[] } // same shape as generate-weekly response
```

**Response** `201`

```ts
{ data: { count: number } } // number of template rows created
```

---

## Weekly Templates

Weekly templates define the intended session structure for each day of the week within a mesocycle. `day_of_week` uses `0 = Monday … 6 = Sunday`.
All weekly template endpoints are scoped to the authenticated user.

### `GET /api/weekly-templates`

List weekly templates for a mesocycle, ordered by `day_of_week`.

**Query parameters**

| Param | Type | Required |
|---|---|---|
| `mesocycle_id` | UUID | Yes |

**Response** `200`

```ts
{ data: { weeklyTemplates: WeeklyTemplate[] } }
```

---

### `POST /api/weekly-templates`

Create a weekly template slot.

**Request body**

```ts
{
  mesocycle_id:  string        // UUID
  day_of_week:   number        // 0 (Mon) – 6 (Sun)
  session_label: string        // 1–120 chars; display name, e.g. "Power Bouldering"
  session_type:  SessionType
  intensity:     Intensity
  duration_mins: number | null // 1–480; optional
  primary_focus: string | null // max 200 chars; optional
  notes:         string | null // max 1000 chars; optional
}
```

**Response** `201`

```ts
{ data: { weeklyTemplate: WeeklyTemplate } }
```

---

### `GET /api/weekly-templates/[id]`

Fetch one weekly template slot by UUID. Returns `404` if not found.

**Response** `200`

```ts
{ data: { weeklyTemplate: WeeklyTemplate } }
```

---

### `PUT /api/weekly-templates/[id]`

Partial update — all fields optional, at least one required.

**Request body:** any subset of the `POST` fields above.

**Response** `200`

```ts
{ data: { weeklyTemplate: WeeklyTemplate } }
```

---

## Planned Sessions

Planned sessions are AI-generated or manually created session outlines for a specific date. They can be linked to a session log when the athlete completes the session.

### `GET /api/planned-sessions`

List planned sessions for the authenticated user by date range or upcoming days. Provide either a date range or `upcoming_days` — not both.

**Query parameters**

| Param | Type | Default | Constraint |
|---|---|---|---|
| `start_date` | YYYY-MM-DD | — | Required if `end_date` provided |
| `end_date` | YYYY-MM-DD | — | Required if `start_date` provided |
| `upcoming_days` | number | `7` | 1–30; used when no date range given |

**Response** `200`

```ts
{ data: { plannedSessions: PlannedSession[] } }
```

---

### `POST /api/planned-sessions`

Create a planned session row manually for the authenticated user.

**Request body**

```ts
{
  planned_date:      string                // YYYY-MM-DD
  session_type:      SessionType
  mesocycle_id:      string | null         // UUID; optional
  template_id:       string | null         // UUID; links to weekly template slot; optional
  status:            PlannedSessionStatus  // optional; defaults to 'planned'
  generation_notes:  string | null         // max 1000 chars; optional
  generated_plan:    object | null         // AI-generated plan content; optional
}
```

**Response** `201`

```ts
{ data: { plannedSession: PlannedSession } }
```

---

### `POST /api/planned-sessions/generate`

Create planned session records for every weekly occurrence in the active mesocycle from today to its `planned_end`. One record per template slot per week is created; existing records for the same `date:template_id` pair are skipped (idempotent).

Sessions are stored with template metadata only (`session_label`, `intensity`, `primary_focus`, `duration_mins`). No AI calls are made here — AI plan text is generated lazily on first access via `POST /api/planned-sessions/[id]/generate-plan`.

**Request body:** none required.

**Response** `200`

```ts
{ data: { plannedSessions: PlannedSession[] } } // newly created rows only
```

---

### `POST /api/planned-sessions/[id]/generate-plan`

Generate and cache an AI session plan for a single planned session. Calls Gemini with the freshest available athlete context (readiness, recent sessions, programme phase) at the moment of the call.

Idempotent — if `generated_plan.ai_plan_text` already exists the cached value is returned without calling Gemini again.

The session must have an associated `mesocycle_id` and `template_id`; standalone manually-created sessions without these return `422`.

**Request body:** none.

**Response** `200`

```ts
{ data: { ai_plan_text: string } }
```

**Status codes**

| Code | Meaning |
|---|---|
| `200` | Plan generated (or returned from cache) |
| `404` | Planned session not found |
| `422` | Session has no mesocycle or template association |
| `500` | Gemini or database error |

---

### `GET /api/planned-sessions/[id]`

Fetch one planned session by UUID, scoped to the authenticated user. Returns `404` if not found.

**Response** `200`

```ts
{ data: { plannedSession: PlannedSession } }
```

---

### `PUT /api/planned-sessions/[id]`

Partial update (authenticated user's planned session only) — all fields optional, at least one required.

**Request body:** any subset of the `POST` fields above.

**Response** `200`

```ts
{ data: { plannedSession: PlannedSession } }
```

---

### `DELETE /api/planned-sessions/[id]`

Delete an authenticated user's planned session row. Returns `404` if not found.

**Response** `200`

```ts
{ data: { plannedSession: PlannedSession } } // the deleted row
```

---

## Injury Areas

Injury areas are user-managed tracked body parts (e.g. `finger_a2_left`, `shoulder_right`). Active areas appear in the readiness check-in form and are injected into the AI coach prompt as dynamic decision rules. Deleting an area is a soft delete (archived) — the row is retained for historical context.

### `GET /api/injury-areas`

List all currently active (non-archived) injury areas for the authenticated user.

**Response** `200`

```ts
{ data: InjuryAreaRow[] }
```

---

### `POST /api/injury-areas`

Add a new injury area to track for the authenticated user. If the area was previously archived, it is reactivated. Idempotent — adding an already-active area is a no-op.

**Request body**

```ts
{
  area: string // 1–100 chars; e.g. "finger_a2_left", "shoulder_right", "elbow_medial_left"
}
```

**Response** `201`

```ts
{ data: InjuryAreaRow }
```

---

### `DELETE /api/injury-areas/[area]`

Archive an authenticated user's injury area (soft delete). The area name is URL-encoded in the path.

**Response** `200`

```ts
{ data: InjuryAreaRow } // the archived row
```

---

## Invites

### `POST /api/invites`

Sends an invite email through Supabase native invite flow. Requires authenticated `superuser` role.

**Request body**

```ts
{
  email: string // valid email address, max 320 chars
}
```

**Response** `201`

```ts
{
  data: {
    invited_email: string
  },
  error: null
}
```

**Status codes**

| Code | Meaning |
|---|---|
| `201` | Invite accepted by Supabase |
| `400` | Invalid request payload |
| `401` | Not authenticated |
| `403` | Authenticated but not a superuser |
| `500` | Failed to send invite |

## Dev

All `/api/dev/*` routes are disabled in production (`404`) and privileged handlers require a server-side superuser check.

### `POST /api/dev/clear-all`

Deletes all application rows in FK-safe order for local/dev cleanup. Requires authenticated `superuser` role.

**Response** `200`

```ts
{
  data: {
    tablesCleared: Record<string, number> // deleted-row count by table
  },
  error: null
}
```

**Status codes**

| Code | Meaning |
|---|---|
| `200` | Database cleared successfully |
| `401` | Not authenticated |
| `403` | Authenticated but not a superuser |
| `404` | Route disabled in production |
| `500` | Failed to clear one or more tables |

### `POST /api/dev/seed-programme`

Seeds a deterministic Phase 2 starter programme with mesocycles, weekly templates, and planned sessions. **Disabled in production** — returns `404` when `NODE_ENV=production`.

**Response** `200`

```ts
{ data: SeedProgrammeResult } // summary of what was created
```
