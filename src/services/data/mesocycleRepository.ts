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
 * @returns Mesocycle rows ordered by planned_start ascending
 */
export async function getMesocyclesByProgramme(
  programmeId: string,
): Promise<ApiResponse<Mesocycle[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('mesocycles')
      .select('*')
      .eq('programme_id', programmeId)
      .order('planned_start', { ascending: true })

    if (error) {
      console.error('[mesocycleRepository.getMesocyclesByProgramme]', error)
      return { data: null, error: 'Failed to fetch mesocycles' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error('[mesocycleRepository.getMesocyclesByProgramme] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches the currently active mesocycle based on date range.
 * @returns Active mesocycle row, or null if none covers today
 */
export async function getActiveMesocycle(): Promise<ApiResponse<Mesocycle | null>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('mesocycles')
      .select('*')
      .lte('planned_start', today())
      .gte('planned_end', today())
      .order('planned_start', { ascending: false })
      .maybeSingle()

    if (error) {
      console.error('[mesocycleRepository.getActiveMesocycle]', error)
      return { data: null, error: 'Failed to fetch active mesocycle' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[mesocycleRepository.getActiveMesocycle] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches a single mesocycle by UUID.
 * @param id Mesocycle UUID
 * @returns Matching mesocycle row
 */
export async function getMesocycleById(
  id: string,
): Promise<ApiResponse<Mesocycle>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('mesocycles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('[mesocycleRepository.getMesocycleById]', error)
      return { data: null, error: 'Failed to fetch mesocycle' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[mesocycleRepository.getMesocycleById] unexpected error', err)
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
 * @returns Updated mesocycle row
 */
export async function updateMesocycle(
  id: string,
  updates: MesocycleUpdate,
): Promise<ApiResponse<Mesocycle>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('mesocycles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[mesocycleRepository.updateMesocycle]', error)
      return { data: null, error: 'Failed to update mesocycle' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[mesocycleRepository.updateMesocycle] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Deletes a mesocycle row by UUID.
 * @param id Mesocycle UUID
 * @returns Deleted mesocycle row
 */
export async function deleteMesocycle(
  id: string,
): Promise<ApiResponse<Mesocycle>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('mesocycles')
      .delete()
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[mesocycleRepository.deleteMesocycle]', error)
      return { data: null, error: 'Failed to delete mesocycle' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[mesocycleRepository.deleteMesocycle] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}