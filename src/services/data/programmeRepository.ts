import { createClient } from '@/lib/supabase/server'
import type {
  ApiResponse,
  Programme,
  ProgrammeInsert,
  ProgrammeUpdate,
} from '@/types'

/** Returns today's date as an ISO date string (YYYY-MM-DD). */
function today(): string {
  return new Date().toISOString().split('T')[0]!
}

/**
 * @description Fetches all programmes ordered by most recent start date first.
 * @param userId Authenticated user's UUID
 * @returns Array of programmes ordered by start_date descending
 */
export async function getProgrammes(userId: string): Promise<ApiResponse<Programme[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('programmes')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })

    if (error) {
      console.error('[programmeRepository.getProgrammes]', error)
      return { data: null, error: 'Failed to fetch programmes' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error('[programmeRepository.getProgrammes] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches a single programme by its UUID.
 * @param userId Authenticated user's UUID
 * @param id Programme UUID
 * @returns Matching programme row
 */
export async function getProgrammeById(
  userId: string,
  id: string,
): Promise<ApiResponse<Programme>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('programmes')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .single()

    if (error) {
      console.error('[programmeRepository.getProgrammeById]', error)
      return { data: null, error: 'Failed to fetch programme' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[programmeRepository.getProgrammeById] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches the most recently created programme for the given user.
 * Programmes do not expire — the most recently created one is always the
 * current one, regardless of start_date or target_date.
 * @param userId Authenticated user's UUID
 * @returns Most recent programme row, or null if none exists
 */
export async function getActiveProgramme(userId: string): Promise<ApiResponse<Programme | null>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('programmes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[programmeRepository.getActiveProgramme]', error)
      return { data: null, error: 'Failed to fetch active programme' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[programmeRepository.getActiveProgramme] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Inserts a new programme and returns the created row.
 * @param userId Authenticated user's UUID
 * @param input Programme insert payload
 * @returns Newly created programme row
 */
export async function createProgramme(
  userId: string,
  input: ProgrammeInsert,
): Promise<ApiResponse<Programme>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('programmes')
      .insert({ ...input, user_id: userId })
      .select()
      .single()

    if (error) {
      console.error('[programmeRepository.createProgramme]', error)
      return { data: null, error: 'Failed to create programme' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[programmeRepository.createProgramme] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Updates an existing programme with partial fields.
 * @param userId Authenticated user's UUID
 * @param id Programme UUID
 * @param updates Partial programme fields to update
 * @returns Updated programme row
 */
export async function updateProgramme(
  userId: string,
  id: string,
  updates: ProgrammeUpdate,
): Promise<ApiResponse<Programme>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('programmes')
      .update(updates)
      .eq('user_id', userId)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[programmeRepository.updateProgramme]', error)
      return { data: null, error: 'Failed to update programme' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[programmeRepository.updateProgramme] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Deletes a programme row by UUID.
 * @param userId Authenticated user's UUID
 * @param id Programme UUID
 * @returns Deleted programme row
 */
export async function deleteProgramme(
  userId: string,
  id: string,
): Promise<ApiResponse<Programme>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('programmes')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[programmeRepository.deleteProgramme]', error)
      return { data: null, error: 'Failed to delete programme' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[programmeRepository.deleteProgramme] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}