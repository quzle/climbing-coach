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
 * @description Receives a reviewed wizard plan and bulk-creates the programme,
 * all mesocycles, and all weekly templates in the database. Mesocycle dates are
 * computed sequentially from wizard_input.start_date and each block's
 * duration_weeks.
 *
 * @returns 201 with the newly created programme_id, or 400/500 on failure.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ programme_id: string }>>> {
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

    // 2. Create mesocycles and weekly templates sequentially (each start date
    //    depends on the previous block's end date)
    let blockStart = wizard_input.start_date

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

      if (meso.weekly_templates.length > 0) {
        const { error: templateError } = await supabase.from('weekly_templates').insert(
          meso.weekly_templates.map((t) => ({
            mesocycle_id: mesocycle.id,
            day_of_week: t.day_of_week,
            session_label: t.session_label,
            session_type: t.session_type,
            intensity: t.intensity,
            duration_mins: t.duration_mins,
            primary_focus: t.primary_focus ?? null,
            notes: t.notes ?? null,
          })),
        )

        if (templateError) {
          console.error('[POST /api/programme/confirm] create weekly templates:', templateError)
          return NextResponse.json(
            { data: null, error: `Failed to create weekly templates for "${meso.name}".` },
            { status: 500 },
          )
        }
      }

      blockStart = addDaysToDate(blockEnd, 1)
    }

    return NextResponse.json(
      { data: { programme_id: programme.id }, error: null },
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
