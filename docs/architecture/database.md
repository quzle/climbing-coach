# Database Schema

This document describes the complete Supabase Postgres schema for the Climbing Coach application.

Schema changes are managed as SQL migration files in `supabase/migrations/`. Run each migration in order against your Supabase project via the SQL Editor before starting the application.

---

## `profiles`

Application-owned user metadata. One row per `auth.users` entry (one-to-one).

Created by migration `20260330000001_create_profiles_table.sql`.

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `uuid` | No | — | Primary key — references `auth.users(id)` (cascade delete) |
| `email` | `text` | No | — | User's email address |
| `display_name` | `text` | Yes | `null` | Optional display name |
| `role` | `text` | No | `'user'` | MVP values: `user`, `superuser` |
| `invite_status` | `text` | No | `'invited'` | MVP values: `invited`, `active` |
| `created_at` | `timestamptz` | No | `now()` | Row creation timestamp |
| `updated_at` | `timestamptz` | No | `now()` | Last update timestamp |

**Relationships:** `id` → `auth.users(id)` (one-to-one, cascade delete).

**Business rules:** A profile row is created when a superuser sends an invite (`invite_status = 'invited'`). On the user's first successful sign-in the application transitions `invite_status` to `'active'`. `role` is managed by superuser tooling only.

---

## `programmes`

Represents a structured training programme (e.g. a 12-week block targeting 7a onsight).

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `name` | `text` | No | Human-readable programme name |
| `goal` | `text` | Yes | Target grade or objective (e.g. "7a onsight") |
| `start_date` | `date` | Yes | Planned programme start date |
| `target_date` | `date` | Yes | Planned programme end date |
| `status` | `text` | No | `active`, `completed`, or `paused` (default `active`) |
| `notes` | `text` | Yes | Free-text notes about the programme |
| `created_at` | `timestamptz` | No | Row creation timestamp |

**Relationships:** None — top-level entity.

**Business rules:** Only one programme per user may have `status = 'active'` at any time. This is enforced by a partial unique index `idx_programmes_one_active_per_user ON programmes(user_id) WHERE (status = 'active')` (added in migration `20260330000002_add_programme_status_constraint.sql`). Before activating a new programme the existing active programme must be transitioned to `completed` or `paused`.

---

## `mesocycles`

A training block within a programme (e.g. a 3-week base endurance block followed by 1-week deload).

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `programme_id` | `uuid` | No | Foreign key → `programmes.id` |
| `name` | `text` | No | Block name (e.g. "Base Endurance Block 1") |
| `focus` | `text` | Yes | Training focus (e.g. "aerobic capacity", "max strength") |
| `week_number` | `integer` | No | Which week of the programme this block starts |
| `duration_weeks` | `integer` | No | Length of this block in weeks |
| `is_deload` | `boolean` | No | Whether this is a recovery/deload week |
| `notes` | `text` | Yes | Free-text notes |
| `created_at` | `timestamptz` | No | Row creation timestamp |

**Relationships:** `programme_id` → `programmes.id` (cascade delete).

---

## `weekly_templates`

Defines the intended training structure for a week within a mesocycle (e.g. Mon: bouldering, Wed: fingerboard, Fri: lead).

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `mesocycle_id` | `uuid` | No | Foreign key → `mesocycles.id` |
| `day_of_week` | `integer` | No | 0 = Monday … 6 = Sunday |
| `session_type` | `text` | No | `bouldering`, `lead`, `fingerboard`, `strength`, `aerobic`, `rest` |
| `focus` | `text` | Yes | Specific focus for this session slot |
| `notes` | `text` | Yes | Free-text notes |
| `created_at` | `timestamptz` | No | Row creation timestamp |

**Relationships:** `mesocycle_id` → `mesocycles.id` (cascade delete).

---

## `planned_sessions`

AI-generated or manually created session plans for a specific date.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `mesocycle_id` | `uuid` | Yes | Foreign key → `mesocycles.id` (nullable if created ad hoc) |
| `date` | `date` | No | Planned session date |
| `session_type` | `text` | No | `bouldering`, `lead`, `fingerboard`, `strength`, `aerobic` |
| `title` | `text` | Yes | Short session title |
| `description` | `text` | Yes | Full AI-generated or manual session plan |
| `estimated_duration_minutes` | `integer` | Yes | Expected session length |
| `created_at` | `timestamptz` | No | Row creation timestamp |

**Relationships:** `mesocycle_id` → `mesocycles.id` (set null on delete).

---

## `readiness_checkins`

Daily subjective readiness check-in logged by the athlete before a session or first thing in the morning.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `date` | `date` | No | Check-in date (unique per day) |
| `overall_fatigue` | `integer` | No | 1–10 scale (1 = exhausted, 10 = fresh) |
| `sleep_quality` | `integer` | No | 1–10 scale |
| `motivation` | `integer` | No | 1–10 scale |
| `finger_health` | `integer` | No | 1–10 scale (1 = injury, 10 = perfect) |
| `shoulder_health` | `integer` | No | 1–10 scale |
| `notes` | `text` | Yes | Free-text notes (illness, life stress, etc.) |
| `created_at` | `timestamptz` | No | Row creation timestamp |

**Relationships:** None.

**Business rules:** One row per calendar date. Application enforces uniqueness; add a `UNIQUE` constraint on `date`.

---

## `session_logs`

Completed training sessions logged by the athlete after the session.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `date` | `date` | No | Session date |
| `session_type` | `text` | No | `bouldering`, `kilterboard`, `lead`, `fingerboard`, `strength`, `aerobic` |
| `planned_session_id` | `uuid` | Yes | FK → `planned_sessions.id` (null if unplanned) |
| `duration_minutes` | `integer` | Yes | Actual session duration |
| `rpe` | `integer` | Yes | Rate of Perceived Exertion 1–10 |
| `notes` | `text` | Yes | Free-text session notes |
| `log_data` | `jsonb` | Yes | Structured session data — schema varies by `session_type` (see below) |
| `created_at` | `timestamptz` | No | Row creation timestamp |

**Relationships:** `planned_session_id` → `planned_sessions.id` (set null on delete).

### `log_data` Shape by Session Type

The `log_data` jsonb field stores session-specific structured data. The shape depends on `session_type`.

#### `bouldering` / `kilterboard` / `lead`

```jsonb
{
  "problems": [
    {
      "grade": "6c",
      "attempts": 3,
      "result": "sent",        // "sent" | "topped" | "fell" | "project"
      "notes": "crux is the undercling at the top"
    }
  ],
  "location": "The Arch",      // optional
  "board_angle": 40            // kilterboard only, degrees
}
```

#### `fingerboard`

```jsonb
{
  "protocol": "max hangs",     // "max hangs" | "repeaters" | "density"
  "sets": [
    {
      "edge_size_mm": 20,
      "hang_time_s": 10,
      "rest_s": 180,
      "reps": 6,
      "added_weight_kg": 5,    // negative = assisted
      "grip": "half crimp"     // "half crimp" | "open hand" | "front two"
    }
  ]
}
```

#### `strength`

```jsonb
{
  "exercises": [
    {
      "name": "pull-ups",
      "sets": 4,
      "reps": 8,
      "weight_kg": 10,         // added weight; 0 = bodyweight
      "notes": "strict form"
    }
  ]
}
```

#### `aerobic`

```jsonb
{
  "modality": "4x4",           // "4x4" | "ARCing" | "monostructural"
  "duration_minutes": 30,
  "average_grade": "5+",       // approximate grade if climbing-based
  "notes": "felt smooth throughout"
}
```

---

## `chat_messages`

Stores the full conversation history between the athlete and the AI coach.

`thread_id` column added by migration `20260330000002_add_thread_id_to_chat_messages.sql`.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `user_id` | `uuid` | No | Owner — references `auth.users(id)` |
| `thread_id` | `uuid` | Yes | FK → `chat_threads.id` (set null on thread delete) |
| `role` | `text` | No | `user` or `assistant` |
| `content` | `text` | No | Message text |
| `context_snapshot` | `jsonb` | Yes | Athlete context snapshot captured at send time |
| `created_at` | `timestamptz` | No | Message timestamp (used for ordering and recency window) |

**Relationships:** `user_id` → `auth.users(id)`. `thread_id` → `chat_threads(id)` (set null on delete).

**Business rules:** The prompt builder fetches the most recent 20 messages ordered by `created_at` descending. `thread_id` is nullable to preserve messages created before threading was introduced; future work may back-fill this column. There is no hard limit on total rows — implement a cleanup job if the table grows excessively.

---

## `chat_threads`

Groups chat messages into per-user conversation threads. Introduced to support the multi-user ownership model and future thread history expansion.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | `uuid` | No | Primary key |
| `user_id` | `uuid` | No | Owner — references `auth.users(id)` |
| `title` | `text` | Yes | Optional human-readable thread name (e.g. AI-generated or user-assigned) |
| `created_at` | `timestamptz` | No | Row creation timestamp |
| `updated_at` | `timestamptz` | No | Last-updated timestamp (used for ordering threads by recency) |

**Relationships:** `user_id` → `auth.users(id)`.

**Business rules:** The MVP exposes one default thread per user in the UI. The schema supports multiple threads per user without a redesign. `updated_at` should be refreshed whenever a message is added to the thread.
