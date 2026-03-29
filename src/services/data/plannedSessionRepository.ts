import { createClient } from '@/lib/supabase/server'
import type {
  ApiResponse,
  PlannedSession,
  PlannedSessionInsert,
  PlannedSessionUpdate,
} from '@/types'

/** Returns today's date as an ISO date string (YYYY-MM-DD). */
function today(): string {
  return new Date().toISOString().split('T')[0]!
}

/** Returns an ISO date string n days ahead of today, inclusive. */
function daysAheadDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]!
}

/**
 * @description Fetches planned sessions within an inclusive date range.
 * @param userId Authenticated user's UUID
 * @param startDate ISO start date
 * @param endDate ISO end date
 * @returns Planned sessions ordered by planned_date ascending
 */
export async function getPlannedSessionsInRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<ApiResponse<PlannedSession[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('planned_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('planned_date', startDate)
      .lte('planned_date', endDate)
      .order('planned_date', { ascending: true })

    if (error) {
      console.error('[plannedSessionRepository.getPlannedSessionsInRange]', error)
      return { data: null, error: 'Failed to fetch planned sessions' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error(
      '[plannedSessionRepository.getPlannedSessionsInRange] unexpected error',
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches planned sessions for the next n days including today.
 * @param userId Authenticated user's UUID
 * @param days Number of days ahead to include
 * @returns Upcoming planned sessions ordered by planned_date ascending
 */
export async function getUpcomingPlannedSessions(
  userId: string,
  days: number,
): Promise<ApiResponse<PlannedSession[]>> {
  return getPlannedSessionsInRange(userId, today(), daysAheadDate(days))
}

/**
 * @description Fetches a single planned session by UUID.
 * @param userId Authenticated user's UUID
 * @param id Planned session UUID
 * @returns Matching planned session row
 */
export async function getPlannedSessionById(
  userId: string,
  id: string,
): Promise<ApiResponse<PlannedSession>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('planned_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .single()

    if (error) {
      console.error('[plannedSessionRepository.getPlannedSessionById]', error)
      return { data: null, error: 'Failed to fetch planned session' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[plannedSessionRepository.getPlannedSessionById] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Creates a new planned session row.
 * @param userId Authenticated user's UUID
 * @param input Planned session insert payload
 * @returns Newly created planned session row
 */
export async function createPlannedSession(
  userId: string,
  input: PlannedSessionInsert,
): Promise<ApiResponse<PlannedSession>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('planned_sessions')
      .insert({ ...input, user_id: userId })
      .select()
      .single()

    if (error) {
      console.error('[plannedSessionRepository.createPlannedSession]', error)
      return { data: null, error: 'Failed to create planned session' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[plannedSessionRepository.createPlannedSession] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Updates an existing planned session row.
 * @param userId Authenticated user's UUID
 * @param id Planned session UUID
 * @param updates Partial planned session fields to update
 * @returns Updated planned session row
 */
export async function updatePlannedSession(
  userId: string,
  id: string,
  updates: PlannedSessionUpdate,
): Promise<ApiResponse<PlannedSession>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('planned_sessions')
      .update(updates)
      .eq('user_id', userId)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[plannedSessionRepository.updatePlannedSession]', error)
      return { data: null, error: 'Failed to update planned session' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[plannedSessionRepository.updatePlannedSession] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Deletes a planned session row by UUID.
 * @param userId Authenticated user's UUID
 * @param id Planned session UUID
 * @returns The deleted planned session row
 */
export async function deletePlannedSession(
  userId: string,
  id: string,
): Promise<ApiResponse<PlannedSession>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('planned_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[plannedSessionRepository.deletePlannedSession]', error)
      return { data: null, error: 'Failed to delete planned session' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[plannedSessionRepository.deletePlannedSession] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}