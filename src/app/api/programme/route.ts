import { NextResponse } from 'next/server'
import { getProgrammeBuilderSnapshot } from '@/services/training/programmeService'
import { requireAuth } from '@/lib/auth'
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
  try {
    const { userId, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const result = await getProgrammeBuilderSnapshot(userId)

    if (result.error !== null) {
      return NextResponse.json(
        { data: null, error: 'Failed to load programme data.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: result.data, error: null })
  } catch (error) {
    console.error('[GET /api/programme]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to load programme data.' },
      { status: 500 },
    )
  }
}