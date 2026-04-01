import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import { getMesocycleById } from '@/services/data/mesocycleRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import {
  weeklyPlanInputSchema,
  generatedWeeklyTemplateSchema,
  DAY_LABELS,
  PREFERRED_STYLE_LABELS,
} from '@/lib/programme-wizard'
import type { GeneratedWeeklyTemplate, WeeklyPlanInput, DayPin } from '@/lib/programme-wizard'
import type { ApiResponse } from '@/types'

// =============================================================================
// CONSTANTS
// =============================================================================

const MODEL_NAME = 'gemini-3.1-flash-lite-preview'
const MAX_OUTPUT_TOKENS = 1000
const TEMPERATURE = 0.3

const SYSTEM_INSTRUCTION = `You are a climbing training coach generating a weekly session schedule.
Output ONLY a JSON array of session slot objects. No prose, no markdown fences, no text before or after.

Each slot must follow this schema exactly:
{
  "day_of_week": integer 0-6 (0=Mon, 6=Sun),
  "session_label": "string (≤60 chars)",
  "session_type": "bouldering" | "kilterboard" | "lead" | "fingerboard" | "strength" | "aerobic" | "rest" | "mobility",
  "intensity": "high" | "medium" | "low",
  "duration_mins": integer 30-180,
  "primary_focus": "string | null (≤100 chars)",
  "notes": "string | null (≤100 chars)"
}

Hard rules:
- Only use day_of_week values from the available_days list
- Locked day pins MUST be respected exactly (specific style on specific day)
- No two consecutive high-intensity days
- Include at least one rest/recovery day per week (either no slot on that day, or a mobility/aerobic low-intensity slot)
- Match the phase intensity profile: base=low/medium, power=medium/high, deload=all low`

// =============================================================================
// SCHEMA
// =============================================================================

const generatedWeeklySlotsSchema = z.array(generatedWeeklyTemplateSchema).min(1).max(7)

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function formatDayList(days: number[]): string {
  return days.map((d) => `${d} (${DAY_LABELS[d] ?? d})`).join(', ')
}

function formatDayPins(pins: DayPin[]): string {
  if (pins.length === 0) return 'None'
  return pins
    .map((pin) => {
      const styleName = PREFERRED_STYLE_LABELS[pin.style] ?? pin.style
      const dayName = DAY_LABELS[pin.day_of_week] ?? pin.day_of_week
      const lockTag = pin.locked ? '[LOCKED]' : ''
      const verb = pin.locked ? 'MUST be' : 'preferred'
      return `- ${styleName} ${verb} on day ${pin.day_of_week} (${dayName}) ${lockTag}`.trimEnd()
    })
    .join('\n')
}

function buildWeeklyUserMessage(
  input: WeeklyPlanInput,
  mesocycle: {
    name: string
    phase_type: string
    focus: string
    planned_start: string
    planned_end: string
  },
): string {
  const preferredStyleNames = input.preferred_styles
    .map((s) => PREFERRED_STYLE_LABELS[s] ?? s)
    .join(', ')

  return `Generate a weekly training session schedule for the following mesocycle block.

MESOCYCLE BLOCK:
- Name: ${mesocycle.name}
- Phase type: ${mesocycle.phase_type}
- Focus: ${mesocycle.focus}
- Dates: ${mesocycle.planned_start} → ${mesocycle.planned_end}

SCHEDULE CONSTRAINTS:
- Available training days: ${formatDayList(input.available_days)}
- Preferred session duration: ${input.preferred_duration_mins} minutes

DAY PINS (placement constraints):
${formatDayPins(input.day_pins)}

STYLE PREFERENCES:
- Preferred styles: ${preferredStyleNames}

Output the JSON array of session slots now.`
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * @description Accepts weekly schedule preferences for a mesocycle, calls Gemini
 * to generate weekly template slots, and returns the validated result.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<GeneratedWeeklyTemplate[]>>> {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    // Validate request body
    const body: unknown = await request.json()
    const parsed = weeklyPlanInputSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => e.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const input = parsed.data

    // Fetch mesocycle from DB
    const mesocycleResult = await getMesocycleById(id, user.id)
    if (mesocycleResult.error || !mesocycleResult.data) {
      return NextResponse.json(
        { data: null, error: 'Mesocycle not found.' },
        { status: 404 },
      )
    }

    const mesocycle = mesocycleResult.data

    // Check AI service config
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { data: null, error: 'AI service is not configured.' },
        { status: 503 },
      )
    }

    // Call Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE,
      },
    })

    const userMessage = buildWeeklyUserMessage(input, {
      name: mesocycle.name,
      phase_type: mesocycle.phase_type,
      focus: mesocycle.focus,
      planned_start: mesocycle.planned_start,
      planned_end: mesocycle.planned_end,
    })

    const chat = model.startChat({ history: [] })
    const result = await chat.sendMessage(userMessage)
    const rawText = result.response.text()

    // Strip markdown fences if model wraps output despite instructions
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    let rawJson: unknown
    try {
      rawJson = JSON.parse(jsonText)
    } catch {
      console.error(
        '[POST /api/mesocycles/[id]/generate-weekly] JSON parse failed. Raw:',
        rawText.slice(0, 600),
      )
      return NextResponse.json(
        { data: null, error: 'AI returned an invalid response. Please try again.' },
        { status: 502 },
      )
    }

    const slotsResult = generatedWeeklySlotsSchema.safeParse(rawJson)
    if (!slotsResult.success) {
      console.error(
        '[POST /api/mesocycles/[id]/generate-weekly] Schema validation failed:',
        slotsResult.error.issues,
      )
      return NextResponse.json(
        {
          data: null,
          error: 'AI returned a schedule with an unexpected structure. Please try again.',
        },
        { status: 502 },
      )
    }

    return NextResponse.json({ data: slotsResult.data, error: null })
  } catch (error) {
    console.error('[POST /api/mesocycles/[id]/generate-weekly]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to generate weekly schedule. Please try again.' },
      { status: 500 },
    )
  }
}
