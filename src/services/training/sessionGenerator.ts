import { buildAthleteContext } from '@/services/ai/contextBuilder'
import { generateSessionPlan } from '@/services/ai/geminiClient'
import { getActiveMesocycle } from '@/services/data/mesocycleRepository'
import {
  createPlannedSession,
  getPlannedSessionsInRange,
} from '@/services/data/plannedSessionRepository'
import { getWeeklyTemplateByMesocycle } from '@/services/data/weeklyTemplateRepository'
import type {
  ApiResponse,
  Mesocycle,
  PlannedSession,
  SessionLog,
  WeeklyTemplate,
} from '@/types'

/** Returns YYYY-MM-DD for a Date in UTC-safe format. */
function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0]!
}

/** Returns today's date as a YYYY-MM-DD string in UTC. */
function todayUtc(): string {
  const now = new Date()
  return toIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())))
}

/** Parses an ISO date (YYYY-MM-DD) to a UTC Date at midnight. */
function parseIsoDateUtc(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1))
}

/**
 * @description Normalises a date string to the Monday of that week.
 * @param dateString Optional ISO date string
 * @returns ISO date for Monday of the given/current week
 */
function getWeekStartMonday(dateString?: string): string {
  const date = dateString
    ? parseIsoDateUtc(dateString)
    : new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate(),
        ),
      )
  const jsDay = date.getUTCDay()
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay
  date.setUTCDate(date.getUTCDate() + mondayOffset)
  return toIsoDate(date)
}

/**
 * @description Converts weekly_templates.day_of_week to a concrete ISO date
 * within the specified Monday-start week.
 * @param weekStartMonday ISO date of week start (Monday)
 * @param dayOfWeek DB day (0=Mon ... 6=Sun)
 * @returns Planned date in YYYY-MM-DD format
 */
function resolvePlannedDate(weekStartMonday: string, dayOfWeek: number): string {
  const safeDay = Math.min(Math.max(dayOfWeek, 0), 6)
  const offsetDays = safeDay
  const plannedDate = parseIsoDateUtc(weekStartMonday)
  plannedDate.setUTCDate(plannedDate.getUTCDate() + offsetDays)
  return toIsoDate(plannedDate)
}

/**
 * @description Returns the latest same-type session from the supplied history.
 * @param sessions Recent sessions, newest first
 * @param sessionType Target session type
 * @returns Most recent matching session or null
 */
function getLatestSameTypeSession(
  sessions: SessionLog[],
  sessionType: string,
): SessionLog | null {
  return sessions.find((s) => s.session_type === sessionType) ?? null
}

/**
 * @description Builds extra generation guidance for Gemini using current
 * phase, template metadata, previous same-type session, and readiness trend.
 * @param mesocycle Active mesocycle context
 * @param template Template slot being generated
 * @param recentSessions Recent athlete sessions
 * @param readinessAvg 7-day readiness average
 * @returns Context string appended to the generation instruction
 */
function buildAdditionalContext(
  mesocycle: Mesocycle,
  template: WeeklyTemplate,
  recentSessions: SessionLog[],
  readinessAvg: number,
): string {
  const lastSameType = getLatestSameTypeSession(recentSessions, template.session_type)

  const lines = [
    `Mesocycle: ${mesocycle.name}`,
    `Phase type: ${mesocycle.phase_type}`,
    `Mesocycle focus: ${mesocycle.focus}`,
    `Template session label: ${template.session_label}`,
    `Template intensity: ${template.intensity}`,
    `Template target duration: ${template.duration_mins ?? 'unspecified'} minutes`,
    `Template primary focus: ${template.primary_focus ?? 'not specified'}`,
    `Current 7-day readiness average: ${readinessAvg.toFixed(2)}/5`,
  ]

  if (lastSameType !== null) {
    lines.push(`Last ${template.session_type} session date: ${lastSameType.date}`)
    lines.push(
      `Last ${template.session_type} quality/rpe: ${lastSameType.quality_rating ?? 'N/A'}/5, ${lastSameType.rpe ?? 'N/A'}/10`,
    )
    lines.push(`Last ${template.session_type} notes: ${lastSameType.notes ?? 'none'}`)
  } else {
    lines.push(`No recent ${template.session_type} session found in the last 30 days.`)
  }

  lines.push(
    'Apply progressive overload conservatively (typically +/-10-20% volume) based on readiness and previous same-type session response.',
  )

  return lines.join('\n')
}

/**
 * @description Generates planned sessions for the active mesocycle for a
 * Monday-start week. Existing planned sessions for matching date+template are
 * left untouched to prevent duplicates.
 *
 * @param weekStartDate Optional ISO date to control which week is generated
 * @returns Array of newly created planned sessions for the target week
 */
export async function generatePlannedSessionsForActiveMesocycle(
  weekStartDate?: string,
): Promise<ApiResponse<PlannedSession[]>> {
  try {
    const normalizedWeekStart = getWeekStartMonday(weekStartDate)
    const weekEnd = resolvePlannedDate(normalizedWeekStart, 7)

    const [mesocycleResult, athleteContext, existingSessionsResult] = await Promise.all([
      getActiveMesocycle(),
      buildAthleteContext(),
      getPlannedSessionsInRange(normalizedWeekStart, weekEnd),
    ])

    if (mesocycleResult.error !== null) {
      console.error(
        '[sessionGenerator.generatePlannedSessionsForActiveMesocycle] getActiveMesocycle:',
        mesocycleResult.error,
      )
      return { data: null, error: mesocycleResult.error }
    }

    const activeMesocycle = mesocycleResult.data
    if (activeMesocycle === null) {
      return { data: [], error: null }
    }

    const templatesResult = await getWeeklyTemplateByMesocycle(activeMesocycle.id)
    if (templatesResult.error !== null) {
      console.error(
        '[sessionGenerator.generatePlannedSessionsForActiveMesocycle] getWeeklyTemplateByMesocycle:',
        templatesResult.error,
      )
      return { data: null, error: templatesResult.error }
    }

    const templates = (templatesResult.data ?? []).sort(
      (a, b) => a.day_of_week - b.day_of_week,
    )
    if (templates.length === 0) {
      return { data: [], error: null }
    }

    const existingSessions = existingSessionsResult.data ?? []
    const existingByDateTemplate = new Set(
      existingSessions
        .filter((session) => session.template_id !== null)
        .map((session) => `${session.planned_date}:${session.template_id}`),
    )

    const createdSessions: PlannedSession[] = []

    const today = todayUtc()

    for (const template of templates) {
      const plannedDate = resolvePlannedDate(normalizedWeekStart, template.day_of_week)

      // Skip dates in the past — sessions must be today or later.
      if (plannedDate < today) {
        continue
      }

      // Skip dates outside the active mesocycle's planned window.
      if (plannedDate > activeMesocycle.planned_end) {
        continue
      }

      const dedupeKey = `${plannedDate}:${template.id}`
      if (existingByDateTemplate.has(dedupeKey)) {
        continue
      }

      const additionalContext = buildAdditionalContext(
        activeMesocycle,
        template,
        athleteContext.recentSessions,
        athleteContext.weeklyReadinessAvg,
      )

      const aiPlanText = await generateSessionPlan(template.session_type, additionalContext)

      const createResult = await createPlannedSession({
        mesocycle_id: activeMesocycle.id,
        template_id: template.id,
        planned_date: plannedDate,
        session_type: template.session_type,
        status: 'planned',
        generation_notes: `Auto-generated for ${activeMesocycle.phase_type} phase`,
        generated_plan: {
          session_label: template.session_label,
          intensity: template.intensity,
          primary_focus: template.primary_focus,
          duration_mins: template.duration_mins,
          ai_plan_text: aiPlanText,
          readiness_avg_7d: Number(athleteContext.weeklyReadinessAvg.toFixed(2)),
        },
      })

      if (createResult.error !== null || createResult.data === null) {
        console.error(
          '[sessionGenerator.generatePlannedSessionsForActiveMesocycle] createPlannedSession:',
          createResult.error,
        )
        return {
          data: null,
          error: createResult.error ?? 'Failed to create planned session',
        }
      }

      createdSessions.push(createResult.data)
    }

    return { data: createdSessions, error: null }
  } catch (err) {
    console.error(
      '[sessionGenerator.generatePlannedSessionsForActiveMesocycle] unexpected error',
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}
