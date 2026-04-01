import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getProgrammeById, updateProgramme } from '@/services/data/programmeRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { logError, logInfo, logWarn } from '@/lib/logger'
import type { ApiResponse, Programme } from '@/types'

const paramsSchema = z.object({ id: z.string().uuid() })

const updateProgrammeSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    goal: z.string().min(1).max(300).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update',
  })

/**
 * @description Fetches one programme by UUID.
 * @returns The matching programme row.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ programme: Programme }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const rawParams = await context.params
    const parsedParams = paramsSchema.safeParse(rawParams)

    if (!parsedParams.success) {
      return NextResponse.json({ data: null, error: 'Invalid programme id.' }, { status: 400 })
    }

    const result = await getProgrammeById(parsedParams.data.id, user.id)
    if (result.error !== null || result.data === null) {
      logWarn({
        event: 'programme_fetch_failed',
        outcome: 'failure',
        route: '/api/programmes/[id]',
        userId: user.id,
        entityType: 'programme',
        entityId: parsedParams.data.id,
        durationMs: Date.now() - startedAt,
        data: { reason: result.error },
      })

      return NextResponse.json({ data: null, error: 'Failed to load programme.' }, { status: 500 })
    }

    logInfo({
      event: 'programme_fetched',
      outcome: 'success',
      route: '/api/programmes/[id]',
      userId: user.id,
      entityType: 'programme',
      entityId: result.data.id,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({ data: { programme: result.data }, error: null })
  } catch (error) {
    logError({
      event: 'programme_fetch_failed',
      outcome: 'failure',
      route: '/api/programmes/[id]',
      entityType: 'programme',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json({ data: null, error: 'Failed to load programme.' }, { status: 500 })
  }
}

/**
 * @description Updates a programme by UUID with partial fields.
 * @returns The updated programme row.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ programme: Programme }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const rawParams = await context.params
    const parsedParams = paramsSchema.safeParse(rawParams)
    if (!parsedParams.success) {
      return NextResponse.json({ data: null, error: 'Invalid programme id.' }, { status: 400 })
    }

    const body: unknown = await request.json()
    const parsedBody = updateProgrammeSchema.safeParse(body)
    if (!parsedBody.success) {
      const messages = parsedBody.error.issues.map((issue) => issue.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const result = await updateProgramme(parsedParams.data.id, parsedBody.data, user.id)
    if (result.error !== null || result.data === null) {
      logWarn({
        event: 'programme_update_failed',
        outcome: 'failure',
        route: '/api/programmes/[id]',
        userId: user.id,
        entityType: 'programme',
        entityId: parsedParams.data.id,
        durationMs: Date.now() - startedAt,
        data: { reason: result.error },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to update programme.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'programme_updated',
      outcome: 'success',
      route: '/api/programmes/[id]',
      userId: user.id,
      entityType: 'programme',
      entityId: result.data.id,
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({ data: { programme: result.data }, error: null })
  } catch (error) {
    logError({
      event: 'programme_update_failed',
      outcome: 'failure',
      route: '/api/programmes/[id]',
      entityType: 'programme',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to update programme.' },
      { status: 500 },
    )
  }
}
