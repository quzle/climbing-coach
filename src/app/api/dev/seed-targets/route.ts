import { NextResponse } from 'next/server'
import { logError, logWarn } from '@/lib/logger'
import { requireSuperuser } from '@/lib/supabase/get-current-user'
import { listProfiles } from '@/services/data/profilesRepository'
import type { ApiResponse } from '@/types'

export type SeedTargetUser = {
  id: string
  email: string
  display_name: string | null
  role: 'user' | 'superuser'
  invite_status: 'invited' | 'active'
}

/**
 * @description Lists possible target users for dev seed/reset actions.
 * @returns Profile-derived target user options for superuser tooling.
 */
export async function GET(): Promise<
  NextResponse<ApiResponse<SeedTargetUser[]>>
> {
  try {
    await requireSuperuser()

    const result = await listProfiles()
    if (result.error !== null || result.data === null) {
      return NextResponse.json(
        { data: null, error: 'Failed to load seed target users.' },
        { status: 500 },
      )
    }

    const users: SeedTargetUser[] = result.data.map((profile) => ({
      id: profile.id,
      email: profile.email,
      display_name: profile.display_name,
      role: profile.role,
      invite_status: profile.invite_status,
    }))

    return NextResponse.json({ data: users, error: null }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      logWarn({
        event: 'privileged_dev_action_executed',
        outcome: 'failure',
        route: '/api/dev/seed-targets',
        entityType: 'dev_action',
        entityId: 'seed_target_list',
        data: {
          reason: 'unauthenticated',
        },
      })

      return NextResponse.json(
        { data: null, error: 'Authentication required.' },
        { status: 401 },
      )
    }

    if (error instanceof Error && error.message === 'Forbidden') {
      logWarn({
        event: 'privileged_dev_action_executed',
        outcome: 'failure',
        route: '/api/dev/seed-targets',
        entityType: 'dev_action',
        entityId: 'seed_target_list',
        data: {
          reason: 'forbidden',
          requiredRole: 'superuser',
        },
      })

      return NextResponse.json({ data: null, error: 'Forbidden.' }, { status: 403 })
    }

    logError({
      event: 'privileged_dev_action_executed',
      outcome: 'failure',
      route: '/api/dev/seed-targets',
      entityType: 'dev_action',
      entityId: 'seed_target_list',
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to load seed target users.' },
      { status: 500 },
    )
  }
}
