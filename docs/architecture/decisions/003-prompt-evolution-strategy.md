# ADR 003: System Prompt Evolution Strategy

## Status

Partially implemented — Phase 1 uses hybrid approach, Phase 2 will complete the dynamic implementation.

## Date

2026-03-24

## Context

The AI coach system prompt contains both static coaching knowledge (philosophy, training science, decision rules) and dynamic programme state (current phase, active protocols, athlete profile). The dynamic content will become inaccurate over time if hard-coded.

## Decision

### Phase 1 (current)

Static coaching knowledge is hard-coded in `promptBuilder.ts`. This is acceptable — it changes rarely.

Dynamic programme state is also in `promptBuilder.ts` in a clearly marked `PROGRAMME_STATE_OVERRIDE` block. This is a deliberate technical debt accepted to unblock Phase 1 delivery. It must be updated manually when phases change. It is labelled with a TODO comment referencing this ADR.

Athlete profile (grades, goals, limiters) is hard-coded in Phase 1. A TODO comment marks it for migration in Phase 2.

### Phase 2 (programme builder)

The following will be migrated to database-driven:

1. **Programme state**
   - Source: `mesocycles` table (`phase_type`, `status`, `dates`)
   - Flow: `contextBuilder.buildProgrammeContext()` → `AthleteContext.programme` → `promptBuilder.buildProgrammeSection()`

2. **Active protocols**
   - Source: new `protocols` field on `mesocycles` table, OR a separate `active_protocols` table
   - Flow: same as programme state

3. **Weekly structure**
   - Source: `weekly_templates` table
   - Flow: `contextBuilder` fetches templates for the active mesocycle → prompt section generated dynamically

4. **Athlete profile**
   - Source: new `athlete_profile` table
   - Flow: `contextBuilder` fetches profile → `promptBuilder` uses it dynamically
   - Bonus: AI coach can update grades when athlete reports new sends

## Consequences

**Phase 1:** Prompt may become inaccurate if `PROGRAMME_STATE_OVERRIDE` is not manually updated when phases change. Acceptable for initial delivery.
Mitigation: clear TODO comments and this ADR.

**Phase 2:** Prompt is always accurate. No manual prompt editing needed after the programme builder is built. Athlete profile stays current automatically.

## Update Checklist (Phase 1 manual updates)

When a training phase changes, update the `PROGRAMME_STATE_OVERRIDE` block in `src/services/ai/promptBuilder.ts`:

1. Mark the completed mesocycle as done
2. Update the current phase name and goals
3. Update the weekly structure if it changed
4. Update or remove active protocols
5. Commit with message:
   ```
   chore: update programme state in system prompt
   reason: [phase name] phase completed
   ```
