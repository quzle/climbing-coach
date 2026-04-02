import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteAuthError } from '@/lib/errors'
import {
  getActiveInjuryAreas,
  addInjuryArea,
} from '@/services/data/injuryAreasRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { logError, logInfo, logWarn } from '@/lib/logger'
import type { ApiResponse, InjuryAreaRow } from '@/types'

const addAreaSchema = z.object({
  area: z.string().min(1).max(100),
})

/**
 * @description Returns all currently active (non-archived) injury areas for
 * the athlete.
 * @returns 200 with the list of active injury area rows.
 */
export async function GET(): Promise<NextResponse<ApiResponse<InjuryAreaRow[]>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const result = await getActiveInjuryAreas(user.id)
    if (result.error) {
      logWarn({
        event: 'injury_areas_fetch_failed',
        outcome: 'failure',
        route: '/api/injury-areas',
        userId: user.id,
        entityType: 'injury_area',
        durationMs: Date.now() - startedAt,
        data: { reason: result.error },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to fetch injury areas.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'injury_areas_fetched',
      outcome: 'success',
      route: '/api/injury-areas',
      userId: user.id,
      entityType: 'injury_area',
      durationMs: Date.now() - startedAt,
      data: { count: result.data?.length ?? 0 },
    })

    return NextResponse.json({ data: result.data ?? [], error: null })
  } catch (error) {
    const authError = handleRouteAuthError(error)

    if (authError !== null) {
      logWarn({
        event: 'injury_areas_fetch_failed',
        outcome: 'failure',
        route: '/api/injury-areas',
        entityType: 'injury_area',
        durationMs: Date.now() - startedAt,
        data: { reason: authError.reason },
      })

      return authError.response
    }

    logError({
      event: 'injury_areas_fetch_failed',
      outcome: 'failure',
      route: '/api/injury-areas',
      entityType: 'injury_area',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to fetch injury areas.' },
      { status: 500 },
    )
  }
}

/**
 * @description Adds a new injury area to track. If the area was previously
 * archived it will be reactivated. Idempotent — adding an already-active area
 * has no effect.
 * @returns 201 with the created or reactivated area row, 400 on invalid input,
 * or 500 on unexpected failure.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<InjuryAreaRow>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const body: unknown = await request.json()
    const parsed = addAreaSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => e.message).join(', ')
      logWarn({
        event: 'injury_area_create_failed',
        outcome: 'failure',
        route: '/api/injury-areas',
        userId: user.id,
        entityType: 'injury_area',
        durationMs: Date.now() - startedAt,
        data: { reason: 'validation_failed', messages },
      })

      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const result = await addInjuryArea(parsed.data.area, user.id)
    if (result.error) {
      logWarn({
        event: 'injury_area_create_failed',
        outcome: 'failure',
        route: '/api/injury-areas',
        userId: user.id,
        entityType: 'injury_area',
        durationMs: Date.now() - startedAt,
        data: { reason: result.error },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to add injury area.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'injury_area_created',
      outcome: 'success',
      route: '/api/injury-areas',
      userId: user.id,
      entityType: 'injury_area',
      entityId: (result.data as InjuryAreaRow).id,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({ data: result.data, error: null }, { status: 201 })
  } catch (error) {
    const authError = handleRouteAuthError(error)

    if (authError !== null) {
      logWarn({
        event: 'injury_area_create_failed',
        outcome: 'failure',
        route: '/api/injury-areas',
        entityType: 'injury_area',
        durationMs: Date.now() - startedAt,
        data: { reason: authError.reason },
      })

      return authError.response
    }

    logError({
      event: 'injury_area_create_failed',
      outcome: 'failure',
      route: '/api/injury-areas',
      entityType: 'injury_area',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to add injury area.' },
      { status: 500 },
    )
  }
}
