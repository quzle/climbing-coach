import { createClient } from '@/lib/supabase/server'
import type { ApiResponse, Profile, ProfileInsert, ProfileUpdate } from '@/types'

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS
// =============================================================================

/**
 * @description Retrieves a user profile by its ID.
 * @param id The UUID of the user (matches auth.users.id)
 * @returns The profile row, or null if not found
 */
export async function getProfile(id: string): Promise<ApiResponse<Profile>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[profilesRepository.getProfile]', { id }, error)
      return { data: null, error: 'Failed to retrieve profile' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[profilesRepository.getProfile] unexpected error', { id }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Retrieves a user profile by email address.
 * @param email The email address to look up
 * @returns The profile row, or null if not found
 */
export async function getProfileByEmail(email: string): Promise<ApiResponse<Profile>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (error) {
      console.error('[profilesRepository.getProfileByEmail]', { email }, error)
      return { data: null, error: 'Failed to retrieve profile' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[profilesRepository.getProfileByEmail] unexpected error', { email }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Lists all user profiles for superuser-targeted dev tooling.
 * @returns All profiles sorted by created_at descending.
 */
export async function listProfiles(): Promise<ApiResponse<Profile[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[profilesRepository.listProfiles]', error)
      return { data: null, error: 'Failed to list profiles' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error('[profilesRepository.listProfiles] unexpected error', err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Creates or updates a user profile. Used during auth callbacks to
 * ensure the profiles row is kept in sync with the auth.users record.
 * @param profile The profile payload to upsert (id is required)
 * @returns The upserted profile row
 */
export async function upsertProfile(profile: ProfileInsert): Promise<ApiResponse<Profile>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profile, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      console.error('[profilesRepository.upsertProfile]', { id: profile.id }, error)
      return { data: null, error: 'Failed to save profile' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[profilesRepository.upsertProfile] unexpected error', { id: profile.id }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Updates specific fields on an existing profile.
 * @param id The UUID of the profile to update
 * @param update The fields to update
 * @returns The updated profile row
 */
export async function updateProfile(
  id: string,
  update: ProfileUpdate,
): Promise<ApiResponse<Profile>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[profilesRepository.updateProfile]', { id }, error)
      return { data: null, error: 'Failed to update profile' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[profilesRepository.updateProfile] unexpected error', { id }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}
