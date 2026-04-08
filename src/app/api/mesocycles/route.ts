import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteAuthError } from '@/lib/errors'
import { createMesocycle, getMesocyclesByProgramme } from '@/services/data/mesocycleRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { logError, logInfo, logWarn } from '@/lib/logger'
import type { ApiResponse, Mesocycle } from '@/types'

const querySchema = z.object({ programme_id: z.string().uuid() })

const createMesocycleSchema = z.object({
  programme_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  focus: z.string().min(1).max(500),
  phase_type: z.enum([
    'base',
    'power',
    'power_endurance',
    'climbing_specific',
    'performance',
    'deload',
  ]),
  planned_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  planned_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['completed', 'active', 'interrupted', 'planned']).optional(),
  actual_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  actual_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  interruption_notes: z.string().max(1000).nullable().optional(),
})

/**
 * @description Lists mesocycles for a programme_id query param.
 * @returns Mesocycle array wrapped in API envelope.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ mesocycles: Mesocycle[] }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const parsed = querySchema.safeParse({
      programme_id: request.nextUrl.searchParams.get('programme_id'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: 'programme_id query param is required and must be a UUID.' },
        { status: 400 },
      )
    }

    const result = await getMesocyclesByProgramme(parsed.data.programme_id, user.id)
    if (result.error !== null) {
      logWarn({
        event: 'mesocycles_list_failed',
        outcome: 'failure',
        route: '/api/mesocycles',
        userId: user.id,
        entityType: 'mesocycle',
        durationMs: Date.now() - startedAt,
        data: {
          programmeId: parsed.data.programme_id,
          reason: result.error,
        },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to load mesocycles.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'mesocycles_list_fetched',
      outcome: 'success',
      route: '/api/mesocycles',
      userId: user.id,
      entityType: 'mesocycle',
      durationMs: Date.now() - startedAt,
      data: {
        programmeId: parsed.data.programme_id,
        count: (result.data ?? []).length,
      },
    })

    return NextResponse.json({ data: { mesocycles: result.data ?? [] }, error: null })
  } catch (error) {
    const authError = handleRouteAuthError(error)

    if (authError !== null) {
      logWarn({
        event: 'mesocycles_list_failed',
        outcome: 'failure',
        route: '/api/mesocycles',
        entityType: 'mesocycle',
        data: { reason: authError.reason },
      })

      return authError.response
    }

    logError({
      event: 'mesocycles_list_failed',
      outcome: 'failure',
      route: '/api/mesocycles',
      entityType: 'mesocycle',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json({ data: null, error: 'Failed to load mesocycles.' }, { status: 500 })
  }
}

/**
 * @description Creates a mesocycle row.
 * @returns Created mesocycle row.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ mesocycle: Mesocycle }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const body: unknown = await request.json()
    const parsed = createMesocycleSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const result = await createMesocycle({ ...parsed.data, user_id: user.id })
    if (result.error !== null || result.data === null) {
      logWarn({
        event: 'mesocycle_create_failed',
        outcome: 'failure',
        route: '/api/mesocycles',
        userId: user.id,
        entityType: 'mesocycle',
        durationMs: Date.now() - startedAt,
        data: {
          programmeId: parsed.data.programme_id,
          reason: result.error,
        },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to create mesocycle.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'mesocycle_created',
      outcome: 'success',
      route: '/api/mesocycles',
      userId: user.id,
      entityType: 'mesocycle',
      entityId: result.data.id,
      durationMs: Date.now() - startedAt,
      data: { programmeId: parsed.data.programme_id },
    })

    return NextResponse.json({ data: { mesocycle: result.data }, error: null }, { status: 201 })
  } catch (error) {
    const authError = handleRouteAuthError(error)

    if (authError !== null) {
      logWarn({
        event: 'mesocycle_create_failed',
        outcome: 'failure',
        route: '/api/mesocycles',
        entityType: 'mesocycle',
        data: { reason: authError.reason },
      })

      return authError.response
    }

    logError({
      event: 'mesocycle_create_failed',
      outcome: 'failure',
      route: '/api/mesocycles',
      entityType: 'mesocycle',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json({ data: null, error: 'Failed to create mesocycle.' }, { status: 500 })
  }
}
