import { createClient } from '@/lib/supabase/server'
import type {
  ApiResponse,
  ReadinessCheckin,
  ReadinessCheckinInsert,
} from '@/types'

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * @description Computes a composite readiness score from the five subjective
 * check-in metrics. All inputs are on a 1–5 scale.
 *
 * Weightings and rationale:
 *   sleep_quality   × 0.25 — sleep is the primary recovery driver
 *   fatigue         × 0.30 — highest weight; chronic fatigue is the main
 *                            training load signal (inverted: high fatigue → low score)
 *   finger_health   × 0.20 — injury risk gating; low score blocks finger-intensive sessions
 *   shoulder_health × 0.15 — secondary injury signal
 *   life_stress     × 0.10 — contextual; affects recovery quality
 *                            (inverted: high stress → low score)
 *
 * Inversion: fatigue and life_stress are "bad when high", so we subtract from 6
 * to flip them into a "good when high" scale consistent with the others.
 *
 * @param data The raw check-in values before insertion
 * @returns Readiness score rounded to 2 decimal places
 */
function calculateReadinessScore(data: ReadinessCheckinInsert): number {
  const score =
    data.sleep_quality * 0.25 +
    (6 - data.fatigue) * 0.3 +
    data.finger_health * 0.2 +
    data.shoulder_health * 0.15 +
    (6 - data.life_stress) * 0.1

  return Math.round(score * 100) / 100
}

/** Returns today's date as an ISO date string (YYYY-MM-DD). */
function today(): string {
  return new Date().toISOString().split('T')[0]!
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
 * @description Fetches today's readiness check-in if one has been submitted.
 * Returns `data: null` (not an error) when no check-in exists yet — callers
 * should treat a null result as "not checked in today" rather than a failure.
 *
 * @returns The check-in record for today, or null if none exists
 */
export async function getTodaysCheckin(): Promise<
  ApiResponse<ReadinessCheckin | null>
> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('readiness_checkins')
      .select('*')
      .eq('date', today())
      .maybeSingle()

    if (error) {
      console.error('[readinessRepository.getTodaysCheckin]', error)
      return { data: null, error: 'Failed to fetch today\'s check-in' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[readinessRepository.getTodaysCheckin] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches readiness check-ins for the last n days, ordered
 * most recent first. Today is always included in the range.
 *
 * @param days Number of days to look back (e.g. 7, 14, 30)
 * @returns Array of check-ins ordered by date descending
 */
export async function getRecentCheckins(
  days: number,
): Promise<ApiResponse<ReadinessCheckin[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('readiness_checkins')
      .select('*')
      .gte('date', daysAgoDate(days))
      .lte('date', today())
      .order('date', { ascending: false })

    if (error) {
      console.error('[readinessRepository.getRecentCheckins]', error)
      return { data: null, error: 'Failed to fetch recent check-ins' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error('[readinessRepository.getRecentCheckins] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Creates a new readiness check-in for today. Automatically
 * computes the composite readiness_score before inserting — callers should
 * not pass readiness_score in the input payload.
 *
 * @param input Check-in values excluding readiness_score (computed internally)
 * @returns The newly created check-in record
 */
export async function createCheckin(
  input: Omit<ReadinessCheckinInsert, 'readiness_score'>,
): Promise<ApiResponse<ReadinessCheckin>> {
  try {
    const supabase = await createClient()
    const readiness_score = calculateReadinessScore(input)

    const { data, error } = await supabase
      .from('readiness_checkins')
      .insert({ ...input, readiness_score })
      .select()
      .single()

    if (error) {
      console.error('[readinessRepository.createCheckin]', error)
      return { data: null, error: 'Failed to create check-in' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[readinessRepository.createCheckin] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Checks whether a readiness check-in has already been submitted
 * today. Used by the API route to prevent duplicate entries.
 *
 * @returns `true` if a check-in exists for today, `false` otherwise
 */
export async function hasCheckedInToday(): Promise<ApiResponse<boolean>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('readiness_checkins')
      .select('id')
      .eq('date', today())
      .maybeSingle()

    if (error) {
      console.error('[readinessRepository.hasCheckedInToday]', error)
      return { data: null, error: 'Failed to check today\'s check-in status' }
    }

    return { data: data !== null, error: null }
  } catch (err) {
    console.error('[readinessRepository.hasCheckedInToday] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Calculates the mean readiness_score across the last n days.
 * Returns 0 if no check-ins exist in the period rather than null, so callers
 * can use the result directly in arithmetic without null guards.
 *
 * @param days Number of days to average over
 * @returns Average readiness score rounded to 2 decimal places, or 0 if no data
 */
export async function getAverageReadiness(
  days: number,
): Promise<ApiResponse<number>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('readiness_checkins')
      .select('readiness_score')
      .gte('date', daysAgoDate(days))
      .lte('date', today())

    if (error) {
      console.error('[readinessRepository.getAverageReadiness]', error)
      return { data: null, error: 'Failed to calculate average readiness' }
    }

    if (!data || data.length === 0) {
      return { data: 0, error: null }
    }

    const scores = data
      .map((row) => row.readiness_score)
      .filter((s): s is number => s !== null)

    if (scores.length === 0) {
      return { data: 0, error: null }
    }

    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length
    return { data: Math.round(avg * 100) / 100, error: null }
  } catch (err) {
    console.error('[readinessRepository.getAverageReadiness] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Returns readiness scores as a time series for charting.
 * Ordered by date ascending (oldest first) so the array maps directly
 * onto a left-to-right chart x-axis without client-side sorting.
 *
 * @param days Number of days to include in the series
 * @returns Array of { date, score } objects ordered oldest first
 */
export async function getReadinessTrend(
  days: number,
): Promise<ApiResponse<{ date: string; score: number }[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('readiness_checkins')
      .select('date, readiness_score')
      .gte('date', daysAgoDate(days))
      .lte('date', today())
      .order('date', { ascending: true })

    if (error) {
      console.error('[readinessRepository.getReadinessTrend]', error)
      return { data: null, error: 'Failed to fetch readiness trend' }
    }

    const trend = (data ?? [])
      .filter((row): row is { date: string; readiness_score: number } =>
        row.readiness_score !== null,
      )
      .map((row) => ({ date: row.date, score: row.readiness_score }))

    return { data: trend, error: null }
  } catch (err) {
    console.error('[readinessRepository.getReadinessTrend] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}
