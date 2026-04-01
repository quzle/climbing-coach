import { NextRequest, NextResponse } from 'next/server'
import { SINGLE_USER_PLACEHOLDER_ID } from '@/lib/placeholder-user-id'
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
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '20')
    const safeLimit = Math.min(Math.max(limit, 1), 50)

    const result = await getRecentChatMessages(safeLimit, SINGLE_USER_PLACEHOLDER_ID)

    if (result.error !== null) {
      console.error('[GET /api/chat/history]', result.error)
      return NextResponse.json(
        { data: null, error: 'Failed to load chat history. Please try again.' },
        { status: 500 },
      )
    }

    const messages = result.data ?? []

    return NextResponse.json({
      data: { messages },
      error: null,
    })
  } catch (error) {
    console.error('[GET /api/chat/history]', error)
    return NextResponse.json(
      { data: null, error: 'Failed to load chat history. Please try again.' },
      { status: 500 },
    )
  }
}
