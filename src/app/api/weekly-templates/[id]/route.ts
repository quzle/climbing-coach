import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getWeeklyTemplateById,
  updateWeeklyTemplate,
} from '@/services/data/weeklyTemplateRepository'
import type { ApiResponse, WeeklyTemplate } from '@/types'

const paramsSchema = z.object({ id: z.string().uuid() })

const updateWeeklyTemplateSchema = z
  .object({
    day_of_week: z.number().int().min(1).max(7).optional(),
    session_label: z.string().min(1).max(120).optional(),
    session_type: z
      .enum([
        'bouldering',
        'kilterboard',
        'lead',
        'fingerboard',
        'strength',
        'aerobic',
        'rest',
        'mobility',
      ])
      .optional(),
    intensity: z.enum(['high', 'medium', 'low']).optional(),
    duration_mins: z.number().int().min(1).max(480).nullable().optional(),
    primary_focus: z.string().max(200).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update',
  })

/**
 * @description Fetches one weekly template row by UUID.
 * @returns Weekly template row.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ weeklyTemplate: WeeklyTemplate }>>> {
  try {
    const parsedParams = paramsSchema.safeParse(await context.params)
    if (!parsedParams.success) {
      return NextResponse.json(
        { data: null, error: 'Invalid weekly template id.' },
        { status: 400 },
      )
    }

    const result = await getWeeklyTemplateById(parsedParams.data.id)
    if (result.error !== null || result.data === null) {
      return NextResponse.json(
        { data: null, error: 'Failed to load weekly template.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: { weeklyTemplate: result.data }, error: null })
  } catch (error) {
    console.error('[GET /api/weekly-templates/:id]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to load weekly template.' },
      { status: 500 },
    )
  }
}

/**
 * @description Updates a weekly template row by UUID.
 * @returns Updated weekly template row.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ weeklyTemplate: WeeklyTemplate }>>> {
  try {
    const parsedParams = paramsSchema.safeParse(await context.params)
    if (!parsedParams.success) {
      return NextResponse.json(
        { data: null, error: 'Invalid weekly template id.' },
        { status: 400 },
      )
    }

    const parsedBody = updateWeeklyTemplateSchema.safeParse(await request.json())
    if (!parsedBody.success) {
      const messages = parsedBody.error.issues.map((issue) => issue.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const result = await updateWeeklyTemplate(parsedParams.data.id, parsedBody.data)
    if (result.error !== null || result.data === null) {
      return NextResponse.json(
        { data: null, error: 'Failed to update weekly template.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: { weeklyTemplate: result.data }, error: null })
  } catch (error) {
    console.error('[PUT /api/weekly-templates/:id]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to update weekly template.' },
      { status: 500 },
    )
  }
}
