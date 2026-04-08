import { upsertProfile } from '@/services/data/profilesRepository'
import type { ApiResponse } from '@/types'

export type InvitedUserProfileInput = {
  id: string
  email: string
}

/**
 * @description Creates or finalizes the profile row for an invited user after
 * a successful auth callback. This ensures role and invite status are in a
 * known state for downstream authorization checks.
 * @param input Authenticated user identity payload
 * @returns A success flag when profile lifecycle finalization succeeds
 * @throws Never throws; returns a safe error payload on failures
 */
export async function finalizeInvitedUserProfile(
  input: InvitedUserProfileInput,
): Promise<ApiResponse<true>> {
  try {
    const result = await upsertProfile({
      id: input.id,
      email: input.email,
      role: 'user',
      invite_status: 'active',
    })

    if (result.error !== null) {
      console.error('[authLifecycleService.finalizeInvitedUserProfile]', input, result.error)
      return { data: null, error: 'Failed to finalize profile lifecycle' }
    }

    return { data: true, error: null }
  } catch (err) {
    console.error('[authLifecycleService.finalizeInvitedUserProfile] unexpected error', input, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}
