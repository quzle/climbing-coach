# AI Programme Creation Wizard — Design Plan

## Current Constraints

**Schema enums that AI output must respect exactly:**
- `mesocycle.phase_type`: `base | power | power_endurance | climbing_specific | performance | deload`
- `weekly_template.session_type`: `bouldering | kilterboard | lead | fingerboard | strength | aerobic | rest | mobility`
- `weekly_template.intensity`: `high | medium | low`
- `weekly_template.day_of_week`: `0–6` (0=Mon, 6=Sun)

**Risks:**
- Gemini lite may not reliably output well-formed JSON — needs retry logic or a validation/correction pass
- Wizard state lives in React state only (no DB persistence mid-wizard). A page refresh loses progress
- If the user already has an active programme with live mesocycles, the wizard creates a second programme — needs a clear "replace/archive existing plan" decision point
- Token budget: 4–6 mesocycles × 4 templates each in JSON could be ~1,500 tokens of output. `MAX_OUTPUT_TOKENS = 1024` would need raising for the wizard call only

---

## Recommended Architecture

**Two-phase approach:**

```
Phase A: Collect intent → single Gemini call → JSON plan
Phase B: Review/edit plan cards → confirm → bulk create to DB
```

A single Gemini call (not multi-turn) keeps it simpler and cheaper. The review step gives the user editorial control without the complexity of a conversational back-and-forth.

---

## UX Flow

### Step 1 — Intent Form (`/programme/new`)

A single scrollable form (not a multi-step stepper — fewer taps, faster to fill):

| Field | Input type | Maps to |
|---|---|---|
| What's your main goal? | Dropdown + free text | `programme.goal` |
| Start date | Date picker | `programme.start_date` |
| Time horizon | Segmented: 8 / 12 / 16 / 20 / custom weeks | Drives `programme.target_date` |
| Peaking for something? | Optional date + label (trip/comp) | Injected into AI prompt |
| Training days available | Day-of-week checkboxes (Mon–Sun) | Drives weekly template generation |
| Sessions per week | Stepper 2–6 (constrained by days checked above) | Injected into AI prompt |
| Preferred session length | Segmented: 60 / 90 / 120 min | Drives `weekly_template.duration_mins` |
| Preferred styles | Multi-select: Bouldering / Lead / Kilterboard / Fingerboard / Strength | Drives session type distribution |
| Focus area | Segmented: Power / Endurance / Technique / General | Influences phase sequencing |
| Any current injuries or niggles? | Free text or pull from existing `injury_areas` | Injected into AI prompt |

"Generate my plan →" button → calls `POST /api/programme/generate`.

---

### Step 2 — Generating (loading screen)

Simple spinner with a progress message ("Planning your mesocycles…"). The API call may take 3–8 seconds.

---

### Step 3 — Review Plan

A timeline of mesocycle cards, each showing:

```
┌─────────────────────────────────┐
│ Block 1: Base Fitness  [Edit]   │
│ Phase: Base · 4 weeks           │
│ 28 Mar → 25 Apr                 │
│ Focus: Build aerobic base,      │
│        volume tolerance         │
│                                 │
│ Weekly structure:               │
│  Mon – Bouldering (medium, 90m) │
│  Wed – Strength (medium, 60m)   │
│  Fri – Lead (low, 90m)          │
│  Sat – Fingerboard (low, 45m)   │
└─────────────────────────────────┘
```

Below all cards: `[Regenerate with feedback]` and `[Create this plan]`.

**Inline editing:** tapping `[Edit]` on a mesocycle card expands an inline form using the existing `programme-builder-editor` form fields (no new form components needed). Changes are stored in local React state only until "Create this plan" is pressed.

**Regenerate with feedback:** a small text input ("anything to change?") + another Gemini call with the original wizard data + the user's amendment instruction. Replaces all cards with the new result.

---

### Step 4 — Bulk Create

`POST /api/programme/confirm` (new endpoint) receives the full reviewed plan as JSON and:
1. Creates the `programme` record
2. Creates all `mesocycle` records (computing `planned_start`/`planned_end` from `start_date` + cumulative `duration_weeks`)
3. Creates all `weekly_template` records
4. Returns the new programme ID
5. Redirects to `/programme`

---

## AI Prompt Design

**New endpoint:** `POST /api/programme/generate`

**System instruction:**
```
You are a climbing training planner. Output ONLY valid JSON. No prose, no markdown fences.
The JSON must match the schema exactly. All enum values must come from the lists provided.
```

**User message** — assembled from wizard form data:
```
Athlete: [bouldering 6c/7a, sport 6c/7a, onsight 6c — from existing profile]
Goal: [user input]
Start date: 2026-03-28, Time horizon: 12 weeks
Target event: Red rocks trip 2026-06-20
Available days: Mon, Wed, Fri, Sat
Sessions/week: 4, Preferred duration: 90 min
Preferred styles: Bouldering, Fingerboard, Strength
Focus: Power
Injuries: Left finger pulley (moderate)
Completed mesocycles: [from DB — name, phase_type, duration]

Design a periodized plan. Output this JSON schema:
{
  "programme": { "name": string, "goal": string, "notes": string },
  "mesocycles": [{
    "name": string,
    "focus": string,
    "phase_type": "base"|"power"|"power_endurance"|"climbing_specific"|"performance"|"deload",
    "duration_weeks": number,
    "weekly_templates": [{
      "day_of_week": 0-6,
      "session_label": string,
      "session_type": "bouldering"|"kilterboard"|"lead"|"fingerboard"|"strength"|"aerobic"|"rest"|"mobility",
      "intensity": "high"|"medium"|"low",
      "duration_mins": number,
      "primary_focus": string,
      "notes": string
    }]
  }]
}
```

**Temperature:** 0.4 (lower than chat — structured output needs consistency)
**Max tokens:** 2000 (higher ceiling for this call only)

---

## Handling Completed Mesocycles

The `buildAthleteContext()` already fetches programme context. For the wizard prompt, additionally query mesocycles where `status = 'completed'` and include them as a "training history" block. This lets the AI avoid repeating the same phase and sequence progression appropriately (e.g., if the athlete just finished a base block, don't start with another base block).

---

## Implementation Phases

| Phase | Scope | New files |
|---|---|---|
| 1 | Wizard form + generate endpoint + JSON parsing | `src/app/programme/new/page.tsx`, `src/app/api/programme/generate/route.ts` |
| 2 | Review UI (plan cards + inline edit) | `src/components/programme/wizard-plan-review.tsx`, `src/components/programme/wizard-mesocycle-card.tsx` |
| 3 | Confirm endpoint (bulk create) | `src/app/api/programme/confirm/route.ts` |
| 4 | Regenerate-with-feedback loop | Extends generate endpoint with `amendment` param |

Phases 1–3 give a complete working wizard. Phase 4 is the refinement loop.

---

## Key Risks to Mitigate

1. **JSON parsing failures** — wrap Gemini output in a try/catch with Zod validation of the returned structure. If validation fails, surface a "plan generation failed, try again" error rather than crashing.

2. **Enum violations** — Zod schema for the parsed plan should include `.enum([...])` on all constrained fields. Invalid values from the AI get caught before touching the DB.

3. **Duration overflow** — sum of `duration_weeks` across mesocycles must not exceed the total time horizon. Add a server-side check and clamp if needed.

4. **Existing active programme** — before creating, check if the user has an active programme. If so, show a confirmation: "You have an active programme. Creating a new one will not delete it but it will become your active plan."

5. **Mobile input UX** — the day-of-week checkboxes and style multi-select need to be touch-friendly (44px tap targets).
