import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types'

export type ClearAllResult = {
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
export async function POST(): Promise<NextResponse<ApiResponse<ClearAllResult>>> {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ data: null, error: 'Not found.' }, { status: 404 })
  }

  try {
    const supabase = await createClient()
    const tablesCleared: Record<string, number> = {}

    for (const table of DELETE_ORDER) {
      // Delete all rows by matching on a column that is always present.
      const { data, error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select('id')

      if (error) {
        console.error(`[POST /api/dev/clear-all] Failed to clear ${table}:`, error)
        return NextResponse.json(
          { data: null, error: `Failed to clear table: ${table}` },
          { status: 500 },
        )
      }

      tablesCleared[table] = data?.length ?? 0
    }

    return NextResponse.json({ data: { tablesCleared }, error: null }, { status: 200 })
  } catch (error) {
    console.error('[POST /api/dev/clear-all]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to clear database.' },
      { status: 500 },
    )
  }
}
