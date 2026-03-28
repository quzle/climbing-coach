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

---

## Chat

### `POST /api/chat`

Send a user message to the AI coach. Builds a fresh athlete context on every call (readiness, sessions, programme, injury areas) and injects it into the Gemini system prompt.

**Request body**

```ts
{
  message: string        // 1–2000 chars
  history: ChatMessage[] // previous messages; defaults to []
}
```

`history` is the full conversation so far, passed from client state. The last 20 messages are sent to Gemini as conversation history. Both the user message and the AI response are saved to `chat_messages` as a fire-and-forget operation.

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

Submit today's readiness check-in. One check-in per calendar date is enforced — a second submission on the same day returns `409`.

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

Retrieve recent check-ins with today's summary and a rolling weekly average.

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

Log a completed training session.

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

Retrieve recent sessions, optionally filtered by type.

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

List all programmes, ordered by most recent `start_date` first.

**Response** `200`

```ts
{ data: { programmes: Programme[] } }
```

---

### `POST /api/programmes`

Create a new programme.

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

Fetch one programme by UUID.

**Response** `200` · `404` if not found.

```ts
{ data: { programme: Programme } }
```

---

### `PUT /api/programmes/[id]`

Partial update — all fields optional, at least one required.

**Request body:** any subset of the `POST` fields above.

**Response** `200`

```ts
{ data: { programme: Programme } }
```

---

### `GET /api/programme`

Aggregated planning snapshot — returns the active programme, its mesocycles, the active mesocycle's weekly template, and upcoming planned sessions in a single round-trip. Used by the programme builder page.

**Response** `200`

```ts
{ data: ProgrammeBuilderSnapshot }
```

`ProgrammeBuilderSnapshot` shape: `{ programme, mesocycles, weeklyTemplate, upcomingPlannedSessions }`.

---

## Mesocycles

### `GET /api/mesocycles`

List mesocycles for a programme.

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

Create a mesocycle within a programme.

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

Fetch one mesocycle by UUID. Returns `404` if not found.

**Response** `200`

```ts
{ data: { mesocycle: Mesocycle } }
```

---

### `PUT /api/mesocycles/[id]`

Partial update — all fields optional, at least one required.

**Request body:** any subset of the `POST` fields above.

**Response** `200`

```ts
{ data: { mesocycle: Mesocycle } }
```

---

## Weekly Templates

Weekly templates define the intended session structure for each day of the week within a mesocycle. `day_of_week` uses `0 = Monday … 6 = Sunday`.

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

List planned sessions by date range or upcoming days. Provide either a date range or `upcoming_days` — not both.

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

Create a planned session row manually.

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

Generate planned sessions for the active mesocycle using the AI coach. Creates one planned session per weekly template slot in the target week, using Gemini to produce session content.

**Request body** (all optional)

```ts
{
  week_start: string // YYYY-MM-DD; Monday of the target week; defaults to current week
}
```

**Response** `200`

```ts
{ data: { plannedSessions: PlannedSession[] } }
```

---

### `GET /api/planned-sessions/[id]`

Fetch one planned session by UUID. Returns `404` if not found.

**Response** `200`

```ts
{ data: { plannedSession: PlannedSession } }
```

---

### `PUT /api/planned-sessions/[id]`

Partial update — all fields optional, at least one required.

**Request body:** any subset of the `POST` fields above.

**Response** `200`

```ts
{ data: { plannedSession: PlannedSession } }
```

---

### `DELETE /api/planned-sessions/[id]`

Delete a planned session row. Returns `404` if not found.

**Response** `200`

```ts
{ data: { plannedSession: PlannedSession } } // the deleted row
```

---

## Injury Areas

Injury areas are user-managed tracked body parts (e.g. `finger_a2_left`, `shoulder_right`). Active areas appear in the readiness check-in form and are injected into the AI coach prompt as dynamic decision rules. Deleting an area is a soft delete (archived) — the row is retained for historical context.

### `GET /api/injury-areas`

List all currently active (non-archived) injury areas.

**Response** `200`

```ts
{ data: InjuryAreaRow[] }
```

---

### `POST /api/injury-areas`

Add a new injury area to track. If the area was previously archived, it is reactivated. Idempotent — adding an already-active area is a no-op.

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

Archive an injury area (soft delete). The area name is URL-encoded in the path.

**Response** `200`

```ts
{ data: InjuryAreaRow } // the archived row
```

---

## Dev

### `POST /api/dev/seed-programme`

Seeds a deterministic Phase 2 starter programme with mesocycles, weekly templates, and planned sessions. **Disabled in production** — returns `404` when `NODE_ENV=production`.

**Response** `200`

```ts
{ data: SeedProgrammeResult } // summary of what was created
```
