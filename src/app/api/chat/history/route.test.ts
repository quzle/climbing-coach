/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { getRecentChatMessages } from '@/services/data/chatMessagesRepository'
import { GET } from './route'

jest.mock('@/services/data/chatMessagesRepository', () => ({
  getRecentChatMessages: jest.fn(),
}))

const mockGetRecentChatMessages = getRecentChatMessages as jest.Mock

function makeRequest(limit?: string): NextRequest {
  const query = limit ? `?limit=${limit}` : ''
  return new NextRequest(`http://localhost:3000/api/chat/history${query}`, {
    method: 'GET',
  })
}

describe('GET /api/chat/history', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns messages with default limit', async () => {
    const messages = [
      {
        id: 'message-1',
        role: 'user',
        content: 'Hi',
        context_snapshot: null,
        created_at: '2026-04-01T09:00:00Z',
        thread_id: null,
        user_id: 'user-1',
      },
    ]
    mockGetRecentChatMessages.mockResolvedValue({ data: messages, error: null })

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockGetRecentChatMessages).toHaveBeenCalledWith(20, expect.any(String))
    expect(body.data.messages).toEqual(messages)
    expect(body.error).toBeNull()
  })

  it('clamps limit to 50 when query value is too high', async () => {
    mockGetRecentChatMessages.mockResolvedValue({ data: [], error: null })

    const response = await GET(makeRequest('200'))

    expect(response.status).toBe(200)
    expect(mockGetRecentChatMessages).toHaveBeenCalledWith(50, expect.any(String))
  })

  it('returns 500 when repository returns an error', async () => {
    mockGetRecentChatMessages.mockResolvedValue({ data: null, error: 'db failed' })

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.data).toBeNull()
    expect(body.error).toBe('Failed to load chat history. Please try again.')
  })
})
