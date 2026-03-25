import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createCheckin,
  getTodaysCheckin,
  getRecentCheckins,
  getAverageReadiness,
  hasCheckedInToday,
} from '@/services/data/readinessRepository'
import { buildAthleteContext } from '@/services/ai/contextBuilder'
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
  try {
    const body: unknown = await request.json()
    const parsed = readinessSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => e.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const validated = parsed.data
    const { injury_area_health, ...checkinInput } = validated

    const alreadyCheckedIn = await hasCheckedInToday()
    if (alreadyCheckedIn.error) {
      console.error(
        '[POST /api/readiness] hasCheckedInToday:',
        alreadyCheckedIn.error,
      )
      return NextResponse.json(
        { data: null, error: 'Failed to verify today\'s check-in status.' },
        { status: 500 },
      )
    }

    if (alreadyCheckedIn.data === true) {
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
      { ...checkinInput, date: today },
      injury_area_health as InjuryAreaHealth[],
    )
    if (result.error) {
      console.error('[POST /api/readiness]', result.error)

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

    const context = await buildAthleteContext()

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
    console.error('[POST /api/readiness]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to save check-in. Please try again.' },
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
    }>
  >
> {
  try {
    const days = Number(request.nextUrl.searchParams.get('days') ?? '7')
    const safeDays = Math.min(Math.max(days, 1), 90)

    const [checkinsResult, todayResult, avgResult] = await Promise.all([
      getRecentCheckins(safeDays),
      getTodaysCheckin(),
      getAverageReadiness(7),
    ])

    if (checkinsResult.error) {
      console.error('[GET /api/readiness] getRecentCheckins:', checkinsResult.error)
    }
    if (todayResult.error) {
      console.error('[GET /api/readiness] getTodaysCheckin:', todayResult.error)
    }
    if (avgResult.error) {
      console.error('[GET /api/readiness] getAverageReadiness:', avgResult.error)
    }

    return NextResponse.json({
      data: {
        checkins: checkinsResult.data ?? [],
        todaysCheckin: todayResult.data ?? null,
        hasCheckedInToday: todayResult.data !== null,
        weeklyAvg: avgResult.data ?? 0,
      },
      error: null,
    })
  } catch (error) {
    console.error('[GET /api/readiness]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to load readiness data. Please try again.' },
      { status: 500 },
    )
  }
}
