import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logError, logInfo } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { requireSuperuser } from '@/lib/supabase/get-current-user'
import type { ApiResponse } from '@/types'

const requestSchema = z
  .object({
    targetUserId: z.string().uuid().optional(),
  })
  .optional()

export type ClearAllResult = {
  targetUserId: string
  tablesCleared: Record<string, number>
}

// Delete order: children before parents to respect FK constraints.
const DELETE_ORDER = [
  'session_logs',
  'planned_sessions',
  'weekly_templates',
  'mesocycles',
  'programmes',
  'readiness_checkins',
  'chat_messages',
  'injury_areas',
] as const

/**
 * @description Deletes all rows from all application tables. Dev-only.
 * @returns Per-table row counts for the deleted rows.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<ClearAllResult>>> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ data: null, error: 'Not found.' }, { status: 404 })
  }

  try {
    const user = await requireSuperuser()
    const requestBody: unknown = await request.json().catch(() => undefined)
    const parsed = requestSchema.safeParse(requestBody)

    if (!parsed.success) {
      return NextResponse.json({ data: null, error: 'Invalid request.' }, { status: 400 })
    }

    const targetUserId = parsed.data?.targetUserId ?? user.id

    const supabase = await createClient()
    const tablesCleared: Record<string, number> = {}

    for (const table of DELETE_ORDER) {
      // Delete all rows by matching on a column that is always present.
      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', targetUserId)
        .select('id')

      if (error) {
        logError({
          event: 'privileged_dev_action_executed',
          outcome: 'failure',
          route: '/api/dev/clear-all',
          userId: user.id,
          profileRole: 'superuser',
          entityType: 'dev_action',
          entityId: 'clear_all',
          data: {
            table,
            targetUserId,
          },
          error,
        })

        return NextResponse.json(
          { data: null, error: `Failed to clear table: ${table}` },
          { status: 500 },
        )
      }

      tablesCleared[table] = data?.length ?? 0
    }

    logInfo({
      event: 'privileged_dev_action_executed',
      outcome: 'success',
      route: '/api/dev/clear-all',
      userId: user.id,
      profileRole: 'superuser',
      entityType: 'dev_action',
      entityId: 'clear_all',
      data: {
        targetUserId,
        tables_cleared: tablesCleared,
      },
    })

    return NextResponse.json(
      { data: { targetUserId, tablesCleared }, error: null },
      { status: 200 },
    )
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
      route: '/api/dev/clear-all',
      entityType: 'dev_action',
      entityId: 'clear_all',
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to clear database.' },
      { status: 500 },
    )
  }
}
