import { NextResponse } from 'next/server'
import { handleRouteAuthError } from '@/lib/errors'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getProgrammeBuilderSnapshot } from '@/services/training/programmeService'
import type { ApiResponse, ProgrammeBuilderSnapshot } from '@/types'

/**
 * @description Returns the aggregated planning snapshot used by the programme
 * builder UI. This endpoint is laptop-primary Phase 2 infrastructure: it gives
 * the UI the active programme, mesocycles, weekly template, and upcoming plans
 * in one round-trip.
 * @returns ProgrammeBuilderSnapshot or a safe error response
 */
export async function GET(): Promise<
  NextResponse<ApiResponse<ProgrammeBuilderSnapshot>>
> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const result = await getProgrammeBuilderSnapshot(user.id)

    if (result.error !== null) {
      logWarn({
        event: 'programme_snapshot_fetch_failed',
        outcome: 'failure',
        route: '/api/programme',
        userId: user.id,
        entityType: 'programme',
        durationMs: Date.now() - startedAt,
        data: { reason: result.error },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to load programme data.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'programme_snapshot_fetched',
      outcome: 'success',
      route: '/api/programme',
      userId: user.id,
      entityType: 'programme',
      durationMs: Date.now() - startedAt,
      data: {
        hasActiveProgramme: result.data?.currentProgramme !== null,
        hasActiveMesocycle: result.data?.activeMesocycle !== null,
      },
    })

    return NextResponse.json({ data: result.data, error: null })
  } catch (error) {
    const authError = handleRouteAuthError(error)

    if (authError !== null) {
      logWarn({
        event: 'programme_snapshot_fetch_failed',
        outcome: 'failure',
        route: '/api/programme',
        entityType: 'programme',
        durationMs: Date.now() - startedAt,
        data: { reason: authError.reason },
      })

      return authError.response
    }

    logError({
      event: 'programme_snapshot_fetch_failed',
      outcome: 'failure',
      route: '/api/programme',
      entityType: 'programme',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to load programme data.' },
      { status: 500 },
    )
  }
}