/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { GET } from './route'

// =============================================================================
// MOCKS
// =============================================================================

const mockExchangeCodeForSession = jest.fn()
const mockFinalizeInvitedUserProfile = jest.fn()
const mockSet = jest.fn()
const mockGetAll = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  })),
}))

jest.mock('@/services/auth/authLifecycleService', () => ({
  finalizeInvitedUserProfile: jest.fn((...args) =>
    mockFinalizeInvitedUserProfile(...args),
  ),
}))

jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
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
  const mockLogError = logError as jest.Mock
  const mockLogInfo = logInfo as jest.Mock
  const mockLogWarn = logWarn as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAll.mockReturnValue([])
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'climber@example.com',
        },
      },
      error: null,
    })
    mockFinalizeInvitedUserProfile.mockResolvedValue({ data: true, error: null })
  })

  it('exchanges code for session, finalizes profile, and redirects to home', async () => {
    const request = makeRequest({ code: 'valid-auth-code' })

    const response = await GET(request)

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('valid-auth-code')
    expect(mockFinalizeInvitedUserProfile).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'climber@example.com',
    })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
    expect(mockLogInfo).toHaveBeenCalledWith({
      event: 'login_success',
      outcome: 'success',
      route: '/auth/callback',
      userId: 'user-123',
      data: {
        auth_flow: 'invite_callback',
        redirect_path: '/',
      },
    })
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
    expect(mockLogWarn).toHaveBeenCalledWith({
      event: 'login_failure',
      outcome: 'failure',
      route: '/auth/callback',
      data: {
        reason: 'missing_auth_code',
      },
    })
  })

  it('redirects to login with error when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT' },
    })
    const request = makeRequest({ code: 'expired-code' })

    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/auth/login?error=callback_failed',
    )
    expect(mockLogWarn).toHaveBeenCalledWith({
      event: 'login_failure',
      outcome: 'failure',
      route: '/auth/callback',
      data: {
        reason: 'exchange_code_for_session_failed',
      },
      error: 'invalid JWT',
    })
  })

  it('redirects to login with error when email is missing after code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: null,
        },
      },
      error: null,
    })
    const request = makeRequest({ code: 'valid-auth-code' })

    const response = await GET(request)

    expect(mockFinalizeInvitedUserProfile).not.toHaveBeenCalled()
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/auth/login?error=callback_failed',
    )
    expect(mockLogError).toHaveBeenCalledWith({
      event: 'login_failure',
      outcome: 'failure',
      route: '/auth/callback',
      userId: 'user-123',
      data: {
        reason: 'missing_email_after_code_exchange',
      },
    })
  })

  it('redirects to login with error when profile finalization fails', async () => {
    mockFinalizeInvitedUserProfile.mockResolvedValue({
      data: null,
      error: 'Failed to finalize profile lifecycle',
    })
    const request = makeRequest({ code: 'valid-auth-code' })

    const response = await GET(request)

    expect(mockFinalizeInvitedUserProfile).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'climber@example.com',
    })
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/auth/login?error=callback_failed',
    )
    expect(mockLogError).toHaveBeenCalledWith({
      event: 'login_failure',
      outcome: 'failure',
      route: '/auth/callback',
      userId: 'user-123',
      data: {
        reason: 'profile_finalization_failed',
      },
      error: 'Failed to finalize profile lifecycle',
    })
  })
})
