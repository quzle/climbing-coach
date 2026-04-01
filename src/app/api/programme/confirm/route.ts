import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
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
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const body: unknown = await request.json()
    const parsed = confirmBodySchema.safeParse(body)
    if (!parsed.success) {
      logWarn({
        event: 'programme_confirm_failed',
        outcome: 'failure',
        route: '/api/programme/confirm',
        userId: user.id,
        entityType: 'programme',
        durationMs: Date.now() - startedAt,
        data: { reason: 'validation_failed' },
      })

      return NextResponse.json(
        { data: null, error: 'Invalid request body.' },
        { status: 400 },
      )
    }

    const { wizard_input, plan } = parsed.data
    const supabase = await createClient()

    // 1. Deactivate any existing active programme so the partial unique index
    //    (user_id WHERE status = 'active') allows the new one to be inserted.
    const { error: deactivateError } = await supabase
      .from('programmes')
      .update({ status: 'completed' })
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (deactivateError) {
      logWarn({
        event: 'programme_confirm_failed',
        outcome: 'failure',
        route: '/api/programme/confirm',
        userId: user.id,
        entityType: 'programme',
        durationMs: Date.now() - startedAt,
        data: { reason: 'deactivate_failed' },
        error: deactivateError,
      })

      return NextResponse.json(
        { data: null, error: 'Failed to deactivate existing programme.' },
        { status: 500 },
      )
    }

    // 2. Create the programme record
    const { data: programme, error: programmeError } = await supabase
      .from('programmes')
      .insert({
        name: plan.programme.name,
        goal: plan.programme.goal,
        notes: plan.programme.notes ?? null,
        start_date: wizard_input.start_date,
        target_date: addDaysToDate(wizard_input.start_date, wizard_input.duration_weeks * 7 - 1),
        status: 'active',
        user_id: user.id,
        athlete_profile: {
          current_grade_bouldering: wizard_input.current_grade_bouldering ?? null,
          current_grade_sport: wizard_input.current_grade_sport ?? null,
          current_grade_onsight: wizard_input.current_grade_onsight ?? null,
          goal_grade: wizard_input.goal_grade ?? null,
          strengths: wizard_input.strengths,
          weaknesses: wizard_input.weaknesses,
          additional_context: wizard_input.additional_context ?? null,
        },
      })
      .select()
      .single()

    if (programmeError ?? !programme) {
      logWarn({
        event: 'programme_confirm_failed',
        outcome: 'failure',
        route: '/api/programme/confirm',
        userId: user.id,
        entityType: 'programme',
        durationMs: Date.now() - startedAt,
        data: { reason: 'programme_create_failed' },
        error: programmeError,
      })

      return NextResponse.json(
        { data: null, error: 'Failed to create programme.' },
        { status: 500 },
      )
    }

    // 3. Create mesocycles sequentially (each start date depends on the
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
          user_id: user.id,
        })
        .select()
        .single()

      if (mesoError ?? !mesocycle) {
        logWarn({
          event: 'programme_confirm_failed',
          outcome: 'failure',
          route: '/api/programme/confirm',
          userId: user.id,
          entityType: 'mesocycle',
          durationMs: Date.now() - startedAt,
          data: { reason: 'mesocycle_create_failed', mesocycleName: meso.name },
          error: mesoError,
        })

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
      logWarn({
        event: 'programme_confirm_failed',
        outcome: 'failure',
        route: '/api/programme/confirm',
        userId: user.id,
        entityType: 'programme',
        durationMs: Date.now() - startedAt,
        data: { reason: 'no_mesocycles_created' },
      })

      return NextResponse.json(
        { data: null, error: 'No mesocycles were created.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'programme_confirmed',
      outcome: 'success',
      route: '/api/programme/confirm',
      userId: user.id,
      entityType: 'programme',
      entityId: programme.id,
      durationMs: Date.now() - startedAt,
      data: {
        firstMesocycleId,
        mesocycleCount: plan.mesocycles.length,
      },
    })

    return NextResponse.json(
      { data: { programme_id: programme.id, first_mesocycle_id: firstMesocycleId }, error: null },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      logWarn({
        event: 'programme_confirm_failed',
        outcome: 'failure',
        route: '/api/programme/confirm',
        entityType: 'programme',
        durationMs: Date.now() - startedAt,
        data: { reason: 'unauthenticated' },
      })

      return NextResponse.json({ data: null, error: 'Unauthenticated.' }, { status: 401 })
    }

    logError({
      event: 'programme_confirm_failed',
      outcome: 'failure',
      route: '/api/programme/confirm',
      entityType: 'programme',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to create plan. Please try again.' },
      { status: 500 },
    )
  }
}
