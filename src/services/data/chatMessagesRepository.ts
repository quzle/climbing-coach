import { createClient } from '@/lib/supabase/server'
import type {
  ApiResponse,
  ChatMessage,
  ChatMessageInsert,
  ChatMessageUpdate,
} from '@/types'

/**
 * @description Fetches the most recent chat messages for a user and returns them oldest-to-newest.
 * @param limit Max number of rows to return (1-50 recommended)
 * @param userId The user UUID to verify ownership
 * @returns Chat message rows ordered chronologically
 */
export async function getRecentChatMessages(
  limit: number,
  userId: string,
): Promise<ApiResponse<ChatMessage[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[chatMessagesRepository.getRecentChatMessages]', { limit, userId }, error)
      return { data: null, error: 'Failed to fetch chat messages' }
    }

    return { data: (data ?? []).reverse(), error: null }
  } catch (err) {
    console.error(
      '[chatMessagesRepository.getRecentChatMessages] unexpected error',
      { limit, userId },
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches chat messages for a specific thread, verifying user ownership.
 * @param threadId Chat thread UUID
 * @param userId The user UUID to verify ownership
 * @returns Chat messages ordered chronologically
 */
export async function getChatMessagesByThread(
  threadId: string,
  userId: string,
): Promise<ApiResponse<ChatMessage[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[chatMessagesRepository.getChatMessagesByThread]', { threadId, userId }, error)
      return { data: null, error: 'Failed to fetch chat messages' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error(
      '[chatMessagesRepository.getChatMessagesByThread] unexpected error',
      { threadId, userId },
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Creates a new chat message row.
 * @param input Chat message insert payload (must include user_id)
 * @returns Newly created chat message row
 */
export async function createChatMessage(
  input: ChatMessageInsert,
): Promise<ApiResponse<ChatMessage>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('chat_messages').insert(input).select().single()

    if (error) {
      console.error('[chatMessagesRepository.createChatMessage]', { userId: input.user_id }, error)
      return { data: null, error: 'Failed to create chat message' }
    }

    return { data, error: null }
  } catch (err) {
    console.error(
      '[chatMessagesRepository.createChatMessage] unexpected error',
      { userId: input.user_id },
      err,
    )
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Updates an existing chat message row, verifying user ownership.
 * @param id Chat message UUID
 * @param updates Partial chat message fields to update
 * @param userId The user UUID to verify ownership
 * @returns Updated chat message row
 */
export async function updateChatMessage(
  id: string,
  updates: ChatMessageUpdate,
  userId: string,
): Promise<ApiResponse<ChatMessage>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('chat_messages')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[chatMessagesRepository.updateChatMessage]', { id, userId }, error)
      return { data: null, error: 'Failed to update chat message' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[chatMessagesRepository.updateChatMessage] unexpected error', { id, userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Deletes a chat message row by UUID, verifying user ownership.
 * @param id Chat message UUID
 * @param userId The user UUID to verify ownership
 * @returns Deleted chat message row
 */
export async function deleteChatMessage(
  id: string,
  userId: string,
): Promise<ApiResponse<ChatMessage>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[chatMessagesRepository.deleteChatMessage]', { id, userId }, error)
      return { data: null, error: 'Failed to delete chat message' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[chatMessagesRepository.deleteChatMessage] unexpected error', { id, userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}
