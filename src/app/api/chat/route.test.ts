/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { sendChatMessage } from '@/services/ai/geminiClient'
import { POST } from './route'

// =============================================================================
// MODULE MOCKS
// =============================================================================

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: 'user-1', errorResponse: null }),
}))

jest.mock('@/services/ai/geminiClient', () => ({
  sendChatMessage: jest.fn(),
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
    expect(body.error).toBeNull()
  })

  it('returns 400 when message is empty', async () => {
    const request = makeRequest({ message: '', history: [] })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).not.toBeNull()
    expect(sendChatMessage).not.toHaveBeenCalled()
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

  it('returns 500 when AI service throws', async () => {
    ;(sendChatMessage as jest.Mock).mockRejectedValue(new Error('Gemini unavailable'))
    const request = makeRequest({ message: 'Hello', history: [] })
    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).not.toBeNull()
    expect(body.data).toBeNull()
  })

  it('uses empty array as default when history is omitted', async () => {
    const request = makeRequest({ message: 'Hello' })
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(sendChatMessage).toHaveBeenCalledWith('user-1', 'Hello', [])
  })
})
