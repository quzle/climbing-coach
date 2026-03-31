import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
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
  try {
    await requireSuperuser()

    const body: unknown = await request.json()
    const parsed = inviteSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const result = await inviteUserByEmail({ email: parsed.data.email })

    if (result.error !== null || result.data === null) {
      console.error('[POST /api/invites]', result.error)
      return NextResponse.json(
        { data: null, error: 'Failed to send invite.' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { data: { invited_email: parsed.data.email }, error: null },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/invites]', error)

    if (error instanceof Error && error.message === 'Unauthenticated') {
      return NextResponse.json(
        { data: null, error: 'Authentication required.' },
        { status: 401 },
      )
    }

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ data: null, error: 'Forbidden.' }, { status: 403 })
    }

    return NextResponse.json(
      { data: null, error: 'Failed to send invite.' },
      { status: 500 },
    )
  }
}
