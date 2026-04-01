import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createWeeklyTemplate,
  getWeeklyTemplateByMesocycle,
} from '@/services/data/weeklyTemplateRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { logError, logInfo, logWarn } from '@/lib/logger'
import type { ApiResponse, WeeklyTemplate } from '@/types'

const querySchema = z.object({ mesocycle_id: z.string().uuid() })

const createWeeklyTemplateSchema = z.object({
  mesocycle_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  session_label: z.string().min(1).max(120),
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
  duration_mins: z.number().int().min(1).max(480).nullable().optional(),
  primary_focus: z.string().max(200).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

/**
 * @description Lists weekly templates for a given mesocycle_id.
 * @returns Weekly templates ordered by day_of_week.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ weeklyTemplates: WeeklyTemplate[] }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const parsed = querySchema.safeParse({
      mesocycle_id: request.nextUrl.searchParams.get('mesocycle_id'),
    })

    if (!parsed.success) {
      logWarn({
        event: 'weekly_templates_list_failed',
        outcome: 'failure',
        route: '/api/weekly-templates',
        userId: user.id,
        entityType: 'weekly_template',
        durationMs: Date.now() - startedAt,
        data: { reason: 'validation_failed' },
      })

      return NextResponse.json(
        { data: null, error: 'mesocycle_id query param is required and must be a UUID.' },
        { status: 400 },
      )
    }

    const result = await getWeeklyTemplateByMesocycle(parsed.data.mesocycle_id, user.id)
    if (result.error !== null) {
      logWarn({
        event: 'weekly_templates_list_failed',
        outcome: 'failure',
        route: '/api/weekly-templates',
        userId: user.id,
        entityType: 'weekly_template',
        durationMs: Date.now() - startedAt,
        data: {
          mesocycleId: parsed.data.mesocycle_id,
          reason: result.error,
        },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to load weekly templates.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'weekly_templates_listed',
      outcome: 'success',
      route: '/api/weekly-templates',
      userId: user.id,
      entityType: 'weekly_template',
      durationMs: Date.now() - startedAt,
      data: {
        mesocycleId: parsed.data.mesocycle_id,
        count: (result.data ?? []).length,
      },
    })

    return NextResponse.json({ data: { weeklyTemplates: result.data ?? [] }, error: null })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      logWarn({
        event: 'weekly_templates_list_failed',
        outcome: 'failure',
        route: '/api/weekly-templates',
        entityType: 'weekly_template',
        durationMs: Date.now() - startedAt,
        data: { reason: 'unauthenticated' },
      })

      return NextResponse.json({ data: null, error: 'Unauthenticated.' }, { status: 401 })
    }

    logError({
      event: 'weekly_templates_list_failed',
      outcome: 'failure',
      route: '/api/weekly-templates',
      entityType: 'weekly_template',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to load weekly templates.' },
      { status: 500 },
    )
  }
}

/**
 * @description Creates a weekly template slot.
 * @returns Created weekly template row.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ weeklyTemplate: WeeklyTemplate }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const parsed = createWeeklyTemplateSchema.safeParse(await request.json())

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message).join(', ')
      logWarn({
        event: 'weekly_template_create_failed',
        outcome: 'failure',
        route: '/api/weekly-templates',
        userId: user.id,
        entityType: 'weekly_template',
        durationMs: Date.now() - startedAt,
        data: { reason: 'validation_failed', messages },
      })

      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const result = await createWeeklyTemplate({
      ...parsed.data,
      duration_mins: parsed.data.duration_mins ?? null,
      primary_focus: parsed.data.primary_focus ?? null,
      notes: parsed.data.notes ?? null,
      user_id: user.id,
    })

    if (result.error !== null || result.data === null) {
      logWarn({
        event: 'weekly_template_create_failed',
        outcome: 'failure',
        route: '/api/weekly-templates',
        userId: user.id,
        entityType: 'weekly_template',
        durationMs: Date.now() - startedAt,
        data: {
          mesocycleId: parsed.data.mesocycle_id,
          dayOfWeek: parsed.data.day_of_week,
          reason: result.error,
        },
      })

      return NextResponse.json(
        { data: null, error: 'Failed to create weekly template.' },
        { status: 500 },
      )
    }

    logInfo({
      event: 'weekly_template_created',
      outcome: 'success',
      route: '/api/weekly-templates',
      userId: user.id,
      entityType: 'weekly_template',
      entityId: result.data.id,
      durationMs: Date.now() - startedAt,
      data: {
        mesocycleId: parsed.data.mesocycle_id,
        dayOfWeek: parsed.data.day_of_week,
      },
    })

    return NextResponse.json(
      { data: { weeklyTemplate: result.data }, error: null },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      logWarn({
        event: 'weekly_template_create_failed',
        outcome: 'failure',
        route: '/api/weekly-templates',
        entityType: 'weekly_template',
        durationMs: Date.now() - startedAt,
        data: { reason: 'unauthenticated' },
      })

      return NextResponse.json({ data: null, error: 'Unauthenticated.' }, { status: 401 })
    }

    logError({
      event: 'weekly_template_create_failed',
      outcome: 'failure',
      route: '/api/weekly-templates',
      entityType: 'weekly_template',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'Failed to create weekly template.' },
      { status: 500 },
    )
  }
}
