import { createClient } from '@/lib/supabase/server'
import type {
  ApiResponse,
  Programme,
  ProgrammeInsert,
  ProgrammeUpdate,
} from '@/types'

/**
 * @description Fetches all programmes for a specific user, ordered by most recent start date first.
 * @param userId The user UUID to scope the query
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
      console.error('[programmeRepository.getProgrammes]', { userId }, error)
      return { data: null, error: 'Failed to fetch programmes' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error('[programmeRepository.getProgrammes] unexpected error', { userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches a single programme by its UUID. Verifies the programme
 * belongs to the specified user before returning.
 * @param id Programme UUID
 * @param userId The user UUID to verify ownership
 * @returns Matching programme row
 */
export async function getProgrammeById(
  id: string,
  userId: string,
): Promise<ApiResponse<Programme>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('programmes')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[programmeRepository.getProgrammeById]', { id, userId }, error)
      return { data: null, error: 'Failed to fetch programme' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[programmeRepository.getProgrammeById] unexpected error', { id, userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches the programme with status = 'active' for a specific user.
 * The partial unique index on (user_id) WHERE status = 'active' guarantees
 * at most one row is returned.
 * @param userId The user UUID to fetch the active programme for
 * @returns Active programme row, or null if none exists
 */
export async function getActiveProgramme(
  userId: string,
): Promise<ApiResponse<Programme | null>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('programmes')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (error) {
      console.error('[programmeRepository.getActiveProgramme]', { userId }, error)
      return { data: null, error: 'Failed to fetch active programme' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[programmeRepository.getActiveProgramme] unexpected error', { userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Inserts a new programme and returns the created row.
 * The caller must include the user_id in the input payload.
 * @param input Programme insert payload with user_id
 * @returns Newly created programme row
 */
export async function createProgramme(
  input: ProgrammeInsert,
): Promise<ApiResponse<Programme>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('programmes')
      .insert(input)
      .select()
      .single()

    if (error) {
      console.error('[programmeRepository.createProgramme]', { userId: input.user_id }, error)
      return { data: null, error: 'Failed to create programme' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[programmeRepository.createProgramme] unexpected error', { userId: input.user_id }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Updates an existing programme with partial fields.
 * @param id Programme UUID
 * @param updates Partial programme fields to update
 * @param userId The user UUID to verify ownership
 * @returns Updated programme row
 */
export async function updateProgramme(
  id: string,
  updates: ProgrammeUpdate,
  userId: string,
): Promise<ApiResponse<Programme>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('programmes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[programmeRepository.updateProgramme]', { id, userId }, error)
      return { data: null, error: 'Failed to update programme' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[programmeRepository.updateProgramme] unexpected error', { id, userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Deletes a programme row by UUID.
 * @param id Programme UUID
 * @param userId The user UUID to verify ownership
 * @returns Deleted programme row
 */
export async function deleteProgramme(
  id: string,
  userId: string,
): Promise<ApiResponse<Programme>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('programmes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[programmeRepository.deleteProgramme]', { id, userId }, error)
      return { data: null, error: 'Failed to delete programme' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[programmeRepository.deleteProgramme] unexpected error', { id, userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}