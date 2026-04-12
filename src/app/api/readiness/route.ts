import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteAuthError } from '@/lib/errors'
import {
  createCheckin,
  deleteTodaysCheckin,
  getTodaysCheckin,
  getRecentCheckins,
  getAverageReadiness,
  hasCheckedInToday,
} from '@/services/data/readinessRepository'
import { buildAthleteContext, computeWarnings, parseInjuryAreaHealth } from '@/services/ai/contextBuilder'
import { getLastSessionDate } from '@/services/data/sessionRepository'
import { getActiveInjuryAreas } from '@/services/data/injuryAreasRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { logError, logInfo, logWarn } from '@/lib/logger'
import type { ApiResponse, InjuryAreaHealth, ReadinessCheckin } from '@/types'

const injuryAreaHealthItemSchema = z.object({
  area: z.string(),
  health: z.number().int().min(1).max(5),
  notes: z.string().nullable().optional().transform((v) => v ?? null),
})

const readinessSchema = z.object({
  sleep_quality: z.number().int().min(1).max(5),
  fatigue: z.number().int().min(1).max(5),
  finger_health: z.number().int().min(1).max(5),
  injury_area_health: z.array(injuryAreaHealthItemSchema).default([]),
  illness_flag: z.boolean(),
  life_stress: z.number().int().min(1).max(5),
  notes: z
    .string()
    .max(500, 'Notes too long')
    .nullable()
    .optional()
    .transform((val) => val ?? null),
})

/**
 * @description Submits a new readiness check-in for today. Validates the
 * incoming data, guards against duplicate submissions, persists the check-in,
 * and returns the saved record alongside any active training warnings derived
 * from the athlete's current context.
 * @returns 201 with the created check-in and active warnings, 400 on invalid
 * input, 409 if already checked in today, or 500 on unexpected failure.
 */
export async function POST(
  request: NextRequest,
): Promise<
  NextResponse<ApiResponse<{ checkin: ReadinessCheckin; warnings: string[] }>>
> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const body: unknown = await request.json()
    const parsed = readinessSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => e.message).join(', ')
      logWarn({
        event: 'readiness_create_failed',
        outcome: 'failure',
        route: '/api/readiness',
        userId: user.id,
        entityType: 'readiness_checkin',
        durationMs: Date.now() - startedAt,
        data: { reason: 'validation_failed', messages },
      })

      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const validated = parsed.data
    const { injury_area_health, ...checkinInput } = validated

    const alreadyCheckedIn = await hasCheckedInToday(user.id)
    if (alreadyCheckedIn.error) {
      logWarn({
        event: 'readiness_create_failed',
        outcome: 'failure',
        route: '/api/readiness',
        userId: user.id,
        entityType: 'readiness_checkin',
        durationMs: Date.now() - startedAt,
        data: { reason: alreadyCheckedIn.error },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to verify today\'s check-in status.' },
        { status: 500 },
      )
    }

    if (alreadyCheckedIn.data === true) {
      logWarn({
        event: 'readiness_create_failed',
        outcome: 'failure',
        route: '/api/readiness',
        userId: user.id,
        entityType: 'readiness_checkin',
        durationMs: Date.now() - startedAt,
        data: { reason: 'already_checked_in' },
      })

      return NextResponse.json(
        {
          data: null,
          error: 'Already checked in today. Only one check-in per day is allowed.',
        },
        { status: 409 },
      )
    }

    const today = new Date().toISOString().split('T')[0] as string
    const result = await createCheckin(
      { ...checkinInput, date: today, user_id: user.id },
      injury_area_health as InjuryAreaHealth[],
    )
    if (result.error) {
      logWarn({
        event: 'readiness_create_failed',
        outcome: 'failure',
        route: '/api/readiness',
        userId: user.id,
        entityType: 'readiness_checkin',
        durationMs: Date.now() - startedAt,
        data: { reason: result.error },
      })

      if (result.error.includes('Already checked in today')) {
        return NextResponse.json(
          { data: null, error: result.error },
          { status: 409 },
        )
      }

      return NextResponse.json(
        { data: null, error: result.error },
        { status: 500 },
      )
    }

    const context = await buildAthleteContext(user.id)

    logInfo({
      event: 'readiness_created',
      outcome: 'success',
      route: '/api/readiness',
      userId: user.id,
      entityType: 'readiness_checkin',
      entityId: (result.data as ReadinessCheckin).id,
      durationMs: Date.now() - startedAt,
      data: { warningCount: context.warnings.length },
    })

    return NextResponse.json(
      {
        data: {
          checkin: result.data as ReadinessCheckin,
          warnings: context.warnings,
        },
        error: null,
      },
      { status: 201 },
    )
  } catch (error) {
    const authError = handleRouteAuthError(error)

    if (authError !== null) {
      logWarn({
        event: 'readiness_create_failed',
        outcome: 'failure',
        route: '/api/readiness',
        entityType: 'readiness_checkin',
        durationMs: Date.now() - startedAt,
        data: { reason: authError.reason },
      })

      return authError.response
    }

    logError({
      event: 'readiness_create_failed',
      outcome: 'failure',
      route: '/api/readiness',
      entityType: 'readiness_checkin',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to save check-in. Please try again.' },
      { status: 500 },
    )
  }
}

/**
 * @description Deletes today's readiness check-in, allowing the athlete to
 * resubmit. Returns 404 if no check-in exists for today.
 */
export async function DELETE(): Promise<NextResponse<ApiResponse<{ deleted: true }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const result = await deleteTodaysCheckin(user.id)
    if (result.error !== null) {
      logWarn({
        event: 'readiness_delete_failed',
        outcome: 'failure',
        route: '/api/readiness',
        userId: user.id,
        entityType: 'readiness_checkin',
        durationMs: Date.now() - startedAt,
        data: { reason: result.error },
      })

      return NextResponse.json(
        { data: null, error: 'No check-in found for today.' },
        { status: 404 },
      )
    }

    logInfo({
      event: 'readiness_deleted',
      outcome: 'success',
      route: '/api/readiness',
      userId: user.id,
      entityType: 'readiness_checkin',
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({ data: { deleted: true }, error: null })
  } catch (error) {
    const authError = handleRouteAuthError(error)

    if (authError !== null) {
      logWarn({
        event: 'readiness_delete_failed',
        outcome: 'failure',
        route: '/api/readiness',
        entityType: 'readiness_checkin',
        durationMs: Date.now() - startedAt,
        data: { reason: authError.reason },
      })

      return authError.response
    }

    logError({
      event: 'readiness_delete_failed',
      outcome: 'failure',
      route: '/api/readiness',
      entityType: 'readiness_checkin',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to delete check-in.' },
      { status: 500 },
    )
  }
}

/**
 * @description Retrieves recent readiness check-ins, today's check-in, and the
 * 7-day average readiness score. Partial results are returned when individual
 * queries fail — a dashboard can still render with incomplete data. Accepts an
 * optional `days` query parameter (1–90, default 7).
 * @returns The check-in history, today's check-in (or null), a boolean
 * indicating whether the user has already checked in today, and the 7-day
 * average readiness score.
 */
export async function GET(
  request: NextRequest,
): Promise<
  NextResponse<
    ApiResponse<{
      checkins: ReadinessCheckin[]
      todaysCheckin: ReadinessCheckin | null
      hasCheckedInToday: boolean
      weeklyAvg: number
      warnings: string[]
    }>
  >
> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const days = Number(request.nextUrl.searchParams.get('days') ?? '7')
    const safeDays = Math.min(Math.max(days, 1), 90)

    const [checkinsResult, todayResult, avgResult, lastSessionResult, activeInjuryAreasResult] = await Promise.all([
      getRecentCheckins(safeDays, user.id),
      getTodaysCheckin(user.id),
      getAverageReadiness(7, user.id),
      getLastSessionDate(user.id),
      getActiveInjuryAreas(user.id),
    ])

    if (checkinsResult.error) {
      logWarn({
        event: 'readiness_data_partial',
        outcome: 'failure',
        route: '/api/readiness',
        userId: user.id,
        entityType: 'readiness_checkin',
        durationMs: Date.now() - startedAt,
        data: { source: 'getRecentCheckins', reason: checkinsResult.error },
      })
    }
    if (todayResult.error) {
      logWarn({
        event: 'readiness_data_partial',
        outcome: 'failure',
        route: '/api/readiness',
        userId: user.id,
        entityType: 'readiness_checkin',
        durationMs: Date.now() - startedAt,
        data: { source: 'getTodaysCheckin', reason: todayResult.error },
      })
    }
    if (avgResult.error) {
      logWarn({
        event: 'readiness_data_partial',
        outcome: 'failure',
        route: '/api/readiness',
        userId: user.id,
        entityType: 'readiness_checkin',
        durationMs: Date.now() - startedAt,
        data: { source: 'getAverageReadiness', reason: avgResult.error },
      })
    }
    if (lastSessionResult.error) {
      logWarn({
        event: 'readiness_data_partial',
        outcome: 'failure',
        route: '/api/readiness',
        userId: user.id,
        entityType: 'session',
        durationMs: Date.now() - startedAt,
        data: { source: 'getLastSessionDate', reason: lastSessionResult.error },
      })
    }
    if (activeInjuryAreasResult.error) {
      logWarn({
        event: 'readiness_data_partial',
        outcome: 'failure',
        route: '/api/readiness',
        userId: user.id,
        entityType: 'injury_area',
        durationMs: Date.now() - startedAt,
        data: { source: 'getActiveInjuryAreas', reason: activeInjuryAreasResult.error },
      })
    }

    const daysSinceLastSession = lastSessionResult.data
      ? Math.floor((Date.now() - new Date(lastSessionResult.data).getTime()) / 86400000)
      : 999
    const injuryAreas = parseInjuryAreaHealth(todayResult.data?.injury_area_health ?? null)
    const warnings = todayResult.data
      ? computeWarnings(todayResult.data, avgResult.data ?? 0, daysSinceLastSession, injuryAreas)
      : []

    logInfo({
      event: 'readiness_loaded',
      outcome: 'success',
      route: '/api/readiness',
      userId: user.id,
      entityType: 'readiness_checkin',
      durationMs: Date.now() - startedAt,
      data: {
        days: safeDays,
        checkinCount: (checkinsResult.data ?? []).length,
        hasCheckedInToday: todayResult.data !== null,
      },
    })

    return NextResponse.json({
      data: {
        checkins: checkinsResult.data ?? [],
        todaysCheckin: todayResult.data ?? null,
        hasCheckedInToday: todayResult.data !== null,
        weeklyAvg: avgResult.data ?? 0,
        warnings,
      },
      error: null,
    })
  } catch (error) {
    const authError = handleRouteAuthError(error)

    if (authError !== null) {
      logWarn({
        event: 'readiness_load_failed',
        outcome: 'failure',
        route: '/api/readiness',
        entityType: 'readiness_checkin',
        durationMs: Date.now() - startedAt,
        data: { reason: authError.reason },
      })

      return authError.response
    }

    logError({
      event: 'readiness_load_failed',
      outcome: 'failure',
      route: '/api/readiness',
      entityType: 'readiness_checkin',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to load readiness data. Please try again.' },
      { status: 500 },
    )
  }
}
