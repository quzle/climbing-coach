import { createClient } from '@/lib/supabase/server'
import type { ChatThread, ChatThreadInsert, ChatThreadUpdate } from '@/types'
import {
  createChatThread,
  deleteChatThread,
  getChatThreadById,
  getChatThreadsByUser,
  updateChatThread,
} from './chatThreadsRepository'

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
    single: jest.fn().mockResolvedValue(mockResult),
  }
  const mockFrom = jest.fn().mockReturnValue(mockChain)
  return { mockFrom, mockChain }
}

function makeChatThread(overrides?: Partial<ChatThread>): ChatThread {
  return {
    id: 'thread-1',
    title: 'Spring training',
    created_at: '2026-04-01T09:00:00Z',
    updated_at: '2026-04-01T09:00:00Z',
    user_id: 'user-1',
    ...overrides,
  }
}

describe('chatThreadsRepository', () => {
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mock.mockFrom })
  })

  it('getChatThreadsByUser returns chat threads ordered by updated_at', async () => {
    const threads = [makeChatThread()]
    mockChain.order.mockResolvedValue({ data: threads, error: null })

    const result = await getChatThreadsByUser('user-1')

    expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mockChain.order).toHaveBeenCalledWith('updated_at', { ascending: false })
    expect(result.data).toEqual(threads)
  })

  it('getChatThreadById returns a single chat thread', async () => {
    const thread = makeChatThread()
    mockChain.single.mockResolvedValue({ data: thread, error: null })

    const result = await getChatThreadById('thread-1', 'user-1')

    expect(mockChain.eq).toHaveBeenCalledWith('id', 'thread-1')
    expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result.data).toEqual(thread)
  })

  it('createChatThread inserts and returns the created row', async () => {
    const input: ChatThreadInsert = {
      title: 'Spring training',
      user_id: 'user-1',
    }
    const thread = makeChatThread()
    mockChain.single.mockResolvedValue({ data: thread, error: null })

    const result = await createChatThread(input)

    expect(mockChain.insert).toHaveBeenCalledWith(input)
    expect(result.data).toEqual(thread)
  })

  it('updateChatThread updates and returns the row', async () => {
    const updates: ChatThreadUpdate = { title: 'Updated title' }
    const thread = makeChatThread({ title: 'Updated title' })
    mockChain.single.mockResolvedValue({ data: thread, error: null })

    const result = await updateChatThread('thread-1', updates, 'user-1')

    expect(mockChain.update).toHaveBeenCalledWith(updates)
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'thread-1')
    expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result.data?.title).toBe('Updated title')
  })

  it('deleteChatThread deletes and returns the row', async () => {
    const thread = makeChatThread()
    mockChain.single.mockResolvedValue({ data: thread, error: null })

    const result = await deleteChatThread('thread-1', 'user-1')

    expect(mockChain.delete).toHaveBeenCalledTimes(1)
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'thread-1')
    expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result.data?.id).toBe('thread-1')
  })
})
