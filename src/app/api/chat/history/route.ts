import { NextRequest, NextResponse } from 'next/server'
import { handleRouteAuthError } from '@/lib/errors'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getRecentChatMessages } from '@/services/data/chatMessagesRepository'
import type { ApiResponse, ChatMessage } from '@/types'

/**
 * @description Returns recent chat history for the current user, ordered
 * chronologically (oldest first) so the chat UI can render messages in the
 * correct order on mount. Accepts an optional `limit` query parameter
 * (1–50, default 20).
 * @returns JSON response containing the array of chat messages, or an error
 * message if the database query fails.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ messages: ChatMessage[] }>>> {
  try {
    const user = await getCurrentUser()
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '20')
    const safeLimit = Math.min(Math.max(limit, 1), 50)

    const result = await getRecentChatMessages(safeLimit, user.id)

    if (result.error !== null) {
      logWarn({
        event: 'chat_history_fetch_failed',
        outcome: 'failure',
        route: '/api/chat/history',
        userId: user.id,
        error: result.error,
      })
      return NextResponse.json(
        { data: null, error: 'Failed to load chat history. Please try again.' },
        { status: 500 },
      )
    }

    const messages = result.data ?? []

    logInfo({
      event: 'chat_history_fetched',
      outcome: 'success',
      route: '/api/chat/history',
      userId: user.id,
      data: { count: messages.length },
    })

    return NextResponse.json({
      data: { messages },
      error: null,
    })
  } catch (error) {
    const authError = handleRouteAuthError(error)
    if (authError !== null) {
      return authError.response
    }

    logError({
      event: 'chat_history_fetch_failed',
      outcome: 'failure',
      route: '/api/chat/history',
      error,
    })
    return NextResponse.json(
      { data: null, error: 'Failed to load chat history. Please try again.' },
      { status: 500 },
    )
  }
}
