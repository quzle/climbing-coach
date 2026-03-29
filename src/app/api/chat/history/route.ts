import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'
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
    const { userId, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const limit = Number(request.nextUrl.searchParams.get('limit') ?? '20')
    const safeLimit = Math.min(Math.max(limit, 1), 50)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(safeLimit)

    if (error) {
      console.error('[GET /api/chat/history]', error)
      return NextResponse.json(
        { data: null, error: 'Failed to load chat history. Please try again.' },
        { status: 500 },
      )
    }

    const messages = (data as ChatMessage[]).reverse()

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
