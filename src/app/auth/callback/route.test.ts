/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET } from './route'

// =============================================================================
// MOCKS
// =============================================================================

const mockExchangeCodeForSession = jest.fn()
const mockSet = jest.fn()
const mockGetAll = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  })),
}))

jest.mock('next/headers', () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      getAll: mockGetAll,
      set: mockSet,
    }),
  ),
}))

// =============================================================================
// HELPERS
// =============================================================================

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/auth/callback')
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return new NextRequest(url.toString())
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /auth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAll.mockReturnValue([])
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
  })

  it('exchanges code for session and redirects to home', async () => {
    const request = makeRequest({ code: 'valid-auth-code' })

    const response = await GET(request)

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('valid-auth-code')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('respects a safe next parameter', async () => {
    const request = makeRequest({ code: 'valid-auth-code', next: '/profile' })

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/profile')
  })

  it('ignores an unsafe (external) next parameter', async () => {
    const request = makeRequest({
      code: 'valid-auth-code',
      next: 'https://evil.example.com',
    })

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('redirects to login with error when no code is present', async () => {
    const request = makeRequest({})

    const response = await GET(request)

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/auth/login?error=callback_failed',
    )
  })

  it('redirects to login with error when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'invalid JWT' },
    })
    const request = makeRequest({ code: 'expired-code' })

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/auth/login?error=callback_failed',
    )
  })
})
