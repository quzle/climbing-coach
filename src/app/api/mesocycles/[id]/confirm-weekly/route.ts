import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteAuthError } from '@/lib/errors'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types'

// =============================================================================
// SCHEMA
// =============================================================================

const confirmWeeklyBodySchema = z.object({
  slots: z
    .array(
      z.object({
        day_of_week: z.number().int().min(0).max(6),
        session_label: z.string().max(120),
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
        intensity: z.enum(['high', 'medium', 'low']),
        duration_mins: z.number().int().min(1).max(480),
        primary_focus: z.string().max(200).nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
      }),
    )
    .min(1)
    .max(7),
})

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * @description Bulk-inserts confirmed weekly template slots for a mesocycle.
 * Deletes any existing templates first to ensure idempotent re-runs.
 * @returns Count of inserted rows.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ count: number }>>> {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    const body: unknown = await request.json()
    const parsed = confirmWeeklyBodySchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => e.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const supabase = await createClient()

    // Delete existing templates for this mesocycle (idempotent)
    const { error: deleteError } = await supabase
      .from('weekly_templates')
      .delete()
      .eq('mesocycle_id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('[POST /api/mesocycles/[id]/confirm-weekly] delete error:', deleteError)
      return NextResponse.json(
        { data: null, error: 'Failed to clear existing weekly templates.' },
        { status: 500 },
      )
    }

    // Bulk insert all slots
    const rows = parsed.data.slots.map((slot) => ({
      mesocycle_id: id,
      user_id: user.id,
      day_of_week: slot.day_of_week,
      session_label: slot.session_label,
      session_type: slot.session_type,
      intensity: slot.intensity,
      duration_mins: slot.duration_mins,
      primary_focus: slot.primary_focus ?? null,
      notes: slot.notes ?? null,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('weekly_templates')
      .insert(rows)
      .select()

    if (insertError) {
      console.error('[POST /api/mesocycles/[id]/confirm-weekly] insert error:', insertError)
      return NextResponse.json(
        { data: null, error: 'Failed to save weekly templates.' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { data: { count: inserted?.length ?? rows.length }, error: null },
      { status: 201 },
    )
  } catch (error) {
    const authError = handleRouteAuthError(error)
    if (authError !== null) {
      return authError.response
    }

    console.error('[POST /api/mesocycles/[id]/confirm-weekly]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to confirm weekly plan. Please try again.' },
      { status: 500 },
    )
  }
}
