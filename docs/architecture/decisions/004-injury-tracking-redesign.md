# ADR 004: Flexible Injury Tracking System

## Status

Planned — scheduled for Phase 2.
Current implementation is a known limitation.

## Date

2026-03-25

## Context

The Phase 1 implementation hard-codes shoulder injury tracking across five layers of the system:

1. `readiness_checkins` table: dedicated `shoulder_health` column
2. `session_logs` table: dedicated `shoulder_flag` boolean
3. `AthleteContext` type: `currentShoulderHealth` field
4. `contextBuilder.ts`: shoulder-specific decision rules
5. `promptBuilder.ts`: shoulder-specific coaching instructions

This design was acceptable for Phase 1 because:

- The athlete has a known shoulder injury history
- Speed of implementation was prioritised
- The architecture risk was documented

This design is not acceptable long-term because:

- Climbers commonly have finger, elbow, and wrist injuries
- New injury areas cannot be added without code changes
- The system cannot track recovery of multiple simultaneous injuries
- Finger health is partially tracked via the `finger_health` column, but inconsistently. It has no body-part specificity such as which finger or which pulley is affected.

## Decision

### Phase 2 Schema Change

Replace dedicated injury columns with flexible `jsonb` fields.

**`readiness_checkins` table**

- Remove: `shoulder_health int`
- Keep `finger_health` for backwards compatibility, but mark it deprecated
- Add: `injury_area_health jsonb`

`injury_area_health` shape:

```json
[
  {
    "area": "shoulder_left",
    "health": 3,
    "notes": "Mild soreness on overhead movement"
  }
]
```

Keep a computed `general_health` score for readiness calculation, derived from the minimum health score across all tracked injury areas.

**`session_logs` table**

- Remove: `shoulder_flag boolean`
- Add: `injury_flags jsonb` as a string array of area names

Example:

```json
["shoulder_left", "finger_a2_right"]
```

### Phase 2 Type Changes

Remove from `AthleteContext`:

- `currentShoulderHealth: number | null`

Add to `AthleteContext`:

- `injuryAreas: InjuryAreaHealth[]`
- `activeInjuryFlags: string[]`
- `criticalInjuryAreas: string[]` for areas with `health <= 2`
- `lowInjuryAreas: string[]` for areas with `health === 3`

New types required:

**`InjuryAreaHealth`**

```ts
type InjuryAreaHealth = {
  area: InjuryArea | string
  health: number
  notes: string | null
}
```

**`InjuryArea`**

```ts
type InjuryArea =
  | 'shoulder_left'
  | 'shoulder_right'
  | 'finger_a2_left'
  | 'finger_a2_right'
  | 'finger_a4_left'
  | 'finger_a4_right'
  | 'finger_pip_left'
  | 'finger_pip_right'
  | 'elbow_medial_left'
  | 'elbow_medial_right'
  | 'elbow_lateral_left'
  | 'elbow_lateral_right'
  | 'wrist_left'
  | 'wrist_right'
  | 'knee_left'
  | 'knee_right'
  | 'ankle_left'
  | 'ankle_right'
  | 'lower_back'
  | 'neck'
  | 'hip_flexor_left'
  | 'hip_flexor_right'
  | string
```

### Phase 2 UI Changes

**`ReadinessForm`**

Replace the fixed shoulder question with a dynamic injury tracking step.

The `Track injury areas` step should show:

- List of currently tracked areas from the user profile
- A 1-5 health selector for each area
- A `+ Track new area` action to add a body part

Expected behaviour:

- First-time setup: user adds their shoulder
- Later: user can add a new area such as finger A2 when a new injury appears
- Recovered areas can be archived, hidden from the default flow but retained for history

**`SessionLogForm` `CommonFields`**

Replace the `shoulder_flag` toggle with a multi-select of currently tracked areas labelled `Any injury concerns this session?`.
Show checkboxes for each tracked area.

**User profile / settings page**

Add a Phase 2 profile/settings page to manage tracked injury areas:

- Add a new area from a standard list or custom entry
- Archive a recovered area
- View injury history per area

### Phase 2 `contextBuilder` Changes

Replace shoulder-specific decision rules with dynamic rules generated from `injuryAreas`.

For each area in `injuryAreas`:

- If `health <= 2`, add a critical warning with area-specific training restrictions
- If `health === 3`, add an advisory warning

Initial restriction mappings:

- `shoulder_*`: avoid pressing and overhead loading
- `finger_*`: avoid fingerboard work and reduce crimping
- `elbow_medial_*`: avoid pulling and crimping
- `elbow_lateral_*`: avoid pushing and extension-heavy work
- `wrist_*`: avoid loading and fingerboard work
- `lower_back`: avoid heavy pulling and sit-starts

### Phase 2 `promptBuilder` Changes

Replace the hard-coded shoulder section with a dynamic injury section generated from the athlete profile.

Target structure:

```text
CURRENT INJURY TRACKING:
[For each tracked area]
  [area_name]: [health]/5
  [if health <= 3]: Training restriction: [rule]

[if any critical areas]
CRITICAL: Do not programme [restricted movements]
until [area] health returns to >= 4/5.
```

### Migration Strategy

1. Add new `jsonb` columns as non-breaking nullable fields
2. Write a migration script to convert existing data
   - `shoulder_health` -> `injury_area_health[0]` where `area = 'shoulder_left'`
   - `shoulder_flag` -> `injury_flags` where the array includes `'shoulder_left'`
3. Update application code to read the new columns
4. Run a deprecation period reading both old and new columns
5. Drop old columns after data and application behaviour are confirmed

## Consequences

**Positive**

- Any injury area can be tracked without code changes
- Multiple simultaneous injuries are handled correctly
- Finger injuries, which are among the most common climbing injuries, can be tracked per finger and per pulley system
- Recovery can be tracked per area over time
- The AI coach can generate area-specific training restrictions

**Negative**

- The readiness form becomes more complex
- The readiness score calculation needs updating because it currently uses `shoulder_health` as a weighted input
- Data migration is required for any existing records

The additional form complexity is acceptable because the UI will only show tracked areas, not every possible body part.

## Phase 1 Workaround

Until Phase 2, the system prompt in `promptBuilder.ts` should use generic injury language where possible, and the hard-coded shoulder rules should remain clearly marked with TODO comments referencing this ADR.

Any new injury areas such as a finger A2 pulley issue must be tracked manually in coach chat notes until Phase 2 is implemented.

## Files Requiring Changes in Phase 2

**Database**

- [ ] Supabase migration: alter `readiness_checkins`
- [ ] Supabase migration: alter `session_logs`

**Types**

- [ ] `src/types/index.ts` — add `InjuryArea`, `InjuryAreaHealth`
- [ ] `src/types/index.ts` — update `AthleteContext`
- [ ] `src/lib/database.types.ts` — regenerate from Supabase

**Services**

- [ ] `src/services/data/readinessRepository.ts`
- [ ] `src/services/data/sessionRepository.ts`
- [ ] `src/services/ai/contextBuilder.ts`
- [ ] `src/services/ai/promptBuilder.ts`

**UI Components**

- [ ] `src/components/forms/ReadinessForm.tsx`
- [ ] `src/components/forms/session-fields/CommonFields.tsx`
- [ ] New: `src/components/forms/InjuryAreaSelector.tsx`
- [ ] New: `src/app/profile/page.tsx`

**Tests**

- [ ] All repository tests updated
- [ ] `contextBuilder` tests updated
- [ ] `ReadinessForm` tests updated