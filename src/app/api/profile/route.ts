import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getProfile, updateProfile } from '@/services/data/profilesRepository'
import type { ApiResponse, Profile } from '@/types'

const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(120),
})

/**
 * @description Returns the authenticated user's profile metadata.
 * @returns Standard API response containing the profile row
 */
export async function GET(): Promise<NextResponse<ApiResponse<Profile>>> {
  try {
    const user = await getCurrentUser()
    const result = await getProfile(user.id)

    if (result.error !== null || result.data === null) {
      logWarn({
        event: 'profile_fetched',
        outcome: 'failure',
        route: '/api/profile',
        userId: user.id,
        entityType: 'profile',
        entityId: user.id,
        error: result.error,
        data: {
          reason: 'profile_repository_failed',
        },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to load profile.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'profile_fetched',
      outcome: 'success',
      route: '/api/profile',
      userId: user.id,
      profileRole: result.data.role,
      entityType: 'profile',
      entityId: result.data.id,
    })

    return NextResponse.json({ data: result.data, error: null }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      logWarn({
        event: 'profile_fetched',
        outcome: 'failure',
        route: '/api/profile',
        entityType: 'profile',
        data: {
          reason: 'unauthenticated',
        },
      })

      return NextResponse.json(
        { data: null, error: 'Authentication required.' },
        { status: 401 },
      )
    }

    logError({
      event: 'profile_fetched',
      outcome: 'failure',
      route: '/api/profile',
      entityType: 'profile',
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to load profile.' },
      { status: 500 },
    )
  }
}

/**
 * @description Updates the authenticated user's editable profile fields.
 * @param request Incoming request containing profile update payload
 * @returns Standard API response containing the updated profile row
 */
export async function PATCH(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<Profile>>> {
  try {
    const user = await getCurrentUser()
    const body: unknown = await request.json()
    const parsed = updateProfileSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message).join(', ')

      logWarn({
        event: 'profile_updated',
        outcome: 'failure',
        route: '/api/profile',
        userId: user.id,
        entityType: 'profile',
        entityId: user.id,
        data: {
          reason: 'validation_failed',
          issueCount: parsed.error.issues.length,
        },
      })

      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const result = await updateProfile(user.id, parsed.data)

    if (result.error !== null || result.data === null) {
      logWarn({
        event: 'profile_updated',
        outcome: 'failure',
        route: '/api/profile',
        userId: user.id,
        entityType: 'profile',
        entityId: user.id,
        error: result.error,
        data: {
          reason: 'profile_repository_failed',
        },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to update profile.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'profile_updated',
      outcome: 'success',
      route: '/api/profile',
      userId: user.id,
      profileRole: result.data.role,
      entityType: 'profile',
      entityId: result.data.id,
    })

    return NextResponse.json({ data: result.data, error: null }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      logWarn({
        event: 'profile_updated',
        outcome: 'failure',
        route: '/api/profile',
        entityType: 'profile',
        data: {
          reason: 'unauthenticated',
        },
      })

      return NextResponse.json(
        { data: null, error: 'Authentication required.' },
        { status: 401 },
      )
    }

    logError({
      event: 'profile_updated',
      outcome: 'failure',
      route: '/api/profile',
      entityType: 'profile',
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to update profile.' },
      { status: 500 },
    )
  }
}