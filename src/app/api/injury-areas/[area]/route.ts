import { NextResponse } from 'next/server'
import { handleRouteAuthError } from '@/lib/errors'
import { archiveInjuryArea } from '@/services/data/injuryAreasRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { logError, logInfo, logWarn } from '@/lib/logger'
import type { ApiResponse, InjuryAreaRow } from '@/types'

/**
 * @description Archives an injury area so it no longer appears in check-in
 * forms or session logs. The row is retained for historical context — it is
 * not deleted from the database.
 *
 * @param _request Unused.
 * @param params   Route params containing the `area` identifier (URL-encoded).
 * @returns 200 with the archived row, or 500 on failure.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ area: string }> },
): Promise<NextResponse<ApiResponse<InjuryAreaRow>>> {
  const { area } = await params
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const result = await archiveInjuryArea(area, user.id)
    if (result.error) {
      logWarn({
        event: 'injury_area_archive_failed',
        outcome: 'failure',
        route: '/api/injury-areas/[area]',
        userId: user.id,
        entityType: 'injury_area',
        entityId: area,
        durationMs: Date.now() - startedAt,
        data: { reason: result.error },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to archive injury area.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'injury_area_archived',
      outcome: 'success',
      route: '/api/injury-areas/[area]',
      userId: user.id,
      entityType: 'injury_area',
      entityId: area,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({ data: result.data, error: null })
  } catch (error) {
    const authError = handleRouteAuthError(error)

    if (authError !== null) {
      logWarn({
        event: 'injury_area_archive_failed',
        outcome: 'failure',
        route: '/api/injury-areas/[area]',
        entityType: 'injury_area',
        entityId: area,
        durationMs: Date.now() - startedAt,
        data: { reason: authError.reason },
      })

      return authError.response
    }

    logError({
      event: 'injury_area_archive_failed',
      outcome: 'failure',
      route: '/api/injury-areas/[area]',
      entityType: 'injury_area',
      entityId: area,
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to archive injury area.' },
      { status: 500 },
    )
  }
}
