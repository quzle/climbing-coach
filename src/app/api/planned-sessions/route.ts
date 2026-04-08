import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteAuthError } from '@/lib/errors'
import {
  createPlannedSession,
  getPlannedSessionsInRange,
  getUpcomingPlannedSessions,
} from '@/services/data/plannedSessionRepository'
import type { Json } from '@/lib/database.types'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { logError, logInfo, logWarn } from '@/lib/logger'
import type { ApiResponse, PlannedSession, SessionStatus } from '@/types'

const querySchema = z
  .object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    upcoming_days: z.coerce.number().int().min(1).max(30).optional(),
  })
  .refine(
    (val) =>
      (val.start_date === undefined && val.end_date === undefined) ||
      (val.start_date !== undefined && val.end_date !== undefined),
    {
      message: 'start_date and end_date must be provided together',
      path: ['start_date'],
    },
  )

const createPlannedSessionSchema = z.object({
  mesocycle_id: z.string().uuid().nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session_type: z.enum([
    'bouldering',
    'kilterboard',
    'lead',
    'fingerboard',
    'strength',
    'aerobic',
    'rest',
    'mobility',
  ]),
  status: z.enum(['planned', 'completed', 'skipped', 'modified']).optional(),
  generation_notes: z.string().max(1000).nullable().optional(),
  generated_plan: z.unknown().nullable().optional(),
})

/**
 * @description Lists planned sessions by date range or upcoming days.
 * @returns Planned sessions array.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ plannedSessions: PlannedSession[] }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const parsed = querySchema.safeParse({
      start_date: request.nextUrl.searchParams.get('start_date') ?? undefined,
      end_date: request.nextUrl.searchParams.get('end_date') ?? undefined,
      upcoming_days: request.nextUrl.searchParams.get('upcoming_days') ?? undefined,
    })

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message).join(', ')
      logWarn({
        event: 'planned_sessions_list_failed',
        outcome: 'failure',
        route: '/api/planned-sessions',
        userId: user.id,
        entityType: 'planned_session',
        durationMs: Date.now() - startedAt,
        data: { reason: 'validation_failed', messages },
      })

      return NextResponse.json({ data: null, error: `Invalid request: ${messages}` }, { status: 400 })
    }

    const { start_date, end_date, upcoming_days } = parsed.data

    const result =
      start_date !== undefined && end_date !== undefined
        ? await getPlannedSessionsInRange(start_date, end_date, user.id)
        : await getUpcomingPlannedSessions(upcoming_days ?? 7, user.id)

    if (result.error !== null) {
      logWarn({
        event: 'planned_sessions_list_failed',
        outcome: 'failure',
        route: '/api/planned-sessions',
        userId: user.id,
        entityType: 'planned_session',
        durationMs: Date.now() - startedAt,
        data: {
          startDate: start_date ?? null,
          endDate: end_date ?? null,
          upcomingDays: upcoming_days ?? null,
          reason: result.error,
        },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to load planned sessions.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'planned_sessions_listed',
      outcome: 'success',
      route: '/api/planned-sessions',
      userId: user.id,
      entityType: 'planned_session',
      durationMs: Date.now() - startedAt,
      data: {
        startDate: start_date ?? null,
        endDate: end_date ?? null,
        upcomingDays: upcoming_days ?? null,
        count: (result.data ?? []).length,
      },
    })

    return NextResponse.json({ data: { plannedSessions: result.data ?? [] }, error: null })
  } catch (error) {
    const authError = handleRouteAuthError(error)

    if (authError !== null) {
      logWarn({
        event: 'planned_sessions_list_failed',
        outcome: 'failure',
        route: '/api/planned-sessions',
        entityType: 'planned_session',
        durationMs: Date.now() - startedAt,
        data: { reason: authError.reason },
      })

      return authError.response
    }

    logError({
      event: 'planned_sessions_list_failed',
      outcome: 'failure',
      route: '/api/planned-sessions',
      entityType: 'planned_session',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to load planned sessions.' },
      { status: 500 },
    )
  }
}

/**
 * @description Creates a planned session row.
 * @returns Created planned session row.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ plannedSession: PlannedSession }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const parsed = createPlannedSessionSchema.safeParse(await request.json())
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message).join(', ')
      logWarn({
        event: 'planned_session_create_failed',
        outcome: 'failure',
        route: '/api/planned-sessions',
        userId: user.id,
        entityType: 'planned_session',
        durationMs: Date.now() - startedAt,
        data: { reason: 'validation_failed', messages },
      })

      return NextResponse.json({ data: null, error: `Invalid request: ${messages}` }, { status: 400 })
    }

    const result = await createPlannedSession({
      ...parsed.data,
      mesocycle_id: parsed.data.mesocycle_id ?? null,
      template_id: parsed.data.template_id ?? null,
      status: (parsed.data.status ?? 'planned') as SessionStatus,
      generation_notes: parsed.data.generation_notes ?? null,
      generated_plan: (parsed.data.generated_plan ?? null) as Json,
      user_id: user.id,
    })

    if (result.error !== null || result.data === null) {
      logWarn({
        event: 'planned_session_create_failed',
        outcome: 'failure',
        route: '/api/planned-sessions',
        userId: user.id,
        entityType: 'planned_session',
        durationMs: Date.now() - startedAt,
        data: {
          plannedDate: parsed.data.planned_date,
          sessionType: parsed.data.session_type,
          reason: result.error,
        },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to create planned session.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'planned_session_created',
      outcome: 'success',
      route: '/api/planned-sessions',
      userId: user.id,
      entityType: 'planned_session',
      entityId: result.data.id,
      durationMs: Date.now() - startedAt,
      data: {
        plannedDate: parsed.data.planned_date,
        sessionType: parsed.data.session_type,
      },
    })

    return NextResponse.json(
      { data: { plannedSession: result.data }, error: null },
      { status: 201 },
    )
  } catch (error) {
    const authError = handleRouteAuthError(error)

    if (authError !== null) {
      logWarn({
        event: 'planned_session_create_failed',
        outcome: 'failure',
        route: '/api/planned-sessions',
        entityType: 'planned_session',
        durationMs: Date.now() - startedAt,
        data: { reason: authError.reason },
      })

      return authError.response
    }

    logError({
      event: 'planned_session_create_failed',
      outcome: 'failure',
      route: '/api/planned-sessions',
      entityType: 'planned_session',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to create planned session.' },
      { status: 500 },
    )
  }
}
