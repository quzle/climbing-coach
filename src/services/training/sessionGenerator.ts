import { getActiveMesocycle } from '@/services/data/mesocycleRepository'
import {
  createPlannedSession,
  getPlannedSessionsInRange,
} from '@/services/data/plannedSessionRepository'
import { getWeeklyTemplateByMesocycle } from '@/services/data/weeklyTemplateRepository'
import { SINGLE_USER_PLACEHOLDER_ID } from '@/lib/placeholder-user-id'
import type { ApiResponse, Mesocycle, PlannedSession, WeeklyTemplate } from '@/types'

/** Returns YYYY-MM-DD for a Date in UTC-safe format. */
function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0]!
}

/** Parses an ISO date (YYYY-MM-DD) to a UTC Date at midnight. */
function parseIsoDateUtc(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1))
}

/** Returns today as a UTC midnight Date object. */
function todayUtcDate(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** Returns an ISO date string n days after the given UTC Date. */
function addDays(date: Date, days: number): string {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return toIsoDate(result)
}

/**
 * @description Returns the UTC midnight Date of the Monday that starts the
 * calendar week containing `date`. DB convention: week starts on Monday.
 * @param date Any UTC Date within the target week
 * @returns The UTC midnight Date of the Monday starting the week containing `date`
 */
function weekStartMonday(date: Date): Date {
  // JS getUTCDay(): 0=Sun…6=Sat. Convert to offset from Monday (0=Mon…6=Sun).
  const daysFromMonday = (date.getUTCDay() + 6) % 7
  const monday = new Date(date)
  monday.setUTCDate(date.getUTCDate() - daysFromMonday)
  return monday
}

/**
 * @description Returns the next date on or after `fromDate` whose day of week
 * matches `dbDayOfWeek` (0=Mon … 6=Sun).
 */
function nextOccurrenceOfDay(dbDayOfWeek: number, fromDate: Date): string {
  // DB: 0=Mon…6=Sun  →  JS getUTCDay(): 0=Sun…6=Sat
  const targetJsDay = (dbDayOfWeek + 1) % 7
  const daysUntil = (targetJsDay - fromDate.getUTCDay() + 7) % 7
  return addDays(fromDate, daysUntil)
}

/**
 * @description Generates planned sessions for every weekly occurrence in the
 * active mesocycle from `fromDate` to `activeMesocycle.planned_end`.
 * Sessions are stored with template metadata only — AI plan text is generated
 * lazily on first access via POST /api/planned-sessions/:id/generate-plan.
 * Existing planned sessions for matching date+template are left untouched
 * to prevent duplicates on re-runs.
 *
 * @param fromDateStr Optional ISO date whose week to generate sessions for (defaults to today's week)
 * @returns Array of newly created planned sessions for the full mesocycle
 */
export async function generatePlannedSessionsForActiveMesocycle(
  fromDateStr?: string,
): Promise<ApiResponse<PlannedSession[]>> {
  try {
    // Use the Monday of the week containing the provided date (or today's week
    // when no date is given). This ensures all template days in the requested
    // week are generated, including days that precede the requested date itself.
    const requestedDate = fromDateStr ? parseIsoDateUtc(fromDateStr) : todayUtcDate()
    const fromDate = weekStartMonday(requestedDate)

    // Fetch the mesocycle first so we can use planned_end as the range boundary.
    const mesocycleResult = await getActiveMesocycle(SINGLE_USER_PLACEHOLDER_ID)
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

    // Fetch templates and existing sessions in parallel now that we have the
    // mesocycle end date for the range query.
    const [templatesResult, existingSessionsResult] = await Promise.all([
      getWeeklyTemplateByMesocycle(activeMesocycle.id),
      getPlannedSessionsInRange(toIsoDate(fromDate), activeMesocycle.planned_end),
    ])

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

    for (const template of templates) {
      // Start on the first occurrence of this weekday on or after fromDate,
      // then advance by 7 days each iteration until the mesocycle ends.
      let cursor = parseIsoDateUtc(nextOccurrenceOfDay(template.day_of_week, fromDate))

      while (toIsoDate(cursor) <= activeMesocycle.planned_end) {
        const plannedDate = toIsoDate(cursor)
        const dedupeKey = `${plannedDate}:${template.id}`

        if (!existingByDateTemplate.has(dedupeKey)) {
          // Store template metadata only — AI plan text is generated lazily
          // on first access to avoid upfront token cost and stale context.
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
            },
            user_id: SINGLE_USER_PLACEHOLDER_ID,
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

        // Advance to the same weekday next week.
        cursor = new Date(cursor)
        cursor.setUTCDate(cursor.getUTCDate() + 7)
      }
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
