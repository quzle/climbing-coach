import { NextResponse } from 'next/server'
import { archiveInjuryArea } from '@/services/data/injuryAreasRepository'
import { requireAuth } from '@/lib/auth'
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
  try {
    const { userId, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const result = await archiveInjuryArea(userId, area)
    if (result.error) {
      console.error('[DELETE /api/injury-areas/[area]]', result.error)
      return NextResponse.json(
        { data: null, error: 'Failed to archive injury area.' },
        { status: 500 },
      )
    }
    return NextResponse.json({ data: result.data, error: null })
  } catch (error) {
    console.error('[DELETE /api/injury-areas/[area]]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to archive injury area.' },
      { status: 500 },
    )
  }
}
