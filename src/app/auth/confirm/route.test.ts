/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { GET } from './route'

// =============================================================================
// MOCKS
// =============================================================================

const mockVerifyOtp = jest.fn()
const mockFinalizeInvitedUserProfile = jest.fn()
const mockSet = jest.fn()
const mockGetAll = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: { verifyOtp: mockVerifyOtp },
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
  const url = new URL('http://localhost/auth/confirm')
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return new NextRequest(url.toString())
}

// =============================================================================
// TESTS
// =============================================================================

describe('GET /auth/confirm', () => {
  const mockLogError = logError as jest.Mock
  const mockLogInfo = logInfo as jest.Mock
  const mockLogWarn = logWarn as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAll.mockReturnValue([])
    mockVerifyOtp.mockResolvedValue({
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

  describe('invite type', () => {
    it('verifies token, finalizes profile, and redirects to home on success', async () => {
      const request = makeRequest({
        token_hash: 'valid-token-hash',
        type: 'invite',
      })

      const response = await GET(request)

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: 'valid-token-hash',
        type: 'invite',
      })
      expect(mockFinalizeInvitedUserProfile).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'climber@example.com',
      })
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/')
      expect(mockLogInfo).toHaveBeenCalledWith({
        event: 'token_confirmation_success',
        outcome: 'success',
        route: '/auth/confirm',
        userId: 'user-123',
        data: {
          confirmation_type: 'invite',
          redirect_path: '/',
        },
      })
    })

    it('respects a safe next parameter for invite type', async () => {
      const request = makeRequest({
        token_hash: 'valid-token-hash',
        type: 'invite',
        next: '/programme',
      })

      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/programme')
      expect(mockLogInfo).toHaveBeenCalledWith({
        event: 'token_confirmation_success',
        outcome: 'success',
        route: '/auth/confirm',
        userId: 'user-123',
        data: {
          confirmation_type: 'invite',
          redirect_path: '/programme',
        },
      })
    })

    it('ignores unsafe (external) next parameter for invite type', async () => {
      const request = makeRequest({
        token_hash: 'valid-token-hash',
        type: 'invite',
        next: 'https://evil.example.com',
      })

      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/')
      expect(mockLogInfo).toHaveBeenCalledWith({
        event: 'token_confirmation_success',
        outcome: 'success',
        route: '/auth/confirm',
        userId: 'user-123',
        data: {
          confirmation_type: 'invite',
          redirect_path: '/',
        },
      })
    })

    it('redirects to login with error when email is missing after otp verification', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: null,
          },
        },
        error: null,
      })
      const request = makeRequest({
        token_hash: 'valid-token-hash',
        type: 'invite',
      })

      const response = await GET(request)

      expect(mockFinalizeInvitedUserProfile).not.toHaveBeenCalled()
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost/auth/login?error=confirm_failed',
      )
      expect(mockLogError).toHaveBeenCalledWith({
        event: 'token_confirmation_failure',
        outcome: 'failure',
        route: '/auth/confirm',
        userId: 'user-123',
        data: {
          reason: 'missing_email_after_otp_verification',
          confirmation_type: 'invite',
        },
      })
    })

    it('redirects to login with error when profile finalization fails', async () => {
      mockFinalizeInvitedUserProfile.mockResolvedValue({
        data: null,
        error: 'Failed to finalize profile lifecycle',
      })
      const request = makeRequest({
        token_hash: 'valid-token-hash',
        type: 'invite',
      })

      const response = await GET(request)

      expect(mockFinalizeInvitedUserProfile).toHaveBeenCalledWith({
        id: 'user-123',
        email: 'climber@example.com',
      })
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost/auth/login?error=confirm_failed',
      )
      expect(mockLogError).toHaveBeenCalledWith({
        event: 'token_confirmation_failure',
        outcome: 'failure',
        route: '/auth/confirm',
        userId: 'user-123',
        data: {
          reason: 'profile_finalization_failed',
          confirmation_type: 'invite',
        },
        error: 'Failed to finalize profile lifecycle',
      })
    })
  })

  describe('recovery type', () => {
    it('verifies token and redirects to change-password page on success', async () => {
      const request = makeRequest({
        token_hash: 'valid-recovery-token',
        type: 'recovery',
      })

      const response = await GET(request)

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        token_hash: 'valid-recovery-token',
        type: 'recovery',
      })
      expect(mockFinalizeInvitedUserProfile).not.toHaveBeenCalled()
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost/auth/change-password')
      expect(mockLogInfo).toHaveBeenCalledWith({
        event: 'token_confirmation_success',
        outcome: 'success',
        route: '/auth/confirm',
        userId: 'user-123',
        data: {
          confirmation_type: 'recovery',
          redirect_path: '/auth/change-password',
        },
      })
    })
  })

  describe('error cases', () => {
    it('redirects to login with error when token_hash is missing', async () => {
      const request = makeRequest({
        type: 'invite',
      })

      const response = await GET(request)

      expect(mockVerifyOtp).not.toHaveBeenCalled()
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost/auth/login?error=confirm_failed',
      )
      expect(mockLogWarn).toHaveBeenCalledWith({
        event: 'token_confirmation_failure',
        outcome: 'failure',
        route: '/auth/confirm',
        data: {
          reason: 'missing_token_hash',
          confirmation_type: 'invite',
        },
      })
    })

    it('redirects to login with error when type is missing', async () => {
      const request = makeRequest({
        token_hash: 'valid-token-hash',
      })

      const response = await GET(request)

      expect(mockVerifyOtp).not.toHaveBeenCalled()
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost/auth/login?error=confirm_failed',
      )
      expect(mockLogWarn).toHaveBeenCalledWith({
        event: 'token_confirmation_failure',
        outcome: 'failure',
        route: '/auth/confirm',
        data: {
          reason: 'missing_confirmation_type',
        },
      })
    })

    it('redirects to login with error when verifyOtp fails', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid token' },
      })
      const request = makeRequest({
        token_hash: 'invalid-token-hash',
        type: 'invite',
      })

      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost/auth/login?error=confirm_failed',
      )
      expect(mockLogWarn).toHaveBeenCalledWith({
        event: 'token_confirmation_failure',
        outcome: 'failure',
        route: '/auth/confirm',
        data: {
          reason: 'verify_otp_failed',
          confirmation_type: 'invite',
        },
        error: 'invalid token',
      })
    })

    it('redirects to login with error when user is missing after otp verification', async () => {
      mockVerifyOtp.mockResolvedValue({
        data: { user: null },
        error: null,
      })
      const request = makeRequest({
        token_hash: 'valid-token-hash',
        type: 'invite',
      })

      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost/auth/login?error=confirm_failed',
      )
      expect(mockLogError).toHaveBeenCalledWith({
        event: 'token_confirmation_failure',
        outcome: 'failure',
        route: '/auth/confirm',
        data: {
          reason: 'missing_user_after_otp_verification',
          confirmation_type: 'invite',
        },
      })
    })

    it('redirects to login with error on unsupported confirmation type', async () => {
      const request = makeRequest({
        token_hash: 'valid-token-hash',
        type: 'email_change',
      })

      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        'http://localhost/auth/login?error=confirm_failed',
      )
      expect(mockLogWarn).toHaveBeenCalledWith({
        event: 'token_confirmation_failure',
        outcome: 'failure',
        route: '/auth/confirm',
        userId: 'user-123',
        data: {
          reason: 'unsupported_confirmation_type',
          confirmation_type: 'email_change',
        },
      })
    })
  })
})
