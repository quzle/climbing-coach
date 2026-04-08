import { createClient } from '@/lib/supabase/server'
import type {
  ApiResponse,
  ChatThread,
  ChatThreadInsert,
  ChatThreadUpdate,
} from '@/types'

/**
 * @description Fetches all chat threads for a user ordered by most recently updated.
 * @param userId The user UUID to verify ownership
 * @returns Chat thread rows ordered by updated_at descending
 */
export async function getChatThreadsByUser(userId: string): Promise<ApiResponse<ChatThread[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[chatThreadsRepository.getChatThreadsByUser]', { userId }, error)
      return { data: null, error: 'Failed to fetch chat threads' }
    }

    return { data: data ?? [], error: null }
  } catch (err) {
    console.error('[chatThreadsRepository.getChatThreadsByUser] unexpected error', { userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Fetches a single chat thread by UUID, verifying user ownership.
 * @param id Chat thread UUID
 * @param userId The user UUID to verify ownership
 * @returns Matching chat thread row
 */
export async function getChatThreadById(
  id: string,
  userId: string,
): Promise<ApiResponse<ChatThread>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('chat_threads')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[chatThreadsRepository.getChatThreadById]', { id, userId }, error)
      return { data: null, error: 'Failed to fetch chat thread' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[chatThreadsRepository.getChatThreadById] unexpected error', { id, userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Creates a new chat thread row.
 * @param input Chat thread insert payload (must include user_id)
 * @returns Newly created chat thread row
 */
export async function createChatThread(input: ChatThreadInsert): Promise<ApiResponse<ChatThread>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('chat_threads').insert(input).select().single()

    if (error) {
      console.error('[chatThreadsRepository.createChatThread]', { userId: input.user_id }, error)
      return { data: null, error: 'Failed to create chat thread' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[chatThreadsRepository.createChatThread] unexpected error', { userId: input.user_id }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Updates an existing chat thread row, verifying user ownership.
 * @param id Chat thread UUID
 * @param updates Partial chat thread fields to update
 * @param userId The user UUID to verify ownership
 * @returns Updated chat thread row
 */
export async function updateChatThread(
  id: string,
  updates: ChatThreadUpdate,
  userId: string,
): Promise<ApiResponse<ChatThread>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('chat_threads')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[chatThreadsRepository.updateChatThread]', { id, userId }, error)
      return { data: null, error: 'Failed to update chat thread' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[chatThreadsRepository.updateChatThread] unexpected error', { id, userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}

/**
 * @description Deletes a chat thread row by UUID, verifying user ownership.
 * @param id Chat thread UUID
 * @param userId The user UUID to verify ownership
 * @returns Deleted chat thread row
 */
export async function deleteChatThread(
  id: string,
  userId: string,
): Promise<ApiResponse<ChatThread>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('chat_threads')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[chatThreadsRepository.deleteChatThread]', { id, userId }, error)
      return { data: null, error: 'Failed to delete chat thread' }
    }

    return { data, error: null }
  } catch (err) {
    console.error('[chatThreadsRepository.deleteChatThread] unexpected error', { id, userId }, err)
    return { data: null, error: 'An unexpected error occurred' }
  }
}
