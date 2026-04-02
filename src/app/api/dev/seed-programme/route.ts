import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { requireSuperuser } from '@/lib/supabase/get-current-user'
import {
  seedSummerMultipitchProgramme,
  type SeedProgrammeResult,
} from '@/services/training/programmeSeed'
import type { ApiResponse } from '@/types'

const requestSchema = z
  .object({
    targetUserId: z.string().uuid().optional(),
  })
  .optional()

/**
 * @description Seeds a deterministic Phase 2F starter programme for development and local testing.
 * This route is intentionally disabled in production.
 * @returns Creation summary for the seeded programme tree.
 */
export async function POST(
  request: NextRequest,
): Promise<
  NextResponse<ApiResponse<SeedProgrammeResult>>
> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ data: null, error: 'Not found.' }, { status: 404 })
  }

  try {
    const user = await requireSuperuser()
    const requestBody: unknown = await request.json().catch(() => undefined)
    const parsed = requestSchema.safeParse(requestBody)

    if (!parsed.success) {
      logWarn({
        event: 'privileged_dev_action_executed',
        outcome: 'failure',
        route: '/api/dev/seed-programme',
        userId: user.id,
        profileRole: 'superuser',
        entityType: 'dev_action',
        entityId: 'seed_programme',
        data: {
          reason: 'validation_failed',
          issueCount: parsed.error.issues.length,
        },
      })

      return NextResponse.json(
        { data: null, error: 'Invalid request.' },
        { status: 400 },
      )
    }

    const targetUserId = parsed.data?.targetUserId ?? user.id
    const result = await seedSummerMultipitchProgramme(targetUserId)

    if (result.error !== null || result.data === null) {
      logError({
        event: 'privileged_dev_action_executed',
        outcome: 'failure',
        route: '/api/dev/seed-programme',
        userId: user.id,
        profileRole: 'superuser',
        entityType: 'dev_action',
        entityId: 'seed_programme',
        error: result.error,
        data: {
          targetUserId,
        },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to seed programme data.' },
        { status: 500 },
      )
    }

    if (!result.data.seeded) {
      logWarn({
        event: 'privileged_dev_action_executed',
        outcome: 'failure',
        route: '/api/dev/seed-programme',
        userId: user.id,
        profileRole: 'superuser',
        entityType: 'dev_action',
        entityId: 'seed_programme',
        data: {
          reason: 'reset_required_before_reseed',
          targetUserId,
        },
      })

      return NextResponse.json(
        { data: null, error: 'Reset is required before reseeding this user.' },
        { status: 409 },
      )
    }

    logInfo({
      event: 'privileged_dev_action_executed',
      outcome: 'success',
      route: '/api/dev/seed-programme',
      userId: user.id,
      profileRole: 'superuser',
      entityType: 'dev_action',
      entityId: 'seed_programme',
      data: {
        targetUserId,
        programmeId: result.data.programmeId,
      },
    })

    return NextResponse.json({ data: result.data, error: null }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      return NextResponse.json(
        { data: null, error: 'Authentication required.' },
        { status: 401 },
      )
    }

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ data: null, error: 'Forbidden.' }, { status: 403 })
    }

    logError({
      event: 'privileged_dev_action_executed',
      outcome: 'failure',
      route: '/api/dev/seed-programme',
      entityType: 'dev_action',
      entityId: 'seed_programme',
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to seed programme data.' },
      { status: 500 },
    )
  }
}