import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { SINGLE_USER_PLACEHOLDER_ID } from '@/lib/placeholder-user-id'
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
  const startedAt = Date.now()

  try {
    const body: unknown = await request.json()
    const parsed = chatRequestSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => e.message).join(', ')

      logWarn({
        event: 'chat_request_handled',
        outcome: 'failure',
        route: '/api/chat',
        userId: SINGLE_USER_PLACEHOLDER_ID,
        entityType: 'chat_request',
        durationMs: Date.now() - startedAt,
        data: {
          reason: 'validation_failed',
          issue_count: parsed.error.issues.length,
        },
      })

      return NextResponse.json({ data: null, error: `Invalid request: ${messages}` }, { status: 400 })
    }

    const validated = parsed.data
    const result = await sendChatMessage(validated.message, validated.history as ChatMessage[])

    logInfo({
      event: 'chat_request_handled',
      outcome: 'success',
      route: '/api/chat',
      userId: SINGLE_USER_PLACEHOLDER_ID,
      entityType: 'chat_request',
      durationMs: Date.now() - startedAt,
      data: {
        history_count: validated.history.length,
        message_length: validated.message.length,
        warnings_count: result.warnings.length,
      },
    })

    return NextResponse.json({
      data: {
        response: result.response,
        warnings: result.warnings,
      },
      error: null,
    })
  } catch (error) {
    logError({
      event: 'chat_request_handled',
      outcome: 'failure',
      route: '/api/chat',
      userId: SINGLE_USER_PLACEHOLDER_ID,
      entityType: 'chat_request',
      durationMs: Date.now() - startedAt,
      error,
    })

    return NextResponse.json(
      { data: null, error: 'The coach is temporarily unavailable. Please try again.' },
      { status: 500 },
    )
  }
}
