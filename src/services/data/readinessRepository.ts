import { createClient } from '@/lib/supabase/server'
import type {
  ApiResponse,
  InjuryAreaHealth,
  ReadinessCheckin,
  ReadinessCheckinInsert,
} from '@/types'

type SupabaseErrorShape = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

/**
 * @description Computes a composite readiness score from the five subjective
 * check-in metrics. All inputs are on a 1–5 scale.
 *
 * Weightings and rationale:
 *   sleep_quality      × 0.25 — sleep is the primary recovery driver
 *   fatigue            × 0.30 — highest weight; chronic fatigue is the main
 *                               training load signal (inverted: high fatigue → low score)
 *   finger_health      × 0.20 — injury risk gating; low score blocks finger-intensive sessions
 *   generalInjuryHealth × 0.15 — minimum health score across all tracked injury areas;
 *                               defaults to 5 when no areas are tracked.
 *                               Replaces the Phase 1 shoulder_health × 0.15 term. (ADR 004)
 *   life_stress        × 0.10 — contextual; affects recovery quality
 *                               (inverted: high stress → low score)
 *
 * Inversion: fatigue and life_stress are "bad when high", so we subtract from 6
 * to flip them into a "good when high" scale consistent with the others.
 *
 * @param data The raw check-in values before insertion
 * @param injuryAreaHealth Optional list of injury area health ratings from the check-in
 * @returns Readiness score rounded to 2 decimal places
 */
function calculateReadinessScore(
  data: ReadinessCheckinInsert,
  injuryAreaHealth: InjuryAreaHealth[],
): number {
  // Derive a single injury health signal: minimum across all tracked areas.
  // When no areas are tracked we default to 5 (no restrictions), keeping
  // the score equivalent to the Phase 1 shoulder_health = 5 baseline.
  const generalInjuryHealth =
    injuryAreaHealth.length > 0
      ? Math.min(...injuryAreaHealth.map((a) => a.health))
      : 5

  const score =
    data.sleep_quality * 0.25 +
    (6 - data.fatigue) * 0.3 +
    data.finger_health * 0.2 +
    generalInjuryHealth * 0.15 +
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
 * @param injuryAreaHealth Current health ratings for each tracked injury area
 * @returns The newly created check-in record
 */
export async function createCheckin(
  input: Omit<ReadinessCheckinInsert, 'readiness_score'>,
  injuryAreaHealth: InjuryAreaHealth[] = [],
): Promise<ApiResponse<ReadinessCheckin>> {
  try {
    const supabase = await createClient()
    const readiness_score = calculateReadinessScore(input, injuryAreaHealth)
    const insertPayload: ReadinessCheckinInsert = {
      ...input,
      readiness_score,
      injury_area_health: injuryAreaHealth,
    }

    const { data, error } = await supabase
      .from('readiness_checkins')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      const supabaseError = error as SupabaseErrorShape
      console.error('[readinessRepository.createCheckin]', {
        code: supabaseError.code,
        message: supabaseError.message,
        details: supabaseError.details,
        hint: supabaseError.hint,
      })

      if (supabaseError.code === '23505') {
        return {
          data: null,
          error: 'Already checked in today. Only one check-in per day is allowed.',
        }
      }

      if (supabaseError.code === '42501' || supabaseError.code === 'PGRST301') {
        return {
          data: null,
          error: 'Not authorized to create check-in. Please sign in again.',
        }
      }

      if (
        supabaseError.code === 'PGRST204' ||
        supabaseError.code === '42703' ||
        supabaseError.code === '42P01'
      ) {
        return {
          data: null,
          error: 'Readiness database schema is out of date. Apply latest Supabase migrations.',
        }
      }

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
/**
 * @description Deletes today's readiness check-in by date. Used to allow the
 * athlete to reset and resubmit their check-in on the same day.
 * @returns The deleted check-in row, or an error if none exists.
 */
export async function deleteTodaysCheckin(): Promise<ApiResponse<ReadinessCheckin>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('readiness_checkins')
      .delete()
      .eq('date', today())
      .select()
      .single()

    if (error) {
      console.error('[readinessRepository.deleteTodaysCheckin]', error)
      return { data: null, error: 'Failed to delete today\'s check-in' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[readinessRepository.deleteTodaysCheckin] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

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
