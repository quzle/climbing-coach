/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { sendChatMessage } from '@/services/ai/geminiClient'
import {
  createChatThread,
  getChatThreadById,
  getChatThreadsByUser,
} from '@/services/data/chatThreadsRepository'
import { POST } from './route'

// =============================================================================
// MODULE MOCKS
// =============================================================================

jest.mock('@/services/ai/geminiClient', () => ({
  sendChatMessage: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/services/data/chatThreadsRepository', () => ({
  createChatThread: jest.fn(),
  getChatThreadById: jest.fn(),
  getChatThreadsByUser: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}))

// =============================================================================
// HELPERS
// =============================================================================

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// =============================================================================
// SETUP
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks()
  ;(getCurrentUser as jest.Mock).mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
  const threadId = '11111111-1111-4111-8111-111111111111'
  ;(getChatThreadsByUser as jest.Mock).mockResolvedValue({
    data: [{ id: threadId, user_id: 'user-1', title: null, created_at: null, updated_at: null }],
    error: null,
  })
  ;(getChatThreadById as jest.Mock).mockResolvedValue({
    data: { id: threadId, user_id: 'user-1', title: null, created_at: null, updated_at: null },
    error: null,
  })
  ;(createChatThread as jest.Mock).mockResolvedValue({
    data: { id: threadId, user_id: 'user-1', title: null, created_at: null, updated_at: null },
    error: null,
  })
  ;(sendChatMessage as jest.Mock).mockResolvedValue({
    response: 'Mock coach response',
    warnings: [],
  })
})

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/chat', () => {
  it('returns 200 with AI response on valid request', async () => {
    const request = makeRequest({ message: 'What should I train today?', history: [] })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.response).toBe('Mock coach response')
    expect(body.data.thread_id).toBe('11111111-1111-4111-8111-111111111111')
    expect(body.error).toBeNull()
    expect(sendChatMessage).toHaveBeenCalledWith('What should I train today?', [], {
      userId: 'user-1',
      threadId: '11111111-1111-4111-8111-111111111111',
    })
    expect(logInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'chat_request_handled',
        outcome: 'success',
        route: '/api/chat',
        entityType: 'chat_request',
        data: {
          thread_id: '11111111-1111-4111-8111-111111111111',
          history_count: 0,
          message_length: 26,
          warnings_count: 0,
        },
      }),
    )
  })

  it('returns 400 when message is empty', async () => {
    const request = makeRequest({ message: '', history: [] })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).not.toBeNull()
    expect(sendChatMessage).not.toHaveBeenCalled()
    expect(logWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'chat_request_handled',
        outcome: 'failure',
        route: '/api/chat',
        entityType: 'chat_request',
        data: {
          reason: 'validation_failed',
          issue_count: 1,
        },
      }),
    )
  })

  it('returns 400 when message exceeds 2000 characters', async () => {
    const request = makeRequest({ message: 'a'.repeat(2001), history: [] })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('returns 400 when message field is missing', async () => {
    const request = makeRequest({ history: [] })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('returns warnings from AI service', async () => {
    ;(sendChatMessage as jest.Mock).mockResolvedValue({
      response: 'Take it easy today',
      warnings: ['🔴 ILLNESS FLAG ACTIVE'],
    })
    const request = makeRequest({ message: 'Can I train?', history: [] })
    const response = await POST(request)
    const body = await response.json()

    expect(body.data.warnings).toContain('🔴 ILLNESS FLAG ACTIVE')
  })

  it('uses provided thread_id when valid', async () => {
    const request = makeRequest({
      message: 'Continue thread',
      history: [],
      thread_id: '11111111-1111-4111-8111-111111111111',
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(getChatThreadById).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'user-1')
    expect(body.data.thread_id).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('returns 404 when provided thread is not found', async () => {
    ;(getChatThreadById as jest.Mock).mockResolvedValue({ data: null, error: 'not found' })

    const response = await POST(makeRequest({
      message: 'Hello',
      history: [],
      thread_id: '11111111-1111-4111-8111-111111111111',
    }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ data: null, error: 'Chat thread not found.' })
    expect(sendChatMessage).not.toHaveBeenCalled()
  })

  it('creates a thread when none exists', async () => {
    ;(getChatThreadsByUser as jest.Mock).mockResolvedValue({ data: [], error: null })

    const response = await POST(makeRequest({ message: 'Hello', history: [] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(createChatThread).toHaveBeenCalledWith({ user_id: 'user-1', title: null })
    expect(body.data.thread_id).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('returns 500 when thread resolution fails', async () => {
    ;(getChatThreadsByUser as jest.Mock).mockResolvedValue({ data: null, error: 'DB error' })

    const response = await POST(makeRequest({ message: 'Hello', history: [] }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to resolve chat thread.' })
    expect(sendChatMessage).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    ;(getCurrentUser as jest.Mock).mockRejectedValue(new Error('Unauthenticated'))

    const response = await POST(makeRequest({ message: 'Hello', history: [] }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(sendChatMessage).not.toHaveBeenCalled()
  })

  it('returns 500 when AI service throws', async () => {
    ;(sendChatMessage as jest.Mock).mockRejectedValue(new Error('Gemini unavailable'))
    const request = makeRequest({ message: 'Hello', history: [] })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).not.toBeNull()
    expect(body.data).toBeNull()
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'chat_request_handled',
        outcome: 'failure',
        route: '/api/chat',
        entityType: 'chat_request',
        error: expect.any(Error),
      }),
    )
  })

  it('uses empty array as default when history is omitted', async () => {
    const request = makeRequest({ message: 'Hello' })
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(sendChatMessage).toHaveBeenCalledWith('Hello', [], {
      userId: 'user-1',
      threadId: '11111111-1111-4111-8111-111111111111',
    })
  })
})
