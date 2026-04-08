import { createClient } from '@/lib/supabase/server'
import {
  AuthorizationCheckError,
  ForbiddenError,
  UnauthenticatedError,
} from '@/lib/errors'
import { logError, logWarn } from '@/lib/logger'
import { getProfile } from '@/services/data/profilesRepository'

export type AuthUser = {
  id: string
  email: string | undefined
}

/**
 * @description Resolves the currently authenticated user from the server-side Supabase client.
 * Reads the session JWT from cookies and validates it with Supabase Auth.
 * This is the canonical way to get the authenticated user in API routes and Server Components.
 * @returns The authenticated user's id and email
 * @throws {UnauthenticatedError} If no authenticated user session is found
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    logWarn({
      event: 'auth_check_failed',
      outcome: 'failure',
      data: {
        source: 'getCurrentUser',
      },
      error: error?.message ?? 'No authenticated user session',
    })

    throw new UnauthenticatedError()
  }

  return {
    id: user.id,
    email: user.email,
  }
}

/**
 * @description Ensures the authenticated user has the superuser role before
 * allowing privileged server-side actions.
 * @returns The authenticated user payload
 * @throws {UnauthenticatedError} If no authenticated user session exists
 * @throws {AuthorizationCheckError} If the user profile cannot be loaded for role verification
 * @throws {ForbiddenError} If the authenticated user does not have the superuser role
 */
export async function requireSuperuser(): Promise<AuthUser> {
  const user = await getCurrentUser()
  const profileResult = await getProfile(user.id)

  if (profileResult.error) {
    logError({
      event: 'access_control_check_failed',
      outcome: 'failure',
      userId: user.id,
      data: {
        source: 'requireSuperuser',
        required_role: 'superuser',
      },
      error: profileResult.error,
    })

    throw new AuthorizationCheckError()
  }

  if (!profileResult.data || profileResult.data.role !== 'superuser') {
    logWarn({
      event: 'access_control_denied',
      outcome: 'failure',
      userId: user.id,
      profileRole: profileResult.data?.role ?? null,
      data: {
        source: 'requireSuperuser',
        required_role: 'superuser',
      },
    })

    throw new ForbiddenError()
  }

  return user
}
