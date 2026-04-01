import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createProgramme, getProgrammes } from '@/services/data/programmeRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { logError, logInfo, logWarn } from '@/lib/logger'
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
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const result = await getProgrammes(user.id)

    if (result.error !== null) {
      logWarn({
        event: 'programmes_list_failed',
        outcome: 'failure',
        route: '/api/programmes',
        userId: user.id,
        entityType: 'programme',
        durationMs: Date.now() - startedAt,
        data: { reason: result.error },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to load programmes.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'programmes_list_fetched',
      outcome: 'success',
      route: '/api/programmes',
      userId: user.id,
      entityType: 'programme',
      durationMs: Date.now() - startedAt,
      data: { count: (result.data ?? []).length },
    })

    return NextResponse.json({
      data: { programmes: result.data ?? [] },
      error: null,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      logWarn({
        event: 'programmes_list_failed',
        outcome: 'failure',
        route: '/api/programmes',
        entityType: 'programme',
        data: { reason: 'unauthenticated' },
      })

      return NextResponse.json(
        { data: null, error: 'Unauthenticated.' },
        { status: 401 },
      )
    }

    logError({
      event: 'programmes_list_failed',
      outcome: 'failure',
      route: '/api/programmes',
      entityType: 'programme',
      durationMs: Date.now() - startedAt,
      error,
    })

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
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
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
      user_id: user.id,
    })

    if (result.error !== null || result.data === null) {
      logWarn({
        event: 'programme_create_failed',
        outcome: 'failure',
        route: '/api/programmes',
        userId: user.id,
        entityType: 'programme',
        durationMs: Date.now() - startedAt,
        data: {
          reason: result.error,
          requestedStartDate: parsed.data.start_date,
          requestedTargetDate: parsed.data.target_date,
        },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to create programme.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'programme_created',
      outcome: 'success',
      route: '/api/programmes',
      userId: user.id,
      entityType: 'programme',
      entityId: result.data.id,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({ data: { programme: result.data }, error: null }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      logWarn({
        event: 'programme_create_failed',
        outcome: 'failure',
        route: '/api/programmes',
        entityType: 'programme',
        data: { reason: 'unauthenticated' },
      })

      return NextResponse.json(
        { data: null, error: 'Unauthenticated.' },
        { status: 401 },
      )
    }

    logError({
      event: 'programme_create_failed',
      outcome: 'failure',
      route: '/api/programmes',
      entityType: 'programme',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to create programme.' },
      { status: 500 },
    )
  }
}
