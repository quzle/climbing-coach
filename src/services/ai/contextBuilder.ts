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
import type { AthleteContext, ReadinessCheckin, SessionLog } from '@/types'

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
 * @description Evaluates athlete readiness metrics and returns
 * human-readable warning strings for the AI coach to act on.
 * Rules are applied in priority order: illness → finger → shoulder →
 * weekly average → return-to-training → missing check-in.
 *
 * @param todaysReadiness Today's readiness check-in, or null if not submitted
 * @param weeklyAvg Mean readiness score over the past 7 days (0–5 scale)
 * @param daysSinceLastSession Number of days since the last logged session
 * @returns Array of warning strings, empty if no warnings apply
 */
function computeWarnings(
  todaysReadiness: ReadinessCheckin | null,
  weeklyAvg: number,
  daysSinceLastSession: number,
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

  // --- SHOULDER HEALTH ---
  const shoulder = todaysReadiness?.shoulder_health ?? null
  if (shoulder !== null && (shoulder === 1 || shoulder === 2)) {
    warnings.push(
      `🔴 Shoulder health critical (${shoulder}/5) — remove ALL pressing movements, scapular stability and band work only.`,
    )
  } else if (shoulder === 3) {
    warnings.push(
      '🟡 Shoulder health low (3/5) — avoid heavy pressing, monitor carefully during session.',
    )
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
  ] = await Promise.all([
    getTodaysCheckin(),
    getRecentCheckins(14),
    getAverageReadiness(7),
    getRecentSessions(30),
    getSessionCountThisWeek(),
    getLastSessionDate(),
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

  const daysSinceLastSession = computeDaysSince(lastSessionDate)
  const warnings = computeWarnings(todaysReadiness, weeklyReadinessAvg, daysSinceLastSession)

  // Derive convenience fields from most-recent check-in data
  const currentFingerHealth: number | null = todaysReadiness?.finger_health ?? null
  const currentShoulderHealth: number | null = todaysReadiness?.shoulder_health ?? null

  // illnessFlag is true if today's check-in has it set, or if any check-in
  // in the last 14 days has it set (athlete may not have checked in today)
  const illnessFlag: boolean =
    todaysReadiness?.illness_flag === true ||
    recentCheckins.some((c) => c.illness_flag === true)

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
    lines.push(`Shoulder health:  ${r.shoulder_health}/5`)
    lines.push(`Life stress:      ${r.life_stress}/5 (inverted: higher = more stressed)`)
    lines.push(
      `Readiness score:  ${r.readiness_score !== null && r.readiness_score !== undefined ? r.readiness_score.toFixed(2) : 'N/A'}/5`,
    )
    lines.push(`Illness flag:     ${r.illness_flag ? 'Yes' : 'No'}`)
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

    lines.push('Date        Score  Finger  Shoulder  Illness')
    for (const c of sorted) {
      const score =
        c.readiness_score !== null && c.readiness_score !== undefined
          ? c.readiness_score.toFixed(2).padStart(5)
          : '  N/A'
      const finger = String(c.finger_health).padStart(6)
      const shoulder = String(c.shoulder_health).padStart(8)
      const illness = (c.illness_flag ? 'Yes' : 'No').padStart(9)
      lines.push(`${c.date}  ${score}  ${finger}  ${shoulder}  ${illness}`)
    }
  }

  return lines.join('\n')
}
