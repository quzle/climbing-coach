import { createClient } from '@/lib/supabase/server'
import type {
  ApiResponse,
  SessionLog,
  SessionLogInsert,
  SessionLogUpdate,
  SessionType,
} from '@/types'

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * Type guard: checks that a value has an `attempts` array property.
 * Used to safely narrow `unknown` log_data before accessing nested fields.
 */
function hasAttempts(value: unknown): value is { attempts: unknown[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'attempts' in value &&
    Array.isArray((value as { attempts: unknown }).attempts)
  )
}

/**
 * Type guard: checks that a single attempt has `result` and `grade` strings.
 */
function isCompletedClimbingAttempt(
  attempt: unknown,
): attempt is { result: string; grade: string } {
  return (
    typeof attempt === 'object' &&
    attempt !== null &&
    'result' in attempt &&
    'grade' in attempt &&
    typeof (attempt as { result: unknown }).result === 'string' &&
    typeof (attempt as { grade: unknown }).grade === 'string'
  )
}

/**
 * @description Extracts the best grade achieved in a climbing session from the
 * jsonb log_data field. Handles the `unknown` type safely using type guards —
 * never casts directly.
 *
 * Only considers attempts where result is 'flash' or 'send'.
 *
 * TODO (Phase 3): Implement proper Fontainebleau grade sorting so we return
 * the hardest completed grade rather than the last one in the array.
 *
 * @param logData Raw value from session_logs.log_data
 * @returns Grade string of the last completed attempt, or null if none
 */
function extractBestGrade(logData: unknown): string | null {
  if (!hasAttempts(logData)) return null

  const completedAttempts = logData.attempts
    .filter(isCompletedClimbingAttempt)
    .filter(
      (attempt) => attempt.result === 'flash' || attempt.result === 'send',
    )

  if (completedAttempts.length === 0) return null

  // Returns the last completed attempt's grade.
  // Phase 3 will replace this with proper grade ordering.
  return completedAttempts[completedAttempts.length - 1]?.grade ?? null
}

/**
 * @description Returns true if the session type involves climbing attempts.
 * Used to filter sessions eligible for grade progression queries.
 *
 * @param sessionType The session type to check
 * @returns Whether the session type records climbing attempts
 */
function isClimbingSession(sessionType: SessionType): boolean {
  return (
    sessionType === 'bouldering' ||
    sessionType === 'kilterboard' ||
    sessionType === 'lead'
  )
}

/** Returns today's date as an ISO date string (YYYY-MM-DD). */
function today(): string {
  return new Date().toISOString().split('T')[0]!
}

/** Returns the ISO date string for Monday of the current calendar week. */
function getMondayOfCurrentWeek(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  return monday.toISOString().split('T')[0]!
}

/** Returns an ISO date string n days before today, inclusive of today. */
function daysAgoDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  return d.toISOString().split('T')[0]!
}

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS
// =============================================================================

/**
 * @description Fetches session logs for the last n days, ordered most recent
 * first.
 *
 * @param days Number of days to look back (e.g. 7, 30)
 * @returns Array of session logs ordered by date descending
 */
export async function getRecentSessions(
  days: number,
): Promise<ApiResponse<SessionLog[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('session_logs')
      .select('*')
      .gte('date', daysAgoDate(days))
      .lte('date', today())
      .order('date', { ascending: false })

    if (error) {
      console.error('[sessionRepository.getRecentSessions]', error)
      return { data: null, error: 'Failed to fetch recent sessions' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error('[sessionRepository.getRecentSessions] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches a single session log by its UUID. Returns an error if
 * no matching record exists.
 *
 * @param id The session UUID
 * @returns The matching session log record
 */
export async function getSessionById(
  id: string,
): Promise<ApiResponse<SessionLog>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('session_logs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('[sessionRepository.getSessionById]', error)
      return { data: null, error: 'Failed to fetch session' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[sessionRepository.getSessionById] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Inserts a new session log record and returns the created row.
 *
 * @param input The session data to insert
 * @returns The newly created session log
 */
export async function createSession(
  input: SessionLogInsert,
): Promise<ApiResponse<SessionLog>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('session_logs')
      .insert(input)
      .select()
      .single()

    if (error) {
      console.error('[sessionRepository.createSession]', error)
      return { data: null, error: 'Failed to create session' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[sessionRepository.createSession] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Updates fields on an existing session log and returns the
 * updated record. Only the fields present in `updates` are changed.
 *
 * @param id The session UUID to update
 * @param updates Partial session fields to apply
 * @returns The updated session log record
 */
export async function updateSession(
  id: string,
  updates: SessionLogUpdate,
): Promise<ApiResponse<SessionLog>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('session_logs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[sessionRepository.updateSession]', error)
      return { data: null, error: 'Failed to update session' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[sessionRepository.updateSession] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Updates only the deviation_from_plan field on a session.
 * Convenience wrapper around updateSession for the common case of recording
 * how a session deviated from what was planned.
 *
 * @param id The session UUID
 * @param deviation Free-text description of how the session deviated from plan
 * @returns The updated session log record
 */
export async function updateSessionDeviation(
  id: string,
  deviation: string,
): Promise<ApiResponse<SessionLog>> {
  return updateSession(id, { deviation_from_plan: deviation })
}

/**
 * @description Fetches sessions of a specific type for the last n days,
 * ordered most recent first.
 *
 * @param type The session type to filter by (e.g. 'bouldering', 'fingerboard')
 * @param days Number of days to look back
 * @returns Array of matching session logs ordered by date descending
 */
export async function getSessionsByType(
  type: SessionType,
  days: number,
): Promise<ApiResponse<SessionLog[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('session_logs')
      .select('*')
      .eq('session_type', type)
      .gte('date', daysAgoDate(days))
      .lte('date', today())
      .order('date', { ascending: false })

    if (error) {
      console.error('[sessionRepository.getSessionsByType]', error)
      return { data: null, error: 'Failed to fetch sessions by type' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error(
      '[sessionRepository.getSessionsByType] unexpected error',
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches all sessions between two dates inclusive, ordered
 * oldest first. Intended for charting where chronological order matters.
 *
 * @param startDate ISO date string 'YYYY-MM-DD' (inclusive)
 * @param endDate ISO date string 'YYYY-MM-DD' (inclusive)
 * @returns Array of session logs ordered by date ascending
 */
export async function getSessionsInDateRange(
  startDate: string,
  endDate: string,
): Promise<ApiResponse<SessionLog[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('session_logs')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) {
      console.error('[sessionRepository.getSessionsInDateRange]', error)
      return { data: null, error: 'Failed to fetch sessions in date range' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error(
      '[sessionRepository.getSessionsInDateRange] unexpected error',
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Returns the count of sessions logged in the current calendar
 * week (Monday to today inclusive). Used on the home dashboard training
 * summary.
 *
 * @returns Number of sessions logged since Monday of the current week
 */
export async function getSessionCountThisWeek(): Promise<ApiResponse<number>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('session_logs')
      .select('id')
      .gte('date', getMondayOfCurrentWeek())
      .lte('date', today())

    if (error) {
      console.error('[sessionRepository.getSessionCountThisWeek]', error)
      return { data: null, error: 'Failed to count sessions this week' }
    }

    return { data: data?.length ?? 0, error: null }
  } catch (err) {
    console.error(
      '[sessionRepository.getSessionCountThisWeek] unexpected error',
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Returns the date of the most recent session as an ISO date
 * string, or null if no sessions have been logged yet. Used to calculate
 * days since last session for the AI coaching context.
 *
 * @returns ISO date string of the most recent session, or null
 */
export async function getLastSessionDate(): Promise<
  ApiResponse<string | null>
> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('session_logs')
      .select('date')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[sessionRepository.getLastSessionDate]', error)
      return { data: null, error: 'Failed to fetch last session date' }
    }

    return { data: data?.date ?? null, error: null }
  } catch (err) {
    console.error(
      '[sessionRepository.getLastSessionDate] unexpected error',
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Returns grade data for all climbing sessions suitable for
 * rendering a grade progression chart. Filters to bouldering, kilterboard,
 * and lead session types, extracts the best grade from each session's
 * log_data, and excludes sessions where no grade could be extracted.
 *
 * Results are ordered oldest first for direct use as chart data.
 *
 * TODO (Phase 3): Add date range filtering to avoid loading the full history
 * as the session_logs table grows.
 *
 * @returns Array of { date, best_grade, session_type } ordered by date ascending
 */
export async function getGradeProgressionData(): Promise<
  ApiResponse<{ date: string; best_grade: string; session_type: SessionType }[]>
> {
  try {
    const supabase = await createClient()
    const climbingTypes: SessionType[] = ['bouldering', 'kilterboard', 'lead']

    const { data, error } = await supabase
      .from('session_logs')
      .select('date, session_type, log_data')
      .in('session_type', climbingTypes)
      .order('date', { ascending: true })

    if (error) {
      console.error('[sessionRepository.getGradeProgressionData]', error)
      return { data: null, error: 'Failed to fetch grade progression data' }
    }

    const progressionData = (data ?? [])
      .map((row) => {
        const bestGrade = extractBestGrade(row.log_data)
        if (!bestGrade) return null
        return {
          date: row.date,
          best_grade: bestGrade,
          // Safe: we already filtered with .in() to only include climbing types
          session_type: row.session_type as SessionType,
        }
      })
      .filter(
        (
          entry,
        ): entry is {
          date: string
          best_grade: string
          session_type: SessionType
        } => entry !== null,
      )

    return { data: progressionData, error: null }
  } catch (err) {
    console.error(
      '[sessionRepository.getGradeProgressionData] unexpected error',
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}
