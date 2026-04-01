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
 * @description Fetches planned sessions within an inclusive date range for a specific user.
 * @param startDate ISO start date
 * @param endDate ISO end date
 * @param userId The user UUID to verify ownership
 * @returns Planned sessions ordered by planned_date ascending
 */
export async function getPlannedSessionsInRange(
  startDate: string,
  endDate: string,
  userId: string,
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
      console.error(
        '[plannedSessionRepository.getPlannedSessionsInRange]',
        { startDate, endDate, userId },
        error,
      )
      return { data: null, error: 'Failed to fetch planned sessions' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error(
      '[plannedSessionRepository.getPlannedSessionsInRange] unexpected error',
      { startDate, endDate, userId },
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches planned sessions for the next n days including today for a specific user.
 * @param days Number of days ahead to include
 * @param userId The user UUID to verify ownership
 * @returns Upcoming planned sessions ordered by planned_date ascending
 */
export async function getUpcomingPlannedSessions(
  days: number,
  userId: string,
): Promise<ApiResponse<PlannedSession[]>> {
  return getPlannedSessionsInRange(today(), daysAheadDate(days), userId)
}

/**
 * @description Fetches a single planned session by UUID, verifying user ownership.
 * @param id Planned session UUID
 * @param userId The user UUID to verify ownership
 * @returns Matching planned session row
 */
export async function getPlannedSessionById(
  id: string,
  userId: string,
): Promise<ApiResponse<PlannedSession>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('planned_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[plannedSessionRepository.getPlannedSessionById]', { id, userId }, error)
      return { data: null, error: 'Failed to fetch planned session' }
    }

    return { data, error: null }
  } catch (err) {
    console.error(
      '[plannedSessionRepository.getPlannedSessionById] unexpected error',
      { id, userId },
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Creates a new planned session row.
 * @param input Planned session insert payload (must include user_id)
 * @returns Newly created planned session row
 */
export async function createPlannedSession(
  input: PlannedSessionInsert,
): Promise<ApiResponse<PlannedSession>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('planned_sessions')
      .insert(input)
      .select()
      .single()

    if (error) {
      console.error('[plannedSessionRepository.createPlannedSession]', { userId: input.user_id }, error)
      return { data: null, error: 'Failed to create planned session' }
    }

    return { data, error: null }
  } catch (err) {
    console.error(
      '[plannedSessionRepository.createPlannedSession] unexpected error',
      { userId: input.user_id },
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Updates an existing planned session row, verifying user ownership.
 * @param id Planned session UUID
 * @param updates Partial planned session fields to update
 * @param userId The user UUID to verify ownership
 * @returns Updated planned session row
 */
export async function updatePlannedSession(
  id: string,
  updates: PlannedSessionUpdate,
  userId: string,
): Promise<ApiResponse<PlannedSession>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('planned_sessions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[plannedSessionRepository.updatePlannedSession]', { id, userId }, error)
      return { data: null, error: 'Failed to update planned session' }
    }

    return { data, error: null }
  } catch (err) {
    console.error(
      '[plannedSessionRepository.updatePlannedSession] unexpected error',
      { id, userId },
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Deletes a planned session row by UUID, verifying user ownership.
 * @param id Planned session UUID
 * @param userId The user UUID to verify ownership
 * @returns The deleted planned session row
 */
export async function deletePlannedSession(
  id: string,
  userId: string,
): Promise<ApiResponse<PlannedSession>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('planned_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[plannedSessionRepository.deletePlannedSession]', { id, userId }, error)
      return { data: null, error: 'Failed to delete planned session' }
    }

    return { data, error: null }
  } catch (err) {
    console.error(
      '[plannedSessionRepository.deletePlannedSession] unexpected error',
      { id, userId },
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}