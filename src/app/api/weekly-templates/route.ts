import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createWeeklyTemplate,
  getWeeklyTemplateByMesocycle,
} from '@/services/data/weeklyTemplateRepository'
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
  try {
    const parsed = querySchema.safeParse({
      mesocycle_id: request.nextUrl.searchParams.get('mesocycle_id'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: 'mesocycle_id query param is required and must be a UUID.' },
        { status: 400 },
      )
    }

    const result = await getWeeklyTemplateByMesocycle(parsed.data.mesocycle_id)
    if (result.error !== null) {
      console.error('[GET /api/weekly-templates]', result.error)
      return NextResponse.json(
        { data: null, error: 'Failed to load weekly templates.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: { weeklyTemplates: result.data ?? [] }, error: null })
  } catch (error) {
    console.error('[GET /api/weekly-templates]', error)
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
  try {
    const parsed = createWeeklyTemplateSchema.safeParse(await request.json())

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message).join(', ')
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
    })

    if (result.error !== null || result.data === null) {
      console.error('[POST /api/weekly-templates]', result.error)
      return NextResponse.json(
        { data: null, error: 'Failed to create weekly template.' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { data: { weeklyTemplate: result.data }, error: null },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/weekly-templates]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to create weekly template.' },
      { status: 500 },
    )
  }
}
