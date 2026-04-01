import { createClient } from '@/lib/supabase/server'
import type { ChatMessage, ChatMessageInsert, ChatMessageUpdate } from '@/types'
import {
  createChatMessage,
  deleteChatMessage,
  getChatMessagesByThread,
  getRecentChatMessages,
  updateChatMessage,
} from './chatMessagesRepository'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

function makeSupabaseMock() {
  const mockResult = { data: null, error: null }
  const mockChain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(mockResult),
  }
  const mockFrom = jest.fn().mockReturnValue(mockChain)
  return { mockFrom, mockChain }
}

function makeChatMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'message-1',
    role: 'user',
    content: 'Hello coach',
    context_snapshot: null,
    created_at: '2026-04-01T09:15:00Z',
    thread_id: 'thread-1',
    user_id: 'user-1',
    ...overrides,
  }
}

describe('chatMessagesRepository', () => {
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mock.mockFrom })
  })

  it('getRecentChatMessages returns messages oldest-to-newest', async () => {
    const oldest = makeChatMessage({ id: 'message-1', content: 'first' })
    const newest = makeChatMessage({ id: 'message-2', content: 'second' })
    mockChain.limit.mockResolvedValue({ data: [newest, oldest], error: null })

    const result = await getRecentChatMessages(20, 'user-1')

    expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockChain.limit).toHaveBeenCalledWith(20)
    expect(result.data).toEqual([oldest, newest])
  })

  it('getChatMessagesByThread returns thread messages ordered by created_at', async () => {
    const messages = [
      makeChatMessage({ id: 'message-1', content: 'first' }),
      makeChatMessage({ id: 'message-2', content: 'second' }),
    ]
    mockChain.order.mockResolvedValue({ data: messages, error: null })

    const result = await getChatMessagesByThread('thread-1', 'user-1')

    expect(mockChain.eq).toHaveBeenCalledWith('thread_id', 'thread-1')
    expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result.data).toEqual(messages)
  })

  it('createChatMessage inserts and returns the created row', async () => {
    const input: ChatMessageInsert = {
      role: 'user',
      content: 'Hello coach',
      context_snapshot: null,
      thread_id: 'thread-1',
      user_id: 'user-1',
    }
    const message = makeChatMessage()
    mockChain.single.mockResolvedValue({ data: message, error: null })

    const result = await createChatMessage(input)

    expect(mockChain.insert).toHaveBeenCalledWith(input)
    expect(result.data).toEqual(message)
  })

  it('updateChatMessage updates and returns the row', async () => {
    const updates: ChatMessageUpdate = { content: 'Updated message' }
    const message = makeChatMessage({ content: 'Updated message' })
    mockChain.single.mockResolvedValue({ data: message, error: null })

    const result = await updateChatMessage('message-1', updates, 'user-1')

    expect(mockChain.update).toHaveBeenCalledWith(updates)
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'message-1')
    expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result.data?.content).toBe('Updated message')
  })

  it('deleteChatMessage deletes and returns the row', async () => {
    const message = makeChatMessage()
    mockChain.single.mockResolvedValue({ data: message, error: null })

    const result = await deleteChatMessage('message-1', 'user-1')

    expect(mockChain.delete).toHaveBeenCalledTimes(1)
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'message-1')
    expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result.data?.id).toBe('message-1')
  })
})
