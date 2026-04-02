import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteAuthError } from '@/lib/errors'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { requireSuperuser } from '@/lib/supabase/get-current-user'
import { inviteUserByEmail } from '@/services/data/invitesRepository'
import type { ApiResponse } from '@/types'

const inviteSchema = z.object({
  email: z.string().email().max(320),
})

export type InviteResponse = {
  invited_email: string
}

/**
 * @description Sends a Supabase invite email to a new user. Requires superuser role.
 * @param request Incoming request containing invite email payload.
 * @returns Invited email in the standard API envelope.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<InviteResponse>>> {
  let authenticatedUserId: string | null = null

  try {
    const user = await requireSuperuser()
    authenticatedUserId = user.id

    const body: unknown = await request.json()
    const parsed = inviteSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message).join(', ')

      logWarn({
        event: 'invite_sent',
        outcome: 'failure',
        route: '/api/invites',
        userId: user.id,
        profileRole: 'superuser',
        entityType: 'invite',
        data: {
          reason: 'validation_failed',
          issueCount: parsed.error.issues.length,
        },
      })

      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const result = await inviteUserByEmail({ email: parsed.data.email })

    if (result.error !== null || result.data === null) {
      logWarn({
        event: 'invite_sent',
        outcome: 'failure',
        route: '/api/invites',
        userId: user.id,
        profileRole: 'superuser',
        entityType: 'invite',
        error: result.error,
        data: {
          reason: 'invite_service_failed',
        },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to send invite.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'invite_sent',
      outcome: 'success',
      route: '/api/invites',
      userId: user.id,
      profileRole: 'superuser',
      entityType: 'invite',
      data: {
        inviteFlow: 'supabase_native',
      },
    })

    return NextResponse.json(
      { data: { invited_email: parsed.data.email }, error: null },
      { status: 201 },
    )
  } catch (error) {
    const authError = handleRouteAuthError(error, {
      unauthenticatedMessage: 'Authentication required.',
    })

    if (authError !== null) {
      logWarn({
        event: 'invite_sent',
        outcome: 'failure',
        route: '/api/invites',
        ...(authenticatedUserId !== null ? { userId: authenticatedUserId } : {}),
        entityType: 'invite',
        data: {
          reason: authError.reason,
          ...(authError.reason === 'forbidden' ? { requiredRole: 'superuser' } : {}),
        },
      })

      return authError.response
    }

    logError({
      event: 'invite_sent',
      outcome: 'failure',
      route: '/api/invites',
      entityType: 'invite',
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to send invite.' },
      { status: 500 },
    )
  }
}
