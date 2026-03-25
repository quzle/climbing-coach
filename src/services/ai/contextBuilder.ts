import {
  getTodaysCheckin,
  getRecentCheckins,
  getAverageReadiness,
} from '@/services/data/readinessRepository'
import {
  getRecentSessions,
  getSessionCountThisWeek,
  getLastSessionDate,
} from '@/services/data/sessionRepository'
import { getActiveInjuryAreas } from '@/services/data/injuryAreasRepository'
import type {
  AthleteContext,
  InjuryAreaHealth,
  InjuryAreaRow,
  ReadinessCheckin,
  SessionLog,
} from '@/types'

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * @description Calculates how many days ago a date was.
 * @param dateString ISO date string or null
 * @returns Number of days since that date, or 999 if null.
 *   999 is used as a sentinel meaning "very long time ago" so downstream
 *   logic (e.g. return-to-training warnings) correctly treats missing data
 *   as a significant gap rather than a recent session.
 */
function computeDaysSince(dateString: string | null): number {
  if (dateString === null) return 999
  const then = new Date(dateString)
  const now = new Date()
  // Zero out time components so we count whole calendar days, not hours
  then.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  const diffMs = now.getTime() - then.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * @description Maps an injury area name prefix to a human-readable training
 * restriction string. Used to generate per-area warning messages.
 *
 * @param area The injury area identifier
 * @returns A short restriction description, or null if no known rule applies
 */
function getAreaRestriction(area: string): string | null {
  if (area.startsWith('shoulder_')) return 'avoid pressing and overhead loading'
  if (area.startsWith('finger_')) return 'avoid fingerboard work and reduce crimping'
  if (area.startsWith('elbow_medial_')) return 'avoid pulling movements and crimping'
  if (area.startsWith('elbow_lateral_')) return 'avoid pushing and extension-heavy work'
  if (area.startsWith('wrist_')) return 'avoid loading and fingerboard work'
  if (area.startsWith('knee_')) return 'avoid high foot placements and deep knee bends'
  if (area === 'lower_back') return 'avoid heavy pulling and sit-starts'
  if (area.startsWith('hip_flexor_')) return 'avoid high steps and hip flexion under load'
  return null
}

/**
 * @description Parses the injury_area_health jsonb field from a readiness
 * check-in into a typed array. Returns an empty array if the field is null,
 * malformed, or does not match the expected shape.
 *
 * @param raw The raw jsonb value from the database
 * @returns Typed array of InjuryAreaHealth, empty if unreadable
 */
export function parseInjuryAreaHealth(raw: unknown): InjuryAreaHealth[] {
  if (!Array.isArray(raw)) return []
  const result: InjuryAreaHealth[] = []
  for (const item of raw) {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).area === 'string' &&
      typeof (item as Record<string, unknown>).health === 'number'
    ) {
      const r = item as Record<string, unknown>
      result.push({
        area: r.area as InjuryAreaHealth['area'],
        health: r.health as number,
        notes: typeof r.notes === 'string' ? r.notes : null,
      })
    }
  }
  return result
}

/**
 * @description Evaluates athlete readiness metrics and returns
 * human-readable warning strings for the AI coach to act on.
 * Rules are applied in priority order: illness → finger → injury areas →
 * weekly average → return-to-training → missing check-in.
 *
 * @param todaysReadiness Today's readiness check-in, or null if not submitted
 * @param weeklyAvg Mean readiness score over the past 7 days (0–5 scale)
 * @param daysSinceLastSession Number of days since the last logged session
 * @param injuryAreas Current health ratings for all tracked injury areas
 * @returns Array of warning strings, empty if no warnings apply
 */
function computeWarnings(
  todaysReadiness: ReadinessCheckin | null,
  weeklyAvg: number,
  daysSinceLastSession: number,
  injuryAreas: InjuryAreaHealth[],
): string[] {
  const warnings: string[] = []

  // --- ILLNESS (highest priority) ---
  if (todaysReadiness?.illness_flag === true) {
    warnings.push(
      '🔴 ILLNESS FLAG ACTIVE — no climbing or fingerboard training. Light mobility only.',
    )
  }

  // --- FINGER HEALTH ---
  const finger = todaysReadiness?.finger_health ?? null
  if (finger !== null && (finger === 1 || finger === 2)) {
    warnings.push(
      `🔴 Finger health critical (${finger}/5) — no fingerboard, no bouldering, consider rest day.`,
    )
  } else if (finger === 3) {
    warnings.push(
      '🟡 Finger health low (3/5) — no fingerboard, reduce climbing volume by 50%, footwork drills only.',
    )
  }

  // --- TRACKED INJURY AREAS (dynamic — replaces hard-coded shoulder block) ---
  for (const { area, health } of injuryAreas) {
    const restriction = getAreaRestriction(area)
    const restrictionText = restriction != null ? ` — ${restriction}` : ''
    if (health === 1 || health === 2) {
      warnings.push(
        `🔴 ${area} critical (${health}/5)${restrictionText}.`,
      )
    } else if (health === 3) {
      warnings.push(
        `🟡 ${area} low (3/5)${restrictionText}, monitor carefully during session.`,
      )
    }
  }

  // --- WEEKLY READINESS AVERAGE ---
  if (weeklyAvg > 0 && weeklyAvg < 2.5) {
    warnings.push(
      `🟡 Weekly readiness average low (${weeklyAvg.toFixed(2)}/5) — recommend modified session or active recovery.`,
    )
  }

  // --- RETURN TO TRAINING ---
  // The >= 14 check must come first because the condition also satisfies >= 7.
  if (daysSinceLastSession >= 14 && daysSinceLastSession < 999) {
    warnings.push(
      `🔴 ${daysSinceLastSession} days since last session — significant detraining likely. Start at 50% volume. Do not test maxes.`,
    )
  } else if (daysSinceLastSession >= 7 && daysSinceLastSession < 999) {
    warnings.push(
      `🟡 ${daysSinceLastSession} days since last session — apply return-to-training protocol: 60% volume, technique focus, no max effort.`,
    )
  }

  // --- NO CHECK-IN ---
  if (todaysReadiness === null) {
    warnings.push(
      '⚪ No readiness check-in today — ask athlete to complete check-in before recommending session.',
    )
  }

  return warnings
}

// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

/**
 * @description Fetches all athlete data from Supabase and assembles a complete
 * AthleteContext object. All data fetches run in parallel via Promise.all to
 * minimise latency on each serverless invocation.
 *
 * Individual fetch failures are caught and replaced with safe fallback values
 * (null, 0, empty array) so the AI coach can still function with partial context.
 * Errors are logged server-side with enough detail to reproduce the failure.
 *
 * @returns AthleteContext with all fields populated, using fallbacks for any
 *   fields whose data fetch failed
 */
export async function buildAthleteContext(): Promise<AthleteContext> {
  const [
    todaysCheckinResult,
    recentCheckinsResult,
    weeklyAvgResult,
    recentSessionsResult,
    sessionCountResult,
    lastSessionDateResult,
    activeInjuryAreasResult,
  ] = await Promise.all([
    getTodaysCheckin(),
    getRecentCheckins(14),
    getAverageReadiness(7),
    getRecentSessions(30),
    getSessionCountThisWeek(),
    getLastSessionDate(),
    getActiveInjuryAreas(),
  ])

  // Extract data, logging any errors and falling back to safe defaults
  if (todaysCheckinResult.error !== null) {
    console.error('[contextBuilder.buildAthleteContext] getTodaysCheckin failed:', todaysCheckinResult.error)
  }
  const todaysReadiness: ReadinessCheckin | null = todaysCheckinResult.data ?? null

  if (recentCheckinsResult.error !== null) {
    console.error('[contextBuilder.buildAthleteContext] getRecentCheckins failed:', recentCheckinsResult.error)
  }
  const recentCheckins: ReadinessCheckin[] = recentCheckinsResult.data ?? []

  if (weeklyAvgResult.error !== null) {
    console.error('[contextBuilder.buildAthleteContext] getAverageReadiness failed:', weeklyAvgResult.error)
  }
  const weeklyReadinessAvg: number = weeklyAvgResult.data ?? 0

  if (recentSessionsResult.error !== null) {
    console.error('[contextBuilder.buildAthleteContext] getRecentSessions failed:', recentSessionsResult.error)
  }
  const recentSessions: SessionLog[] = recentSessionsResult.data ?? []

  if (sessionCountResult.error !== null) {
    console.error('[contextBuilder.buildAthleteContext] getSessionCountThisWeek failed:', sessionCountResult.error)
  }
  const sessionCountThisWeek: number = sessionCountResult.data ?? 0

  if (lastSessionDateResult.error !== null) {
    console.error('[contextBuilder.buildAthleteContext] getLastSessionDate failed:', lastSessionDateResult.error)
  }
  const lastSessionDate: string | null = lastSessionDateResult.data ?? null

  if (activeInjuryAreasResult.error !== null) {
    console.error('[contextBuilder.buildAthleteContext] getActiveInjuryAreas failed:', activeInjuryAreasResult.error)
  }
  const activeInjuryAreaRows: InjuryAreaRow[] = activeInjuryAreasResult.data ?? []

  const daysSinceLastSession = computeDaysSince(lastSessionDate)

  // Parse injury_area_health from today's check-in into typed objects.
  // Falls back to empty array if no check-in or field is null/malformed.
  const injuryAreas: InjuryAreaHealth[] = todaysReadiness?.injury_area_health != null
    ? parseInjuryAreaHealth(todaysReadiness.injury_area_health)
    : []

  // Derive critical / low subsets for downstream consumers (promptBuilder, etc.)
  const criticalInjuryAreas: string[] = injuryAreas
    .filter((a) => a.health <= 2)
    .map((a) => a.area)
  const lowInjuryAreas: string[] = injuryAreas
    .filter((a) => a.health === 3)
    .map((a) => a.area)

  // activeInjuryFlags: area names from any session in the last 30 days that
  // had injury_flags set. Derived from the recent sessions we already fetched.
  const activeInjuryFlags: string[] = [
    ...new Set(
      recentSessions.flatMap((s) => {
        const flags = s.injury_flags
        if (!Array.isArray(flags)) return []
        return flags.filter((f): f is string => typeof f === 'string')
      }),
    ),
  ]

  const warnings = computeWarnings(todaysReadiness, weeklyReadinessAvg, daysSinceLastSession, injuryAreas)

  // Derive convenience fields from most-recent check-in data
  const currentFingerHealth: number | null = todaysReadiness?.finger_health ?? null
  const currentShoulderHealth: number | null = todaysReadiness?.shoulder_health ?? null

  // illnessFlag is true if today's check-in has it set, or if any check-in
  // in the last 14 days has it set (athlete may not have checked in today)
  const illnessFlag: boolean =
    todaysReadiness?.illness_flag === true ||
    recentCheckins.some((c) => c.illness_flag === true)

  // activeInjuryAreaRows is fetched to surface in future profile endpoints;
  // its presence confirms the injury_areas table is accessible.
  void activeInjuryAreaRows

  return {
    todaysReadiness,
    weeklyReadinessAvg,
    recentCheckins,
    recentSessions,
    sessionCountThisWeek,
    lastSessionDate,
    daysSinceLastSession,
    currentFingerHealth,
    currentShoulderHealth,
    illnessFlag,
    injuryAreas,
    activeInjuryFlags,
    criticalInjuryAreas,
    lowInjuryAreas,
    warnings,
  }
}

/**
 * @description Converts an AthleteContext into a formatted text block ready
 * for injection into the Gemini system prompt. Sections are separated by
 * clear headers so the model can identify each data domain.
 *
 * Recent sessions are capped at 15 entries to keep prompt length manageable.
 * The readiness trend table shows the last 14 check-ins in ascending date order
 * (oldest first) so the model can read the trajectory left-to-right.
 *
 * @param context The assembled athlete context
 * @returns Formatted multi-line string ready for prompt injection
 */
export function formatContextForPrompt(context: AthleteContext): string {
  const lines: string[] = []

  // -------------------------------------------------------------------------
  // TODAY'S READINESS
  // -------------------------------------------------------------------------
  lines.push('=== TODAY\'S READINESS ===')

  if (context.todaysReadiness === null) {
    lines.push('No check-in completed today.')
  } else {
    const r = context.todaysReadiness
    lines.push(`Sleep quality:    ${r.sleep_quality}/5`)
    lines.push(`Fatigue:          ${r.fatigue}/5 (inverted: higher = more tired)`)
    lines.push(`Finger health:    ${r.finger_health}/5`)
    lines.push(`Life stress:      ${r.life_stress}/5 (inverted: higher = more stressed)`)
    lines.push(
      `Readiness score:  ${r.readiness_score !== null && r.readiness_score !== undefined ? r.readiness_score.toFixed(2) : 'N/A'}/5`,
    )
    lines.push(`Illness flag:     ${r.illness_flag ? 'Yes' : 'No'}`)

    // Injury areas from today's check-in
    if (context.injuryAreas.length > 0) {
      lines.push('Injury areas:')
      for (const { area, health, notes } of context.injuryAreas) {
        const notesText = notes ? ` (${notes})` : ''
        lines.push(`  ${area}: ${health}/5${notesText}`)
      }
    } else {
      lines.push('Injury areas:     None tracked')
    }

    lines.push(`Notes:            ${r.notes ?? 'None'}`)
  }

  lines.push('')

  // -------------------------------------------------------------------------
  // ACTIVE WARNINGS
  // -------------------------------------------------------------------------
  lines.push('=== ACTIVE WARNINGS ===')

  if (context.warnings.length === 0) {
    lines.push('No active warnings.')
  } else {
    for (const warning of context.warnings) {
      lines.push(warning)
    }
  }

  lines.push('')

  // -------------------------------------------------------------------------
  // TRAINING LOAD THIS WEEK
  // -------------------------------------------------------------------------
  lines.push('=== TRAINING LOAD THIS WEEK ===')
  lines.push(`Sessions completed: ${context.sessionCountThisWeek}`)
  lines.push(
    `Days since last session: ${context.daysSinceLastSession === 999 ? 'No previous sessions' : String(context.daysSinceLastSession)}`,
  )

  lines.push('')

  // -------------------------------------------------------------------------
  // RECENT SESSIONS
  // -------------------------------------------------------------------------
  lines.push('=== RECENT SESSIONS (last 30 days) ===')

  if (context.recentSessions.length === 0) {
    lines.push('No sessions logged yet.')
  } else {
    const MAX_SESSIONS = 15
    const displayed = context.recentSessions.slice(0, MAX_SESSIONS)
    const overflow = context.recentSessions.length - MAX_SESSIONS

    for (const session of displayed) {
      const date = session.date
      const type = session.session_type
      const duration = session.duration_mins !== null ? `${session.duration_mins}min` : '?min'
      const rpe = session.rpe !== null ? `RPE ${session.rpe}/10` : 'RPE ?/10'
      const quality =
        session.quality_rating !== null ? `Quality ${session.quality_rating}/5` : 'Quality ?/5'
      lines.push(`${date} ${type} — ${duration}, ${rpe}, ${quality}`)
      if (session.notes) {
        lines.push(`  ${session.notes}`)
      }
    }

    if (overflow > 0) {
      lines.push(`(+${overflow} more sessions not shown)`)
    }
  }

  lines.push('')

  // -------------------------------------------------------------------------
  // READINESS TREND
  // -------------------------------------------------------------------------
  lines.push('=== READINESS TREND (last 14 days) ===')

  if (context.recentCheckins.length === 0) {
    lines.push('No readiness data yet.')
  } else {
    // Display oldest-first so the model reads the trajectory chronologically
    const sorted = [...context.recentCheckins].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )

    lines.push('Date        Score  Finger  Injuries  Illness')
    for (const c of sorted) {
      const score =
        c.readiness_score !== null && c.readiness_score !== undefined
          ? c.readiness_score.toFixed(2).padStart(5)
          : '  N/A'
      const finger = String(c.finger_health).padStart(6)
      const injuryAreas = parseInjuryAreaHealth(c.injury_area_health)
      const injurySummary = injuryAreas.length > 0
        ? injuryAreas.map((a) => `${a.area}:${a.health}`).join(',')
        : 'none'
      const illness = (c.illness_flag ? 'Yes' : 'No').padStart(9)
      lines.push(`${c.date}  ${score}  ${finger}  ${injurySummary}  ${illness}`)
    }
  }

  return lines.join('\n')
}
