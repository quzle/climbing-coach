import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getActiveInjuryAreas,
  addInjuryArea,
} from '@/services/data/injuryAreasRepository'
import { requireAuth } from '@/lib/auth'
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
  try {
    const { userId, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const result = await getActiveInjuryAreas(userId)
    if (result.error) {
      console.error('[GET /api/injury-areas]', result.error)
      return NextResponse.json(
        { data: null, error: 'Failed to fetch injury areas.' },
        { status: 500 },
      )
    }
    return NextResponse.json({ data: result.data ?? [], error: null })
  } catch (error) {
    console.error('[GET /api/injury-areas]', error)
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
  try {
    const { userId, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const body: unknown = await request.json()
    const parsed = addAreaSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => e.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const result = await addInjuryArea(userId, parsed.data.area)
    if (result.error) {
      console.error('[POST /api/injury-areas]', result.error)
      return NextResponse.json(
        { data: null, error: 'Failed to add injury area.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: result.data, error: null }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/injury-areas]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to add injury area.' },
      { status: 500 },
    )
  }
}
