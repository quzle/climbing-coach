import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { finalizeInvitedUserProfile } from '@/services/auth/authLifecycleService'

/**
 * @description Exchanges a Supabase auth code for a session. Called when a
 * user follows an invite link or any other Supabase-issued email link.
 * On success, the session is written to cookies and the user is redirected.
 * On failure, the user is sent back to the login page with an error flag.
 *
 * @param request Incoming GET request containing `code` and optional `next`
 *   search parameters
 * @returns Redirect response
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()

    // Use the anon key here - this client is exchanging a user-owned auth
    // code, not performing privileged service-role operations.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          },
        },
      },
    )

    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (!user?.email) {
        logError({
          event: 'login_failure',
          outcome: 'failure',
          route: '/auth/callback',
          userId: user?.id ?? null,
          data: {
            reason: 'missing_email_after_code_exchange',
          },
        })
        return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`)
      }

      const finalizeResult = await finalizeInvitedUserProfile({
        id: user.id,
        email: user.email,
      })

      if (finalizeResult.error !== null) {
        logError({
          event: 'login_failure',
          outcome: 'failure',
          route: '/auth/callback',
          userId: user.id,
          data: {
            reason: 'profile_finalization_failed',
          },
          error: finalizeResult.error,
        })
        return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`)
      }

      // Validate the `next` parameter to prevent open redirect attacks.
      const safeNext = next.startsWith('/') ? next : '/'

      logInfo({
        event: 'login_success',
        outcome: 'success',
        route: '/auth/callback',
        userId: user.id,
        data: {
          auth_flow: 'invite_callback',
          redirect_path: safeNext,
        },
      })

      return NextResponse.redirect(`${origin}${safeNext}`)
    }

    logWarn({
      event: 'login_failure',
      outcome: 'failure',
      route: '/auth/callback',
      data: {
        reason: 'exchange_code_for_session_failed',
      },
      error: error.message,
    })
  }

  logWarn({
    event: 'login_failure',
    outcome: 'failure',
    route: '/auth/callback',
    data: {
      reason: 'missing_auth_code',
    },
  })

  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`)
}
