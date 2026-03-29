import { createClient } from '@/lib/supabase/server'
import type { ApiResponse, InjuryAreaRow, InjuryAreaInsert } from '@/types'

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS
// =============================================================================

/**
 * @description Returns all injury areas that have not been archived.
 * Used to populate injury tracking steps in forms and the profile settings page.
 *
 * @param userId Authenticated user's UUID
 * @returns Array of active injury area records ordered by added_at ascending
 */
export async function getActiveInjuryAreas(
  userId: string,
): Promise<
  ApiResponse<InjuryAreaRow[]>
> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('injury_areas')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('added_at', { ascending: true })

    if (error) {
      console.error('[injuryAreasRepository.getActiveInjuryAreas]', error)
      return { data: null, error: 'Failed to fetch injury areas' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error(
      '[injuryAreasRepository.getActiveInjuryAreas] unexpected error',
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Adds a new injury area to be tracked. If an archived area with
 * the same name already exists for this user it is reactivated rather than
 * duplicated.
 *
 * @param userId Authenticated user's UUID
 * @param area The injury area identifier (e.g. 'shoulder_left', 'finger_a2_right')
 * @returns The created or reactivated injury area record
 */
export async function addInjuryArea(
  userId: string,
  area: string,
): Promise<ApiResponse<InjuryAreaRow>> {
  try {
    const supabase = await createClient()

    // Use upsert so that a previously archived area is reactivated cleanly
    // without creating a duplicate row (user_id + area has a UNIQUE constraint).
    const insert: InjuryAreaInsert = {
      area,
      user_id: userId,
      is_active: true,
      added_at: new Date().toISOString(),
      archived_at: null,
    }

    const { data, error } = await supabase
      .from('injury_areas')
      .upsert(insert, { onConflict: 'user_id,area' })
      .select()
      .single()

    if (error) {
      console.error('[injuryAreasRepository.addInjuryArea]', error)
      return { data: null, error: 'Failed to add injury area' }
    }

    return { data, error: null }
  } catch (err) {
    console.error(
      '[injuryAreasRepository.addInjuryArea] unexpected error',
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Archives an injury area so it no longer appears in forms.
 * The record is retained for historical reporting — it is not deleted.
 *
 * @param userId Authenticated user's UUID
 * @param area The injury area identifier to archive
 * @returns The updated injury area record
 */
export async function archiveInjuryArea(
  userId: string,
  area: string,
): Promise<ApiResponse<InjuryAreaRow>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('injury_areas')
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('area', area)
      .select()
      .single()

    if (error) {
      console.error('[injuryAreasRepository.archiveInjuryArea]', error)
      return { data: null, error: 'Failed to archive injury area' }
    }

    return { data, error: null }
  } catch (err) {
    console.error(
      '[injuryAreasRepository.archiveInjuryArea] unexpected error',
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}
