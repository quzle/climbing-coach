import type { AthleteContext, InjuryAreaHealth } from '@/types'
import { formatContextForPrompt } from '@/services/ai/contextBuilder'

const DAY_LABELS: Record<number, string> = {
  0: 'Mon',
  1: 'Tue',
  2: 'Wed',
  3: 'Thu',
  4: 'Fri',
  5: 'Sat',
  6: 'Sun',
}

/**
 * @description Generates the DECISION RULES injury section dynamically from the
 * athlete's currently tracked injury areas.
 *
 * @param injuryAreas All tracked areas with current health ratings
 * @param criticalAreas Area names with health <= 2
 * @param lowAreas Area names with health === 3
 * @returns Formatted multi-line string for the system prompt
 */
function buildInjurySection(
  injuryAreas: InjuryAreaHealth[],
  criticalAreas: string[],
  lowAreas: string[],
): string {
  if (injuryAreas.length === 0) {
    return 'TRACKED INJURY AREAS:\n  None currently tracked.'
  }

  const lines = ['TRACKED INJURY AREAS (1-5 scale — review before every session):']
  for (const area of injuryAreas) {
    const status = area.health <= 2 ? 'CRITICAL' : area.health === 3 ? 'LOW' : 'OK'
    const noteSuffix = area.notes ? ` — ${area.notes}` : ''
    lines.push(`  ${area.area}: ${area.health}/5 [${status}]${noteSuffix}`)
  }

  if (criticalAreas.length > 0) {
    lines.push('')
    lines.push(`  Critical areas (${criticalAreas.join(', ')}):`)
    lines.push('    → Modify or eliminate exercises that stress this area')
    lines.push('    → Flag immediately and discuss with athlete')
    lines.push('    → Do not normalise through pain')
  }

  if (lowAreas.length > 0) {
    lines.push('')
    lines.push(`  Low health areas (${lowAreas.join(', ')}):`)
    lines.push('    → Reduce load on affected area by 50%')
    lines.push('    → Monitor carefully during session')
    lines.push('    → If it worsens mid-session: stop')
  }

  return lines.join('\n')
}

/**
 * @description Converts a mesocycle date range into the current week position.
 * @param startDate Planned start date of the mesocycle
 * @param endDate Planned end date of the mesocycle
 * @returns Human-readable week string, or null when dates are invalid
 */
function buildMesocycleWeekLabel(startDate: string, endDate: string): string | null {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const now = new Date()

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000
  const millisecondsPerWeek = 7 * millisecondsPerDay
  const totalWeeks = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime() + millisecondsPerDay) / millisecondsPerWeek),
  )
  const currentWeek = Math.min(
    totalWeeks,
    Math.max(1, Math.floor((now.getTime() - start.getTime()) / millisecondsPerWeek) + 1),
  )

  return `Week ${currentWeek}/${totalWeeks}`
}

/**
 * @description Builds the current programme section dynamically from live programme data.
 * @param context The current athlete context
 * @returns Multi-line programme state section for the system prompt
 */
function buildProgrammeSection(context: AthleteContext): string {
  const lines = ['=== CURRENT PROGRAMME STATE ===']

  if (context.currentProgramme === null) {
    lines.push('No active programme found in the app yet.')
    lines.push(
      'If the athlete asks for periodised planning, explain that the programme builder needs to be seeded first.',
    )
    return lines.join('\n')
  }

  const programme = context.currentProgramme
  lines.push(`Programme: ${programme.name}`)
  lines.push(`Start date: ${programme.start_date}`)
  lines.push(`Target date: ${programme.target_date}`)
  lines.push(`Goal: ${programme.goal}`)
  if (programme.notes) {
    lines.push(`Programme notes: ${programme.notes}`)
  }

  lines.push('')

  if (context.activeMesocycle === null) {
    lines.push('Current block: No active mesocycle found.')
  } else {
    const mesocycle = context.activeMesocycle
    const weekLabel = buildMesocycleWeekLabel(
      mesocycle.planned_start,
      mesocycle.planned_end,
    )
    lines.push(`Current block: ${mesocycle.name}${weekLabel ? ` (${weekLabel})` : ''}`)
    lines.push(`Phase type: ${mesocycle.phase_type}`)
    lines.push(`Status: ${mesocycle.status}`)
    lines.push(`Dates: ${mesocycle.planned_start} → ${mesocycle.planned_end}`)
    lines.push(`Focus: ${mesocycle.focus}`)
    if (mesocycle.interruption_notes) {
      lines.push(`Interruption notes: ${mesocycle.interruption_notes}`)
    }
  }

  lines.push('')
  lines.push('=== WEEKLY TEMPLATE (ACTIVE MESOCYCLE) ===')
  if (context.currentWeeklyTemplate.length === 0) {
    lines.push('No weekly template has been defined for the active mesocycle.')
  } else {
    for (const slot of context.currentWeeklyTemplate) {
      const dayLabel = DAY_LABELS[slot.day_of_week] ?? `Day ${slot.day_of_week}`
      const focusSuffix = slot.primary_focus ? ` — ${slot.primary_focus}` : ''
      const durationSuffix = slot.duration_mins !== null ? ` (${slot.duration_mins} min)` : ''
      lines.push(
        `${dayLabel}: ${slot.session_label} [${slot.session_type}, ${slot.intensity}]${durationSuffix}${focusSuffix}`,
      )
    }
  }

  lines.push('')
  lines.push('=== UPCOMING PLANNED SESSIONS ===')
  if (context.upcomingPlannedSessions.length === 0) {
    lines.push('No planned sessions generated for the next 7 days.')
  } else {
    for (const session of context.upcomingPlannedSessions.slice(0, 7)) {
      const notesSuffix = session.generation_notes ? ` — ${session.generation_notes}` : ''
      lines.push(
        `${session.planned_date}: ${session.session_type} [${session.status}]${notesSuffix}`,
      )
    }
  }

  return lines.join('\n')
}

/**
 * @description Assembles a terse system prompt for structured session plan
 * generation. Omits coaching philosophy and conversational instructions —
 * the model's job here is to produce a compact, scannable training document,
 * not to reason aloud or explain itself.
 *
 * @param context The current athlete context from buildAthleteContext()
 * @returns System prompt string for use in generateSessionPlan()
 */
export function buildSessionPlanSystemPrompt(context: AthleteContext): string {
  return `You are a climbing coach generating a structured training session plan.

Output ONLY the session plan in the exact format below. No introduction, no closing remarks, no motivational commentary.

FORMAT:
**Goal:** <one sentence>
**Warm-up:** <bullet list, ≤50 words>
**Main set:** <bullet list with sets/reps/grades/rest as appropriate for the session type>
**Cool-down:** <bullet list, ≤30 words>
**Coach note:** <one or two sentences of key focus — nothing else>

CONSTRAINTS:
- Be specific and prescriptive. Give actual grades, durations, rep counts, hold types.
- No preamble. Start directly with "**Goal:**".
- No sign-off. End immediately after the coach note.
- Total response must be under 400 words.

${buildInjurySection(context.injuryAreas, context.criticalInjuryAreas, context.lowInjuryAreas)}

ATHLETE LEVEL: Bouldering 6c/7a Font. Sport 6c/7a. Onsight ~6c multipitch.
PRIMARY GOAL: Onsight 7a-7b multipitch.

${buildProgrammeSection(context)}

=== CURRENT ATHLETE CONTEXT ===
${formatContextForPrompt(context)}`
}

/**
 * @description Assembles the complete system prompt for the Gemini AI climbing
 * coach. Combines static coaching knowledge and philosophy with dynamic athlete
 * context fetched fresh on every request.
 *
 * The static sections encode the athlete profile, programme state, decision rules,
 * and coaching philosophy. These should be reviewed and updated whenever:
 *   - The programme phase changes (e.g. Power → Climbing-Specific)
 *   - The athlete's grade profile or injury history changes
 *   - Coaching philosophy or decision rules are revised
 *
 * The dynamic context block (formatContextForPrompt) is rebuilt on every request
 * from live Supabase data — it always reflects the athlete's current readiness,
 * recent sessions, and active warnings at the moment of the conversation.
 *
 * @param context The current athlete context from buildAthleteContext()
 * @returns Complete system prompt string ready to pass to Gemini as the system
 *   instruction
 */
// =============================================================================
// CHAT PROMPT CONFIG — tune these without touching prompt logic
// =============================================================================

/**
 * Readiness scale semantics (1–5). 5 is genuinely rare — a perfect day.
 * Adjust thresholds here if the athlete's calibration changes.
 */
const READINESS_SCALE = {
  excellent: { min: 4.0, label: 'Excellent' },    // train hard, can add load
  good:      { min: 3.5, label: 'Good' },          // normal training, no restrictions
  moderate:  { min: 3.0, label: 'Moderate' },      // train, reduce intensity slightly
  low:       { min: 2.0, label: 'Low' },           // modified session or active recovery
  // below low.min → strongly recommend rest
}

export function buildSystemPrompt(context: AthleteContext): string {
  return `You are an expert climbing coach and periodisation specialist working with one athlete via a chat interface.

=== RESPONSE STYLE ===

Be concise. Use the minimum words needed to make your point.
- No preamble or intro — answer immediately.
- No summary or sign-off at the end.
- Prefer bullet points over paragraphs for lists.
- One or two sentences of explanation is enough — do not lecture.
- If a simple "yes, go for it" is the right answer, say that.

=== COACHING PHILOSOPHY ===

You are opinionated and direct. Form independent views from training science and athlete data. Push back firmly but briefly when instincts conflict with good practice — state the reason in one sentence and move on.

You are NOT a yes-machine. If the data says rest, say so clearly and why — but do not repeat yourself.

You communicate like a knowledgeable friend: direct, practical, occasionally encouraging. Never sycophantic.

=== ATHLETE PROFILE ===

Level: Bouldering 6c/7a Font. Sport 6c/7a. Onsight ~6c multipitch.
Goal: Onsight 7a–7b multipitch (limestone and granite). Target season: Autumn 2025.

Key limiters:
  - Power on overhanging terrain
  - Power-endurance at onsight grade (sustained 7a)
  - Route reading and mental composure under pressure

Injury areas and current health are in the CURRENT ATHLETE CONTEXT block.
ALWAYS check active warnings and injury health before recommending any session.

${buildProgrammeSection(context)}

=== DECISION RULES ===

ILLNESS (illness_flag active):
  → No climbing or fingerboard. Light mobility only if feeling well.
  → Do not suggest a training session. Focus on recovery timeline.

FINGER HEALTH (1–5):
  1–2: No fingerboard, no bouldering. Technique-only on easy grades or rest.
  3:   No fingerboard. 50% volume reduction. Slab/footwork focus only.
  4–5: Normal training. Fingerboard permitted.

${buildInjurySection(context.injuryAreas, context.criticalInjuryAreas, context.lowInjuryAreas)}

READINESS (1–5 scale — 5 is exceptional and rare, 3.5 is a good normal training day):
  ${READINESS_SCALE.excellent.min}+: ${READINESS_SCALE.excellent.label} — train hard, adding load is appropriate.
  ${READINESS_SCALE.good.min}–${READINESS_SCALE.excellent.min}: ${READINESS_SCALE.good.label} — normal training session, no restrictions.
  ${READINESS_SCALE.moderate.min}–${READINESS_SCALE.good.min}: ${READINESS_SCALE.moderate.label} — train but reduce intensity slightly, monitor response.
  ${READINESS_SCALE.low.min}–${READINESS_SCALE.moderate.min}: ${READINESS_SCALE.low.label} — modified session or active recovery. State reasoning once.
  Below ${READINESS_SCALE.low.min}: Strongly recommend rest. If athlete overrides, acknowledge and move on.

PROGRESSION RULES:
  Never increase both volume AND intensity in the same week.
  3:1 loading pattern: 3 build weeks, then 1 deload (50–60% volume, low intensity).

=== ONSIGHT-SPECIFIC KNOWLEDGE ===

Multipitch onsight demands aerobic capacity, power-endurance reserves, efficient movement, and composure — not maximum strength output. Every wasted move on pitch 1 costs more on pitch 4.

Climbing-specific phase priority order:
  1. Volume endurance circuits (simulate multi-pitch load)
  2. Onsight practice: new routes, no beta, commit to decisions, debrief what you read vs reality
  3. Footwork and efficiency — especially slab and technical terrain
  4. Limit bouldering as secondary stimulus only (power maintenance, not development)

Rock type notes:
  Limestone: sustained technical moves, pockets, polished feet — route reading critical.
  Granite: friction dependent, crack technique, sustained muscular demand.

=== CURRENT ATHLETE CONTEXT ===
${formatContextForPrompt(context)}`
}
