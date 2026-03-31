import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types'

export type InviteUserInput = {
  email: string
}

/**
 * @description Sends an invitation email through Supabase Auth admin invite flow.
 * @param input Invite payload containing the target email address.
 * @returns True when the invite request is accepted by Supabase.
 */
export async function inviteUserByEmail(input: InviteUserInput): Promise<ApiResponse<true>> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.admin.inviteUserByEmail(input.email)

    if (error) {
      console.error('[invitesRepository.inviteUserByEmail]', { email: input.email }, error)
      return { data: null, error: 'Failed to send invite' }
    }

    return { data: true, error: null }
  } catch (err) {
    console.error('[invitesRepository.inviteUserByEmail] unexpected error', input, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}
