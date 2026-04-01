import { createClient } from '@/lib/supabase/server'
import type {
  ApiResponse,
  Mesocycle,
  MesocycleInsert,
  MesocycleUpdate,
} from '@/types'

/** Returns today's date as an ISO date string (YYYY-MM-DD). */
function today(): string {
  return new Date().toISOString().split('T')[0]!
}

/**
 * @description Fetches all mesocycles belonging to a programme ordered by start date.
 * @param programmeId Parent programme UUID
 * @param userId The user UUID to verify ownership
 * @returns Mesocycle rows ordered by planned_start ascending
 */
export async function getMesocyclesByProgramme(
  programmeId: string,
  userId: string,
): Promise<ApiResponse<Mesocycle[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('mesocycles')
      .select('*')
      .eq('programme_id', programmeId)
      .eq('user_id', userId)
      .order('planned_start', { ascending: true })

    if (error) {
      console.error(
        '[mesocycleRepository.getMesocyclesByProgramme]',
        { programmeId, userId },
        error,
      )
      return { data: null, error: 'Failed to fetch mesocycles' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error(
      '[mesocycleRepository.getMesocyclesByProgramme] unexpected error',
      { programmeId, userId },
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches the currently active mesocycle.
 * Primary: a mesocycle whose date range contains today.
 * Fallback 1: the next upcoming mesocycle (planned_start > today).
 * Fallback 2: the most recently started mesocycle (covers the case where
 *   all mesocycles are in the past, e.g. during testing with old data).
 * @param userId The user UUID to verify ownership
 * @returns Best-match mesocycle row, or null if none exist
 */
export async function getActiveMesocycle(
  userId: string,
): Promise<ApiResponse<Mesocycle | null>> {
  try {
    const supabase = await createClient()

    // Primary: strictly active today
    const { data: active, error: activeError } = await supabase
      .from('mesocycles')
      .select('*')
      .eq('user_id', userId)
      .lte('planned_start', today())
      .gte('planned_end', today())
      .order('planned_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeError) {
      console.error('[mesocycleRepository.getActiveMesocycle]', { userId }, activeError)
      return { data: null, error: 'Failed to fetch active mesocycle' }
    }
    if (active) return { data: active, error: null }

    // Fallback 1: next upcoming mesocycle
    const { data: upcoming, error: upcomingError } = await supabase
      .from('mesocycles')
      .select('*')
      .eq('user_id', userId)
      .gt('planned_start', today())
      .order('planned_start', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (upcomingError) {
      console.error(
        '[mesocycleRepository.getActiveMesocycle fallback-upcoming]',
        { userId },
        upcomingError,
      )
      return { data: null, error: 'Failed to fetch active mesocycle' }
    }
    if (upcoming) return { data: upcoming, error: null }

    // Fallback 2: most recently started (all mesocycles in the past)
    const { data: recent, error: recentError } = await supabase
      .from('mesocycles')
      .select('*')
      .eq('user_id', userId)
      .lte('planned_start', today())
      .order('planned_start', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentError) {
      console.error(
        '[mesocycleRepository.getActiveMesocycle fallback-recent]',
        { userId },
        recentError,
      )
      return { data: null, error: 'Failed to fetch active mesocycle' }
    }

    return { data: recent, error: null }
  } catch (err) {
    console.error('[mesocycleRepository.getActiveMesocycle] unexpected error', { userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches a single mesocycle by UUID.
 * @param id Mesocycle UUID
 * @param userId The user UUID to verify ownership
 * @returns Matching mesocycle row
 */
export async function getMesocycleById(
  id: string,
  userId: string,
): Promise<ApiResponse<Mesocycle>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('mesocycles')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[mesocycleRepository.getMesocycleById]', { id, userId }, error)
      return { data: null, error: 'Failed to fetch mesocycle' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[mesocycleRepository.getMesocycleById] unexpected error', { id, userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Creates a new mesocycle row.
 * @param input Mesocycle insert payload
 * @returns Newly created mesocycle row
 */
export async function createMesocycle(
  input: MesocycleInsert,
): Promise<ApiResponse<Mesocycle>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('mesocycles')
      .insert(input)
      .select()
      .single()

    if (error) {
      console.error('[mesocycleRepository.createMesocycle]', error)
      return { data: null, error: 'Failed to create mesocycle' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[mesocycleRepository.createMesocycle] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Updates an existing mesocycle with partial fields.
 * @param id Mesocycle UUID
 * @param updates Partial mesocycle fields to update
 * @param userId The user UUID to verify ownership
 * @returns Updated mesocycle row
 */
export async function updateMesocycle(
  id: string,
  updates: MesocycleUpdate,
  userId: string,
): Promise<ApiResponse<Mesocycle>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('mesocycles')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[mesocycleRepository.updateMesocycle]', { id, userId }, error)
      return { data: null, error: 'Failed to update mesocycle' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[mesocycleRepository.updateMesocycle] unexpected error', { id, userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Deletes a mesocycle row by UUID.
 * @param id Mesocycle UUID
 * @param userId The user UUID to verify ownership
 * @returns Deleted mesocycle row
 */
export async function deleteMesocycle(
  id: string,
  userId: string,
): Promise<ApiResponse<Mesocycle>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('mesocycles')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[mesocycleRepository.deleteMesocycle]', { id, userId }, error)
      return { data: null, error: 'Failed to delete mesocycle' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[mesocycleRepository.deleteMesocycle] unexpected error', { id, userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}