import { createClient } from '@/lib/supabase/server'
import type {
  ApiResponse,
  WeeklyTemplate,
  WeeklyTemplateInsert,
  WeeklyTemplateUpdate,
} from '@/types'

/**
 * @description Fetches all weekly template rows for a mesocycle ordered by day_of_week.
 * @param mesocycleId Parent mesocycle UUID
 * @returns Weekly template rows ordered Monday-to-Sunday
 */
export async function getWeeklyTemplateByMesocycle(
  mesocycleId: string,
): Promise<ApiResponse<WeeklyTemplate[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('weekly_templates')
      .select('*')
      .eq('mesocycle_id', mesocycleId)
      .order('day_of_week', { ascending: true })

    if (error) {
      console.error('[weeklyTemplateRepository.getWeeklyTemplateByMesocycle]', error)
      return { data: null, error: 'Failed to fetch weekly templates' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error(
      '[weeklyTemplateRepository.getWeeklyTemplateByMesocycle] unexpected error',
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Creates a new weekly template row.
 * @param input Weekly template insert payload
 * @returns Newly created weekly template row
 */
export async function createWeeklyTemplate(
  input: WeeklyTemplateInsert,
): Promise<ApiResponse<WeeklyTemplate>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('weekly_templates')
      .insert(input)
      .select()
      .single()

    if (error) {
      console.error('[weeklyTemplateRepository.createWeeklyTemplate]', error)
      return { data: null, error: 'Failed to create weekly template' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[weeklyTemplateRepository.createWeeklyTemplate] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Updates an existing weekly template row.
 * @param id Weekly template UUID
 * @param updates Partial weekly template fields to update
 * @returns Updated weekly template row
 */
export async function updateWeeklyTemplate(
  id: string,
  updates: WeeklyTemplateUpdate,
): Promise<ApiResponse<WeeklyTemplate>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('weekly_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[weeklyTemplateRepository.updateWeeklyTemplate]', error)
      return { data: null, error: 'Failed to update weekly template' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[weeklyTemplateRepository.updateWeeklyTemplate] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}