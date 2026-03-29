import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generatePlannedSessionsForActiveMesocycle } from '@/services/training/sessionGenerator'
import { requireAuth } from '@/lib/auth'
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
    const { userId, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

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
    const result = await generatePlannedSessionsForActiveMesocycle(userId, weekStart)

    if (result.error !== null) {
      console.error('[POST /api/planned-sessions/generate]', result.error)
      return NextResponse.json({ data: null, error: result.error }, { status: 500 })
    }

    return NextResponse.json(
      { data: { plannedSessions: result.data ?? [] }, error: null },
      { status: 200 },
    )
  } catch (error) {
    console.error('[POST /api/planned-sessions/generate]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to generate planned sessions. Please try again.' },
      { status: 500 },
    )
  }
}
