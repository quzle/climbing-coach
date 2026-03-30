import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createProgramme, getProgrammes } from '@/services/data/programmeRepository'
import { SINGLE_USER_PLACEHOLDER_ID } from '@/lib/placeholder-user-id'
import type { ApiResponse, Programme } from '@/types'

const createProgrammeSchema = z.object({
  name: z.string().min(1).max(120),
  goal: z.string().min(1).max(300),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(1000).nullable().optional(),
})

/**
 * @description Lists programmes ordered by most recent start date first.
 * @returns Programmes array wrapped in the standard API envelope.
 */
export async function GET(): Promise<
  NextResponse<ApiResponse<{ programmes: Programme[] }>>
> {
  try {
    const result = await getProgrammes()
    if (result.error !== null) {
      console.error('[GET /api/programmes]', result.error)
      return NextResponse.json(
        { data: null, error: 'Failed to load programmes.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      data: { programmes: result.data ?? [] },
      error: null,
    })
  } catch (error) {
    console.error('[GET /api/programmes]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to load programmes.' },
      { status: 500 },
    )
  }
}

/**
 * @description Creates a new programme row.
 * @returns The created programme record.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ programme: Programme }>>> {
  try {
    const body: unknown = await request.json()
    const parsed = createProgrammeSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const result = await createProgramme({
      ...parsed.data,
      notes: parsed.data.notes ?? null,
      user_id: SINGLE_USER_PLACEHOLDER_ID,
    })

    if (result.error !== null || result.data === null) {
      console.error('[POST /api/programmes]', result.error)
      return NextResponse.json(
        { data: null, error: 'Failed to create programme.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: { programme: result.data }, error: null }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/programmes]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to create programme.' },
      { status: 500 },
    )
  }
}
