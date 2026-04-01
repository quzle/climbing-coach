import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createSession,
  getRecentSessions,
  getSessionsByType,
  updateSessionDeviation,
} from '@/services/data/sessionRepository'
import { updatePlannedSession } from '@/services/data/plannedSessionRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { logError, logInfo, logWarn } from '@/lib/logger'
import type { ApiResponse, SessionLog, SessionType } from '@/types'

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

const climbingAttemptSchema = z.object({
  grade: z.string().min(1).max(10),
  style: z.enum(['vertical', 'slab', 'overhang', 'roof']),
  hold_type: z.enum(['crimp', 'sloper', 'pinch', 'pocket', 'jug']),
  result: z.enum(['flash', 'send', 'multiple_attempts', 'project']),
  attempt_number: z.number().int().positive().optional(),
  notes: z.string().max(200).nullable().optional(),
})

const sessionLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
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
  location: z.string().max(100).nullable().optional(),
  duration_mins: z.number().int().positive().max(480).optional(),
  quality_rating: z.number().int().min(1).max(5).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  injury_flags: z.array(z.string()).default([]),
  notes: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .transform((val) => val ?? null),
  planned_session_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((val) => val ?? null),
  log_data: z
    .record(z.string(), z.unknown())
    .nullable()
    .optional()
    .transform((val) => val ?? null),
})

// Silence the unused-variable warning — climbingAttemptSchema is exported for
// re-use by the log_data field shape in consuming components.
void climbingAttemptSchema

// =============================================================================
// VALID SESSION TYPES (for GET param validation)
// =============================================================================

const VALID_SESSION_TYPES: SessionType[] = [
  'bouldering',
  'kilterboard',
  'lead',
  'fingerboard',
  'strength',
  'aerobic',
  'rest',
  'mobility',
]

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * @description Logs a completed training session. Validates the incoming
 * session data, persists it, and — when the session was linked to a planned
 * session — marks that plan as completed and records any significant deviation
 * in duration.
 * @returns 201 with the created session record, 400 on invalid input, or 500
 * on unexpected failure.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ session: SessionLog }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const body: unknown = await request.json()
    const parsed = sessionLogSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => e.message).join(', ')
      logWarn({
        event: 'session_create_failed',
        outcome: 'failure',
        route: '/api/sessions',
        userId: user.id,
        entityType: 'session',
        durationMs: Date.now() - startedAt,
        data: { reason: 'validation_failed', messages },
      })

      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const validated = parsed.data

    const result = await createSession({
      ...validated,
      log_data: validated.log_data as Json,
      user_id: user.id,
    })
    if (result.error) {
      logWarn({
        event: 'session_create_failed',
        outcome: 'failure',
        route: '/api/sessions',
        userId: user.id,
        entityType: 'session',
        durationMs: Date.now() - startedAt,
        data: {
          reason: result.error,
          sessionType: validated.session_type,
          sessionDate: validated.date,
        },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to save session. Please try again.' },
        { status: 500 },
      )
    }

    const session = result.data as SessionLog

    // Link back to the planned session if one was provided
    if (validated.planned_session_id !== null) {
      const plannedSessionResult = await updatePlannedSession(validated.planned_session_id, {
        status: 'completed',
      }, user.id)

      if (plannedSessionResult.error) {
        logWarn({
          event: 'planned_session_update_failed',
          outcome: 'failure',
          route: '/api/sessions',
          userId: user.id,
          entityType: 'planned_session',
          entityId: validated.planned_session_id,
          durationMs: Date.now() - startedAt,
          data: { reason: plannedSessionResult.error },
        })
      }

      const plannedSession = plannedSessionResult.data

      // Check for significant duration deviation (>20%)
      if (plannedSession && validated.duration_mins !== undefined) {
        const plan = plannedSession.generated_plan as Record<string, unknown> | null
        const plannedDuration =
          plan && typeof plan['duration_mins'] === 'number'
            ? (plan['duration_mins'] as number)
            : null

        if (
          plannedDuration !== null &&
          Math.abs(validated.duration_mins - plannedDuration) / plannedDuration > 0.2
        ) {
          await updateSessionDeviation(
            session.id,
            'Session duration differed from plan by more than 20%',
            user.id,
          )
        }
      }
    }

    logInfo({
      event: 'session_created',
      outcome: 'success',
      route: '/api/sessions',
      userId: user.id,
      entityType: 'session',
      entityId: session.id,
      durationMs: Date.now() - startedAt,
      data: {
        sessionType: validated.session_type,
        sessionDate: validated.date,
      },
    })

    return NextResponse.json({ data: { session }, error: null }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      logWarn({
        event: 'session_create_failed',
        outcome: 'failure',
        route: '/api/sessions',
        entityType: 'session',
        durationMs: Date.now() - startedAt,
        data: { reason: 'unauthenticated' },
      })

      return NextResponse.json({ data: null, error: 'Unauthenticated.' }, { status: 401 })
    }

    logError({
      event: 'session_create_failed',
      outcome: 'failure',
      route: '/api/sessions',
      entityType: 'session',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to save session. Please try again.' },
      { status: 500 },
    )
  }
}

/**
 * @description Retrieves recent training sessions, optionally filtered by
 * session type. Accepts `days` (1–365, default 30) and `type` query parameters.
 * @returns The array of matching session logs, or 400 if the type param is
 * invalid, or 500 on unexpected failure.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ sessions: SessionLog[] }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const days = Number(request.nextUrl.searchParams.get('days') ?? '30')
    const safeDays = Math.min(Math.max(days, 1), 365)
    const type = request.nextUrl.searchParams.get('type') as SessionType | null

    if (type !== null && !VALID_SESSION_TYPES.includes(type)) {
      logWarn({
        event: 'sessions_list_failed',
        outcome: 'failure',
        route: '/api/sessions',
        userId: user.id,
        entityType: 'session',
        durationMs: Date.now() - startedAt,
        data: { reason: 'invalid_type', type, days: safeDays },
      })

      return NextResponse.json(
        { data: null, error: 'Invalid session type' },
        { status: 400 },
      )
    }

    const result =
      type !== null
        ? await getSessionsByType(type, safeDays, user.id)
        : await getRecentSessions(safeDays, user.id)

    if (result.error) {
      logWarn({
        event: 'sessions_list_failed',
        outcome: 'failure',
        route: '/api/sessions',
        userId: user.id,
        entityType: 'session',
        durationMs: Date.now() - startedAt,
        data: { reason: result.error, type, days: safeDays },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to load sessions. Please try again.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'sessions_listed',
      outcome: 'success',
      route: '/api/sessions',
      userId: user.id,
      entityType: 'session',
      durationMs: Date.now() - startedAt,
      data: { type, days: safeDays, count: (result.data ?? []).length },
    })

    return NextResponse.json({
      data: { sessions: result.data ?? [] },
      error: null,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      logWarn({
        event: 'sessions_list_failed',
        outcome: 'failure',
        route: '/api/sessions',
        entityType: 'session',
        durationMs: Date.now() - startedAt,
        data: { reason: 'unauthenticated' },
      })

      return NextResponse.json({ data: null, error: 'Unauthenticated.' }, { status: 401 })
    }

    logError({
      event: 'sessions_list_failed',
      outcome: 'failure',
      route: '/api/sessions',
      entityType: 'session',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to load sessions. Please try again.' },
      { status: 500 },
    )
  }
}
