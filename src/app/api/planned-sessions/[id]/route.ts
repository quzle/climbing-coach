import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  deletePlannedSession,
  getPlannedSessionById,
  updatePlannedSession,
} from '@/services/data/plannedSessionRepository'
import { requireAuth } from '@/lib/auth'
import type { Json } from '@/lib/database.types'
import type { ApiResponse, PlannedSession } from '@/types'

const paramsSchema = z.object({ id: z.string().uuid() })

const updatePlannedSessionSchema = z
  .object({
    mesocycle_id: z.string().uuid().nullable().optional(),
    template_id: z.string().uuid().nullable().optional(),
    planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    session_type: z
      .enum([
        'bouldering',
        'kilterboard',
        'lead',
        'fingerboard',
        'strength',
        'aerobic',
        'rest',
        'mobility',
      ])
      .optional(),
    status: z.enum(['planned', 'completed', 'skipped', 'modified']).optional(),
    generation_notes: z.string().max(1000).nullable().optional(),
    generated_plan: z.unknown().nullable().optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update',
  })

/**
 * @description Fetches one planned session row by UUID.
 * @returns Planned session row.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ plannedSession: PlannedSession }>>> {
  try {
    const { userId, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const parsedParams = paramsSchema.safeParse(await context.params)
    if (!parsedParams.success) {
      return NextResponse.json(
        { data: null, error: 'Invalid planned session id.' },
        { status: 400 },
      )
    }

    const result = await getPlannedSessionById(userId, parsedParams.data.id)
    if (result.error !== null || result.data === null) {
      return NextResponse.json(
        { data: null, error: 'Failed to load planned session.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: { plannedSession: result.data }, error: null })
  } catch (error) {
    console.error('[GET /api/planned-sessions/:id]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to load planned session.' },
      { status: 500 },
    )
  }
}

/**
 * @description Updates a planned session row by UUID.
 * @returns Updated planned session row.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ plannedSession: PlannedSession }>>> {
  try {
    const { userId, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const parsedParams = paramsSchema.safeParse(await context.params)
    if (!parsedParams.success) {
      return NextResponse.json(
        { data: null, error: 'Invalid planned session id.' },
        { status: 400 },
      )
    }

    const parsedBody = updatePlannedSessionSchema.safeParse(await request.json())
    if (!parsedBody.success) {
      const messages = parsedBody.error.issues.map((issue) => issue.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const result = await updatePlannedSession(userId, parsedParams.data.id, {
      ...parsedBody.data,
      generated_plan:
        parsedBody.data.generated_plan === undefined
          ? undefined
          : (parsedBody.data.generated_plan as Json),
    })
    if (result.error !== null || result.data === null) {
      return NextResponse.json(
        { data: null, error: 'Failed to update planned session.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: { plannedSession: result.data }, error: null })
  } catch (error) {
    console.error('[PUT /api/planned-sessions/:id]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to update planned session.' },
      { status: 500 },
    )
  }
}

/**
 * @description Deletes a planned session row by UUID.
 * @returns Deleted planned session row.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ plannedSession: PlannedSession }>>> {
  try {
    const { userId, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const parsedParams = paramsSchema.safeParse(await context.params)
    if (!parsedParams.success) {
      return NextResponse.json(
        { data: null, error: 'Invalid planned session id.' },
        { status: 400 },
      )
    }

    const result = await deletePlannedSession(userId, parsedParams.data.id)
    if (result.error !== null || result.data === null) {
      return NextResponse.json(
        { data: null, error: 'Failed to delete planned session.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: { plannedSession: result.data }, error: null })
  } catch (error) {
    console.error('[DELETE /api/planned-sessions/:id]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to delete planned session.' },
      { status: 500 },
    )
  }
}
