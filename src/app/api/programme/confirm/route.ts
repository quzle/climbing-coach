import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { wizardInputSchema, generatedPlanSchema, addDaysToDate } from '@/lib/programme-wizard'
import type { ApiResponse } from '@/types'

// =============================================================================
// INPUT SCHEMA
// =============================================================================

const confirmBodySchema = z.object({
  wizard_input: wizardInputSchema,
  plan: generatedPlanSchema,
})

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * @description Receives a reviewed wizard plan and bulk-creates the programme
 * and all mesocycles in the database. Mesocycle dates are computed sequentially
 * from wizard_input.start_date and each block's duration_weeks.
 *
 * @returns 201 with the newly created programme_id and first_mesocycle_id, or 400/500 on failure.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ programme_id: string; first_mesocycle_id: string }>>> {
  try {
    const body: unknown = await request.json()
    const parsed = confirmBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: 'Invalid request body.' },
        { status: 400 },
      )
    }

    const { wizard_input, plan } = parsed.data
    const supabase = await createClient()

    // 1. Create the programme record
    const { data: programme, error: programmeError } = await supabase
      .from('programmes')
      .insert({
        name: plan.programme.name,
        goal: plan.programme.goal,
        notes: plan.programme.notes ?? null,
        start_date: wizard_input.start_date,
        target_date: addDaysToDate(wizard_input.start_date, wizard_input.duration_weeks * 7 - 1),
      })
      .select()
      .single()

    if (programmeError ?? !programme) {
      console.error('[POST /api/programme/confirm] create programme:', programmeError)
      return NextResponse.json(
        { data: null, error: 'Failed to create programme.' },
        { status: 500 },
      )
    }

    // 2. Create mesocycles sequentially (each start date depends on the
    //    previous block's end date). Track the earliest to return as first_mesocycle_id.
    let blockStart = wizard_input.start_date
    let firstMesocycleId: string | null = null
    let firstMesocycleStart: string | null = null

    for (const meso of plan.mesocycles) {
      const blockEnd = addDaysToDate(blockStart, meso.duration_weeks * 7 - 1)

      const { data: mesocycle, error: mesoError } = await supabase
        .from('mesocycles')
        .insert({
          programme_id: programme.id,
          name: meso.name,
          focus: meso.focus,
          phase_type: meso.phase_type,
          planned_start: blockStart,
          planned_end: blockEnd,
          status: 'planned',
        })
        .select()
        .single()

      if (mesoError ?? !mesocycle) {
        console.error('[POST /api/programme/confirm] create mesocycle:', mesoError)
        return NextResponse.json(
          { data: null, error: `Failed to create mesocycle "${meso.name}".` },
          { status: 500 },
        )
      }

      if (firstMesocycleId === null || blockStart < (firstMesocycleStart ?? blockStart)) {
        firstMesocycleId = mesocycle.id
        firstMesocycleStart = blockStart
      }

      blockStart = addDaysToDate(blockEnd, 1)
    }

    if (!firstMesocycleId) {
      return NextResponse.json(
        { data: null, error: 'No mesocycles were created.' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { data: { programme_id: programme.id, first_mesocycle_id: firstMesocycleId }, error: null },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/programme/confirm]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to create plan. Please try again.' },
      { status: 500 },
    )
  }
}
