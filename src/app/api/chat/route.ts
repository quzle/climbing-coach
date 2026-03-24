import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendChatMessage } from '@/services/ai/geminiClient'
import type { ApiResponse, ChatMessage } from '@/types'

const chatRequestSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message too long — maximum 2000 characters'),
  history: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(['user', 'assistant']),
        content: z.string(),
        context_snapshot: z.unknown().nullable(),
        created_at: z.string(),
      }),
    )
    .default([]),
})

/**
 * @description Handles a user chat message to the AI coach. Validates the
 * incoming message and chat history, calls the AI service, and returns
 * the coach's response along with any active training warnings.
 * @returns JSON response containing the coach's reply and active warnings,
 * or an error message if the request is invalid or the AI service fails.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ response: string; warnings: string[] }>>> {
  try {
    const body: unknown = await request.json()
    const parsed = chatRequestSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => e.message).join(', ')
      return NextResponse.json({ data: null, error: `Invalid request: ${messages}` }, { status: 400 })
    }

    const validated = parsed.data
    const result = await sendChatMessage(validated.message, validated.history as ChatMessage[])

    return NextResponse.json({
      data: {
        response: result.response,
        warnings: result.warnings,
      },
      error: null,
    })
  } catch (error) {
    console.error('[POST /api/chat]', error)
    return NextResponse.json(
      { data: null, error: 'The coach is temporarily unavailable. Please try again.' },
      { status: 500 },
    )
  }
}
