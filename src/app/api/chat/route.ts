import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { sendChatMessage } from '@/services/ai/geminiClient'
import {
  createChatThread,
  getChatThreadById,
  getChatThreadsByUser,
} from '@/services/data/chatThreadsRepository'
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
  thread_id: z.string().uuid().optional(),
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
): Promise<NextResponse<ApiResponse<{ response: string; warnings: string[]; thread_id: string }>>> {
  const startedAt = Date.now()

  try {
    const user = await getCurrentUser()
    const body: unknown = await request.json()
    const parsed = chatRequestSchema.safeParse(body)

    if (!parsed.success) {
      const messages = parsed.error.issues.map((e) => e.message).join(', ')

      logWarn({
        event: 'chat_request_handled',
        outcome: 'failure',
        route: '/api/chat',
        userId: user.id,
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
    let threadId = validated.thread_id

    if (threadId !== undefined) {
      const thread = await getChatThreadById(threadId, user.id)
      if (thread.error !== null || thread.data === null) {
        logWarn({
          event: 'chat_request_handled',
          outcome: 'failure',
          route: '/api/chat',
          userId: user.id,
          entityType: 'chat_thread',
          entityId: threadId,
          durationMs: Date.now() - startedAt,
          data: { reason: 'thread_not_found_or_inaccessible' },
        })

        return NextResponse.json({ data: null, error: 'Chat thread not found.' }, { status: 404 })
      }
    } else {
      const threadsResult = await getChatThreadsByUser(user.id)
      if (threadsResult.error !== null) {
        logWarn({
          event: 'chat_request_handled',
          outcome: 'failure',
          route: '/api/chat',
          userId: user.id,
          entityType: 'chat_thread',
          durationMs: Date.now() - startedAt,
          data: { reason: threadsResult.error },
        })

        return NextResponse.json(
          { data: null, error: 'Failed to resolve chat thread.' },
          { status: 500 },
        )
      }

      const existingThread = threadsResult.data?.[0] ?? null
      if (existingThread !== null) {
        threadId = existingThread.id
      } else {
        const createdThread = await createChatThread({ user_id: user.id, title: null })
        if (createdThread.error !== null || createdThread.data === null) {
          logWarn({
            event: 'chat_request_handled',
            outcome: 'failure',
            route: '/api/chat',
            userId: user.id,
            entityType: 'chat_thread',
            durationMs: Date.now() - startedAt,
            data: { reason: createdThread.error ?? 'thread_create_failed' },
          })

          return NextResponse.json(
            { data: null, error: 'Failed to create chat thread.' },
            { status: 500 },
          )
        }

        threadId = createdThread.data.id
      }
    }

    const result = await sendChatMessage(validated.message, validated.history as ChatMessage[], {
      userId: user.id,
      threadId,
    })

    logInfo({
      event: 'chat_request_handled',
      outcome: 'success',
      route: '/api/chat',
      userId: user.id,
      entityType: 'chat_request',
      durationMs: Date.now() - startedAt,
      data: {
        thread_id: threadId,
        history_count: validated.history.length,
        message_length: validated.message.length,
        warnings_count: result.warnings.length,
      },
    })

    return NextResponse.json({
      data: {
        response: result.response,
        warnings: result.warnings,
        thread_id: threadId,
      },
      error: null,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      logWarn({
        event: 'chat_request_handled',
        outcome: 'failure',
        route: '/api/chat',
        entityType: 'chat_request',
        durationMs: Date.now() - startedAt,
        data: {
          reason: 'unauthenticated',
        },
      })

      return NextResponse.json({ data: null, error: 'Unauthenticated.' }, { status: 401 })
    }

    logError({
      event: 'chat_request_handled',
      outcome: 'failure',
      route: '/api/chat',
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
