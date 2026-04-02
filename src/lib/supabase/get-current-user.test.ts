/**
 * @jest-environment node
 */
import { createClient } from '@/lib/supabase/server'
import {
  AuthorizationCheckError,
  ForbiddenError,
  UnauthenticatedError,
} from '@/lib/errors'
import { logError, logWarn } from '@/lib/logger'
import { getProfile } from '@/services/data/profilesRepository'
import { getCurrentUser, requireSuperuser } from './get-current-user'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}))

jest.mock('@/services/data/profilesRepository', () => ({
  getProfile: jest.fn(),
}))

const mockGetUser = jest.fn()
const mockGetProfile = getProfile as jest.Mock
const mockLogError = logError as jest.Mock
const mockLogWarn = logWarn as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  ;(createClient as jest.Mock).mockResolvedValue({
    auth: { getUser: mockGetUser },
  })
})

describe('getCurrentUser', () => {
  it('returns id and email when user is authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-abc-123', email: 'test@example.com' } },
      error: null,
    })

    const result = await getCurrentUser()

    expect(result).toEqual({ id: 'user-abc-123', email: 'test@example.com' })
  })

  it('returns undefined email when user has no email', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-abc-123', email: undefined } },
      error: null,
    })

    const result = await getCurrentUser()

    expect(result).toEqual({ id: 'user-abc-123', email: undefined })
  })

  it('throws when auth returns an error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired' },
    })

    const result = getCurrentUser()

    await expect(result).rejects.toBeInstanceOf(UnauthenticatedError)
    await expect(result).rejects.toThrow('Unauthenticated')
    expect(mockLogWarn).toHaveBeenCalledWith({
      event: 'auth_check_failed',
      outcome: 'failure',
      data: {
        source: 'getCurrentUser',
      },
      error: 'JWT expired',
    })
  })

  it('throws when auth returns null user with no error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const result = getCurrentUser()

    await expect(result).rejects.toBeInstanceOf(UnauthenticatedError)
    await expect(result).rejects.toThrow('Unauthenticated')
    expect(mockLogWarn).toHaveBeenCalledWith({
      event: 'auth_check_failed',
      outcome: 'failure',
      data: {
        source: 'getCurrentUser',
      },
      error: 'No authenticated user session',
    })
  })
})

describe('requireSuperuser', () => {
  it('returns user when authenticated role is superuser', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'super-123', email: 'admin@example.com' } },
      error: null,
    })
    mockGetProfile.mockResolvedValue({
      data: {
        id: 'super-123',
        email: 'admin@example.com',
        role: 'superuser',
        created_at: '2026-03-31T10:00:00.000Z',
        invite_status: 'active',
      },
      error: null,
    })

    const result = await requireSuperuser()

    expect(result).toEqual({ id: 'super-123', email: 'admin@example.com' })
    expect(mockGetProfile).toHaveBeenCalledWith('super-123')
  })

  it('throws when user profile is not superuser', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'user@example.com' } },
      error: null,
    })
    mockGetProfile.mockResolvedValue({
      data: {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user',
        created_at: '2026-03-31T10:00:00.000Z',
        invite_status: 'active',
      },
      error: null,
    })

    const result = requireSuperuser()

    await expect(result).rejects.toBeInstanceOf(ForbiddenError)
    await expect(result).rejects.toThrow('Forbidden')
    expect(mockLogWarn).toHaveBeenCalledWith({
      event: 'access_control_denied',
      outcome: 'failure',
      userId: 'user-123',
      profileRole: 'user',
      data: {
        source: 'requireSuperuser',
        required_role: 'superuser',
      },
    })
  })

  it('throws when profile lookup fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'user@example.com' } },
      error: null,
    })
    mockGetProfile.mockResolvedValue({
      data: null,
      error: 'Failed to retrieve profile',
    })

    const result = requireSuperuser()

    await expect(result).rejects.toBeInstanceOf(AuthorizationCheckError)
    await expect(result).rejects.toThrow('Authorization check failed')
    expect(mockLogError).toHaveBeenCalledWith({
      event: 'access_control_check_failed',
      outcome: 'failure',
      userId: 'user-123',
      data: {
        source: 'requireSuperuser',
        required_role: 'superuser',
      },
      error: 'Failed to retrieve profile',
    })
  })

  it('throws when auth context is unauthenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT missing' },
    })

    const result = requireSuperuser()

    await expect(result).rejects.toBeInstanceOf(UnauthenticatedError)
    await expect(result).rejects.toThrow('Unauthenticated')
  })
})
