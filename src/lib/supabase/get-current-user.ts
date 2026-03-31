import { createClient } from '@/lib/supabase/server'

export type AuthUser = {
  id: string
  email: string | undefined
}

/**
 * @description Resolves the currently authenticated user from the server-side Supabase client.
 * Reads the session JWT from cookies and validates it with Supabase Auth.
 * This is the canonical way to get the authenticated user in API routes and Server Components.
 * @returns The authenticated user's id and email
 * @throws {Error} If no authenticated user session is found
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthenticated')
  }

  return {
    id: user.id,
    email: user.email,
  }
}
