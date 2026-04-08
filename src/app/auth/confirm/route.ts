import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { finalizeInvitedUserProfile } from '@/services/auth/authLifecycleService'

/**
 * @description Confirms a Supabase OTP token for invite acceptance or password
 * recovery. Supabase sends `token_hash` and `type` query parameters for these
 * flows, which must be verified with `verifyOtp()` — distinct from the OAuth
 * PKCE flow handled by `/auth/callback`.
 *
 * When `type === 'invite'` or `type === 'magiclink'`: verifies the token,
 * establishes session, finalizes the user profile, then redirects to home or
 * the `next` parameter.
 *
 * When `type === 'recovery'`: verifies the token and redirects to the
 * change-password page where the user can set a new password.
 *
 * On any failure, redirects to login with an error flag.
 *
 * @param request Incoming GET request containing `token_hash`, `type`, and
 *   optional `next` search parameters
 * @returns Redirect response
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  if (!tokenHash) {
    logWarn({
      event: 'token_confirmation_failure',
      outcome: 'failure',
      route: '/auth/confirm',
      data: {
        reason: 'missing_token_hash',
        confirmation_type: type,
      },
    })

    return NextResponse.redirect(`${origin}/auth/login?error=confirm_failed`)
  }

  if (!type) {
    logWarn({
      event: 'token_confirmation_failure',
      outcome: 'failure',
      route: '/auth/confirm',
      data: {
        reason: 'missing_confirmation_type',
      },
    })

    return NextResponse.redirect(`${origin}/auth/login?error=confirm_failed`)
  }

  const cookieStore = await cookies()

  // Use the anon key here - this client is exchanging a user-owned OTP token,
  // not performing privileged service-role operations.
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
  } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as 'invite' | 'recovery' | 'magiclink',
  })

  if (error) {
    logWarn({
      event: 'token_confirmation_failure',
      outcome: 'failure',
      route: '/auth/confirm',
      data: {
        reason: 'verify_otp_failed',
        confirmation_type: type,
      },
      error: error.message,
    })

    return NextResponse.redirect(`${origin}/auth/login?error=confirm_failed`)
  }

  if (!user?.id) {
    logError({
      event: 'token_confirmation_failure',
      outcome: 'failure',
      route: '/auth/confirm',
      data: {
        reason: 'missing_user_after_otp_verification',
        confirmation_type: type,
      },
    })

    return NextResponse.redirect(`${origin}/auth/login?error=confirm_failed`)
  }

  // Handle invite type: finalize profile and redirect to home or next
  if (type === 'invite') {
    if (!user.email) {
      logError({
        event: 'token_confirmation_failure',
        outcome: 'failure',
        route: '/auth/confirm',
        userId: user.id,
        data: {
          reason: 'missing_email_after_otp_verification',
          confirmation_type: type,
        },
      })

      return NextResponse.redirect(`${origin}/auth/login?error=confirm_failed`)
    }

    const finalizeResult = await finalizeInvitedUserProfile({
      id: user.id,
      email: user.email,
    })

    if (finalizeResult.error !== null) {
      logError({
        event: 'token_confirmation_failure',
        outcome: 'failure',
        route: '/auth/confirm',
        userId: user.id,
        data: {
          reason: 'profile_finalization_failed',
          confirmation_type: type,
        },
        error: finalizeResult.error,
      })

      return NextResponse.redirect(`${origin}/auth/login?error=confirm_failed`)
    }

    // Validate the `next` parameter to prevent open redirect attacks.
    const safeNext = next.startsWith('/') ? next : '/'

    logInfo({
      event: 'token_confirmation_success',
      outcome: 'success',
      route: '/auth/confirm',
      userId: user.id,
      data: {
        confirmation_type: type,
        redirect_path: safeNext,
      },
    })

    return NextResponse.redirect(`${origin}${safeNext}`)
  }

  // Handle magic link type: finalize profile and redirect to home or next.
  if (type === 'magiclink') {
    if (!user.email) {
      logError({
        event: 'token_confirmation_failure',
        outcome: 'failure',
        route: '/auth/confirm',
        userId: user.id,
        data: {
          reason: 'missing_email_after_otp_verification',
          confirmation_type: type,
        },
      })

      return NextResponse.redirect(`${origin}/auth/login?error=confirm_failed`)
    }

    const finalizeResult = await finalizeInvitedUserProfile({
      id: user.id,
      email: user.email,
    })

    if (finalizeResult.error !== null) {
      logError({
        event: 'token_confirmation_failure',
        outcome: 'failure',
        route: '/auth/confirm',
        userId: user.id,
        data: {
          reason: 'profile_finalization_failed',
          confirmation_type: type,
        },
        error: finalizeResult.error,
      })

      return NextResponse.redirect(`${origin}/auth/login?error=confirm_failed`)
    }

    // Validate the `next` parameter to prevent open redirect attacks.
    const safeNext = next.startsWith('/') ? next : '/'

    logInfo({
      event: 'token_confirmation_success',
      outcome: 'success',
      route: '/auth/confirm',
      userId: user.id,
      data: {
        confirmation_type: type,
        redirect_path: safeNext,
      },
    })

    return NextResponse.redirect(`${origin}${safeNext}`)
  }

  // Handle recovery type: redirect to change-password page
  if (type === 'recovery') {
    logInfo({
      event: 'token_confirmation_success',
      outcome: 'success',
      route: '/auth/confirm',
      userId: user.id,
      data: {
        confirmation_type: type,
        redirect_path: '/auth/change-password',
      },
    })

    return NextResponse.redirect(`${origin}/auth/change-password`)
  }

  // Unsupported type
  logWarn({
    event: 'token_confirmation_failure',
    outcome: 'failure',
    route: '/auth/confirm',
    userId: user.id,
    data: {
      reason: 'unsupported_confirmation_type',
      confirmation_type: type,
    },
  })

  return NextResponse.redirect(`${origin}/auth/login?error=confirm_failed`)
}
