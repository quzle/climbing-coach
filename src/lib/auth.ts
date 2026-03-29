import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * @description Verifies that the incoming request belongs to an authenticated
 * Supabase user. Must be called at the start of every protected API route
 * handler.
 *
 * Reads the user's session from the request cookies via the server Supabase
 * client. Returns the authenticated user's UUID on success, or a pre-built
 * 401 NextResponse that the handler must return immediately on failure.
 *
 * @returns `{ userId, errorResponse: null }` when authenticated, or
 *          `{ userId: null, errorResponse: NextResponse }` when not.
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const { userId, errorResponse } = await requireAuth()
 *   if (errorResponse) return errorResponse
 *   // userId is guaranteed non-null here
 *   const result = await getRecentSessions(userId, 30)
 *   ...
 * }
 */
export async function requireAuth(): Promise<
  | { userId: string; errorResponse: null }
  | { userId: null; errorResponse: NextResponse }
> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error !== null || user === null) {
      return {
        userId: null,
        errorResponse: NextResponse.json(
          { data: null, error: 'Unauthorized' },
          { status: 401 },
        ),
      }
    }

    return { userId: user.id, errorResponse: null }
  } catch (err) {
    console.error('[requireAuth] unexpected error', err)
    return {
      userId: null,
      errorResponse: NextResponse.json(
        { data: null, error: 'Unauthorized' },
        { status: 401 },
      ),
    }
  }
}
