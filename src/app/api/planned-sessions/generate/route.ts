import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteAuthError } from '@/lib/errors'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { generatePlannedSessionsForActiveMesocycle } from '@/services/training/sessionGenerator'
import type { ApiResponse, PlannedSession } from '@/types'

const requestSchema = z
  .object({
    week_start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'week_start must be YYYY-MM-DD')
      .optional(),
  })
  .optional()

/**
 * @description Generates planned sessions for the active mesocycle and target
 * week (defaults to current week if omitted).
 * @returns Created planned sessions for the generated week.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ plannedSessions: PlannedSession[] }>>> {
  try {
    const user = await getCurrentUser()

    const body: unknown = await request.json().catch(() => ({}))
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const weekStart = parsed.data?.week_start
    const result = await generatePlannedSessionsForActiveMesocycle(user.id, weekStart)

    if (result.error !== null) {
      logWarn({
        event: 'planned_sessions_generation_failed',
        outcome: 'failure',
        route: '/api/planned-sessions/generate',
        userId: user.id,
        error: result.error,
      })
      return NextResponse.json({ data: null, error: result.error }, { status: 500 })
    }

    logInfo({
      event: 'planned_sessions_generated',
      outcome: 'success',
      route: '/api/planned-sessions/generate',
      userId: user.id,
      data: { count: result.data?.length ?? 0 },
    })

    return NextResponse.json(
      { data: { plannedSessions: result.data ?? [] }, error: null },
      { status: 200 },
    )
  } catch (error) {
    const authError = handleRouteAuthError(error)
    if (authError !== null) {
      return authError.response
    }

    logError({
      event: 'planned_sessions_generation_failed',
      outcome: 'failure',
      route: '/api/planned-sessions/generate',
      error,
    })
    return NextResponse.json(
      { data: null, error: 'Failed to generate planned sessions. Please try again.' },
      { status: 500 },
    )
  }
}
