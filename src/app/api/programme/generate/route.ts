import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getActiveProgramme } from '@/services/data/programmeRepository'
import { getMesocyclesByProgramme } from '@/services/data/mesocycleRepository'
import { wizardInputSchema, generatedPlanSchema } from '@/lib/programme-wizard'
import type { WizardInput, GeneratedPlan } from '@/lib/programme-wizard'
import type { ApiResponse } from '@/types'

// =============================================================================
// CONSTANTS
// =============================================================================

const MODEL_NAME = 'gemini-3.1-flash-lite-preview'
const MAX_OUTPUT_TOKENS = 3000
const TEMPERATURE = 0.3

const SYSTEM_INSTRUCTION = `You are a climbing training periodisation expert. Output ONLY a single valid JSON object. No prose, no markdown fences, no text before or after the JSON.

JSON schema (all fields required unless marked nullable):
{
  "programme": {
    "name": "string (≤50 chars — short descriptive title)",
    "goal": "string (≤200 chars — refined goal statement)",
    "notes": "string | null (brief overview of the plan structure)"
  },
  "mesocycles": [
    {
      "name": "string (≤60 chars)",
      "focus": "string (≤200 chars — what this block trains)",
      "phase_type": "base" | "power" | "power_endurance" | "climbing_specific" | "performance" | "deload",
      "duration_weeks": integer (1–8 per block; deload = 1),
      "weekly_templates": [
        {
          "day_of_week": integer 0–6 (0=Mon, 6=Sun),
          "session_label": "string (≤60 chars)",
          "session_type": "bouldering" | "kilterboard" | "lead" | "fingerboard" | "strength" | "aerobic" | "rest" | "mobility",
          "intensity": "high" | "medium" | "low",
          "duration_mins": integer 30–180,
          "primary_focus": "string | null (≤100 chars)",
          "notes": "string | null (≤200 chars)"
        }
      ]
    }
  ]
}

Hard rules:
- mesocycles must be in chronological order (first block first)
- sum of all mesocycle duration_weeks must equal the requested total exactly
- weekly_templates must only use days from the available_days list
- intensity progression: base = low/medium; power = medium/high; deload = all low
- include a 1-week deload every 3–4 hard weeks`

// =============================================================================
// PROMPT BUILDER
// =============================================================================

const DAY_LABELS: Record<number, string> = {
  0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun',
}

function buildWizardUserMessage(input: WizardInput, historyText: string): string {
  const dayNames = input.available_days
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d] ?? String(d))
    .join(', ')

  const peakLine =
    input.peak_event_label && input.peak_event_date
      ? `Target event: ${input.peak_event_label} on ${input.peak_event_date}`
      : 'No specific target event'

  const injuriesLine = input.injuries?.trim()
    ? `Injuries/concerns: ${input.injuries}`
    : 'Injuries/concerns: None'

  return `Design a periodised climbing training plan.

ATHLETE:
- Bouldering: 6c/7a Font
- Sport climbing: 6c/7a
- Onsight (multipitch): ~6c
- Primary goal: Onsight 7a-7b multipitch

PARAMETERS:
- Goal: ${input.goal}
- Start date: ${input.start_date}
- Total duration: ${input.duration_weeks} weeks (duration_weeks must sum to exactly ${input.duration_weeks})
- ${peakLine}
- Available days: ${dayNames} (numeric: ${input.available_days.sort((a, b) => a - b).join(', ')})
- Sessions per week: ${input.available_days.length}
- Preferred session duration: ${input.preferred_duration_mins} min
- Preferred styles: ${input.preferred_styles.join(', ')}
- Primary focus: ${input.focus}
- ${injuriesLine}

TRAINING HISTORY (completed mesocycles, most recent first):
${historyText}

Output the JSON plan now.`
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * @description Accepts wizard form data, builds a Gemini prompt, parses and
 * validates the AI-generated JSON plan, and returns it for client-side review.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<GeneratedPlan>>> {
  try {
    const body: unknown = await request.json()
    const parsed = wizardInputSchema.safeParse(body)
    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => e.message).join(', ')
      return NextResponse.json(
        { data: null, error: `Invalid request: ${messages}` },
        { status: 400 },
      )
    }

    const input = parsed.data

    // Fetch completed mesocycles to give AI historical context
    let historyText = 'No prior mesocycles recorded.'
    try {
      const programmeResult = await getActiveProgramme()
      if (programmeResult.data) {
        const mesocyclesResult = await getMesocyclesByProgramme(programmeResult.data.id)
        const completed = (mesocyclesResult.data ?? []).filter((m) => m.status === 'completed')
        if (completed.length > 0) {
          historyText = completed
            .map(
              (m) =>
                `- ${m.name} (${m.phase_type}, ${m.planned_start} → ${m.planned_end}): ${m.focus}`,
            )
            .join('\n')
        }
      }
    } catch {
      // Non-fatal — proceed without history context
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { data: null, error: 'AI service is not configured.' },
        { status: 503 },
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE,
      },
    })

    const userMessage = buildWizardUserMessage(input, historyText)
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
      console.error('[POST /api/programme/generate] JSON parse failed. Raw:', rawText.slice(0, 600))
      return NextResponse.json(
        { data: null, error: 'AI returned an invalid response. Please try again.' },
        { status: 502 },
      )
    }

    const planResult = generatedPlanSchema.safeParse(rawJson)
    if (!planResult.success) {
      console.error('[POST /api/programme/generate] Schema validation failed:', planResult.error.issues)
      return NextResponse.json(
        {
          data: null,
          error: 'AI returned a plan with an unexpected structure. Please try again.',
        },
        { status: 502 },
      )
    }

    return NextResponse.json({ data: planResult.data, error: null })
  } catch (error) {
    console.error('[POST /api/programme/generate]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to generate plan. Please try again.' },
      { status: 500 },
    )
  }
}
