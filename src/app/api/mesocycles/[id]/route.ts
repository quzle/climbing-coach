import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getMesocycleById, updateMesocycle } from '@/services/data/mesocycleRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { logError, logInfo, logWarn } from '@/lib/logger'
import type { ApiResponse, Mesocycle } from '@/types'

const paramsSchema = z.object({ id: z.string().uuid() })

const updateMesocycleSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    focus: z.string().min(1).max(500).optional(),
    phase_type: z
      .enum([
        'base',
        'power',
        'power_endurance',
        'climbing_specific',
        'performance',
        'deload',
      ])
      .optional(),
    planned_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    planned_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: z.enum(['completed', 'active', 'interrupted', 'planned']).optional(),
    actual_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    actual_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    interruption_notes: z.string().max(1000).nullable().optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update',
  })

/**
 * @description Fetches one mesocycle by UUID.
 * @returns Mesocycle row.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ mesocycle: Mesocycle }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const parsedParams = paramsSchema.safeParse(await context.params)
    if (!parsedParams.success) {
      return NextResponse.json({ data: null, error: 'Invalid mesocycle id.' }, { status: 400 })
    }

    const result = await getMesocycleById(parsedParams.data.id, user.id)
    if (result.error !== null || result.data === null) {
      logWarn({
        event: 'mesocycle_fetch_failed',
        outcome: 'failure',
        route: '/api/mesocycles/[id]',
        userId: user.id,
        entityType: 'mesocycle',
        entityId: parsedParams.data.id,
        durationMs: Date.now() - startedAt,
        data: { reason: result.error },
      })

      return NextResponse.json({ data: null, error: 'Failed to load mesocycle.' }, { status: 500 })
    }

    logInfo({
      event: 'mesocycle_fetched',
      outcome: 'success',
      route: '/api/mesocycles/[id]',
      userId: user.id,
      entityType: 'mesocycle',
      entityId: result.data.id,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({ data: { mesocycle: result.data }, error: null })
  } catch (error) {
    logError({
      event: 'mesocycle_fetch_failed',
      outcome: 'failure',
      route: '/api/mesocycles/[id]',
      entityType: 'mesocycle',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json({ data: null, error: 'Failed to load mesocycle.' }, { status: 500 })
  }
}

/**
 * @description Updates a mesocycle by UUID.
 * @returns Updated mesocycle row.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ mesocycle: Mesocycle }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const parsedParams = paramsSchema.safeParse(await context.params)
    if (!parsedParams.success) {
      return NextResponse.json({ data: null, error: 'Invalid mesocycle id.' }, { status: 400 })
    }

    const parsedBody = updateMesocycleSchema.safeParse(await request.json())
    if (!parsedBody.success) {
      const messages = parsedBody.error.issues.map((issue) => issue.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const result = await updateMesocycle(parsedParams.data.id, parsedBody.data, user.id)
    if (result.error !== null || result.data === null) {
      logWarn({
        event: 'mesocycle_update_failed',
        outcome: 'failure',
        route: '/api/mesocycles/[id]',
        userId: user.id,
        entityType: 'mesocycle',
        entityId: parsedParams.data.id,
        durationMs: Date.now() - startedAt,
        data: { reason: result.error },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to update mesocycle.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'mesocycle_updated',
      outcome: 'success',
      route: '/api/mesocycles/[id]',
      userId: user.id,
      entityType: 'mesocycle',
      entityId: result.data.id,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({ data: { mesocycle: result.data }, error: null })
  } catch (error) {
    logError({
      event: 'mesocycle_update_failed',
      outcome: 'failure',
      route: '/api/mesocycles/[id]',
      entityType: 'mesocycle',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to update mesocycle.' },
      { status: 500 },
    )
  }
}
