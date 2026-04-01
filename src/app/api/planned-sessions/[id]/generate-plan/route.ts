import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { buildAthleteContext } from '@/services/ai/contextBuilder'
import { generateSessionPlan } from '@/services/ai/geminiClient'
import { getMesocycleById } from '@/services/data/mesocycleRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getPlannedSessionById, updatePlannedSession } from '@/services/data/plannedSessionRepository'
import { getWeeklyTemplateById } from '@/services/data/weeklyTemplateRepository'
import type { Json } from '@/lib/database.types'
import type { ApiResponse, Mesocycle, PlannedSession, SessionLog, WeeklyTemplate } from '@/types'

const paramsSchema = z.object({ id: z.string().uuid() })

type GeneratedPlanMetadata = {
  session_label?: string
  intensity?: string
  primary_focus?: string | null
  duration_mins?: number | null
  ai_plan_text?: string
  readiness_avg_7d?: number
}

/**
 * @description Returns the most recent session of a given type from history.
 */
function getLatestSameTypeSession(
  sessions: SessionLog[],
  sessionType: string,
): SessionLog | null {
  return sessions.find((s) => s.session_type === sessionType) ?? null
}

/**
 * @description Builds the additional context string passed to Gemini for session
 * plan generation, using the freshest available athlete data at call time.
 */
function buildAdditionalContext(
  mesocycle: Mesocycle,
  template: WeeklyTemplate,
  recentSessions: SessionLog[],
  readinessAvg: number,
): string {
  const lastSameType = getLatestSameTypeSession(recentSessions, template.session_type)

  const lines = [
    `Mesocycle: ${mesocycle.name}`,
    `Phase type: ${mesocycle.phase_type}`,
    `Mesocycle focus: ${mesocycle.focus}`,
    `Template session label: ${template.session_label}`,
    `Template intensity: ${template.intensity}`,
    `Template target duration: ${template.duration_mins ?? 'unspecified'} minutes`,
    `Template primary focus: ${template.primary_focus ?? 'not specified'}`,
    `Current 7-day readiness average: ${readinessAvg.toFixed(2)}/5`,
  ]

  if (lastSameType !== null) {
    lines.push(`Last ${template.session_type} session date: ${lastSameType.date}`)
    lines.push(
      `Last ${template.session_type} quality/rpe: ${lastSameType.quality_rating ?? 'N/A'}/5, ${lastSameType.rpe ?? 'N/A'}/10`,
    )
    lines.push(`Last ${template.session_type} notes: ${lastSameType.notes ?? 'none'}`)
  } else {
    lines.push(`No recent ${template.session_type} session found in the last 30 days.`)
  }

  lines.push(
    'Apply progressive overload conservatively (typically +/-10-20% volume) based on readiness and previous same-type session response.',
  )

  return lines.join('\n')
}

/**
 * @description Generates and caches an AI session plan for a planned session.
 * Idempotent: if ai_plan_text already exists in generated_plan the cached
 * value is returned without calling Gemini again.
 * @returns The generated ai_plan_text string
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ ai_plan_text: string }>>> {
  try {
    const user = await getCurrentUser()
    const parsedParams = paramsSchema.safeParse(await context.params)
    if (!parsedParams.success) {
      return NextResponse.json(
        { data: null, error: 'Invalid planned session id.' },
        { status: 400 },
      )
    }

    const sessionId = parsedParams.data.id

    // Fetch the planned session.
    const sessionResult = await getPlannedSessionById(sessionId)
    if (sessionResult.error !== null || sessionResult.data === null) {
      return NextResponse.json(
        { data: null, error: 'Planned session not found.' },
        { status: 404 },
      )
    }

    const session = sessionResult.data
    const existingPlan = session.generated_plan as GeneratedPlanMetadata | null

    // Idempotent: return cached plan if already generated.
    if (existingPlan?.ai_plan_text) {
      return NextResponse.json({ data: { ai_plan_text: existingPlan.ai_plan_text }, error: null })
    }

    // Require a mesocycle and template to generate a meaningful plan.
    if (!session.mesocycle_id || !session.template_id) {
      return NextResponse.json(
        { data: null, error: 'Session has no associated mesocycle or template.' },
        { status: 422 },
      )
    }

    // Fetch mesocycle, template, and athlete context in parallel.
    const [mesocycleResult, templateResult, athleteContext] = await Promise.all([
      getMesocycleById(session.mesocycle_id, user.id),
      getWeeklyTemplateById(session.template_id),
      buildAthleteContext(),
    ])

    if (mesocycleResult.error !== null || mesocycleResult.data === null) {
      return NextResponse.json(
        { data: null, error: 'Failed to load mesocycle context.' },
        { status: 500 },
      )
    }
    if (templateResult.error !== null || templateResult.data === null) {
      return NextResponse.json(
        { data: null, error: 'Failed to load template context.' },
        { status: 500 },
      )
    }

    const mesocycle = mesocycleResult.data
    const template = templateResult.data

    const additionalContext = buildAdditionalContext(
      mesocycle,
      template,
      athleteContext.recentSessions,
      athleteContext.weeklyReadinessAvg,
    )

    const aiPlanText = await generateSessionPlan(template.session_type, additionalContext)

    // Merge ai_plan_text into the existing metadata and persist.
    const updatedPlan: GeneratedPlanMetadata = {
      ...existingPlan,
      ai_plan_text: aiPlanText,
      readiness_avg_7d: Number(athleteContext.weeklyReadinessAvg.toFixed(2)),
    }

    const updateResult = await updatePlannedSession(sessionId, {
      generated_plan: updatedPlan as unknown as Json,
    })

    if (updateResult.error !== null) {
      console.error('[POST /api/planned-sessions/:id/generate-plan] updatePlannedSession:', updateResult.error)
      // Return the generated text anyway — the client can still display it.
      return NextResponse.json({ data: { ai_plan_text: aiPlanText }, error: null })
    }

    return NextResponse.json({ data: { ai_plan_text: aiPlanText }, error: null })
  } catch (err) {
    console.error('[POST /api/planned-sessions/:id/generate-plan] unexpected error', err)
    return NextResponse.json(
      { data: null, error: 'Failed to generate session plan.' },
      { status: 500 },
    )
  }
}
