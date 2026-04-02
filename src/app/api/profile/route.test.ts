/**
 * @jest-environment node
 */
import { UnauthenticatedError } from '@/lib/errors'
import { NextRequest } from 'next/server'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getProfile, updateProfile } from '@/services/data/profilesRepository'
import { GET, PATCH } from './route'

jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/services/data/profilesRepository', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
}))

const mockGetCurrentUser = getCurrentUser as jest.Mock
const mockGetProfile = getProfile as jest.Mock
const mockUpdateProfile = updateProfile as jest.Mock
const mockLogInfo = logInfo as jest.Mock
const mockLogWarn = logWarn as jest.Mock
const mockLogError = logError as jest.Mock

const profile = {
  id: 'user-123',
  email: 'climber@example.com',
  display_name: 'Test Climber',
  role: 'user',
  invite_status: 'active',
  created_at: '2026-04-01T10:00:00Z',
  updated_at: '2026-04-01T10:00:00Z',
}

describe('GET /api/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'user-123', email: 'climber@example.com' })
    mockGetProfile.mockResolvedValue({ data: profile, error: null })
  })

  it('returns the authenticated user profile', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ data: profile, error: null })
    expect(mockGetProfile).toHaveBeenCalledWith('user-123')
    expect(mockLogInfo).toHaveBeenCalledWith({
      event: 'profile_fetched',
      outcome: 'success',
      route: '/api/profile',
      userId: 'user-123',
      profileRole: 'user',
      entityType: 'profile',
      entityId: 'user-123',
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new UnauthenticatedError())

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Authentication required.' })
    expect(mockLogWarn).toHaveBeenCalledWith({
      event: 'profile_fetched',
      outcome: 'failure',
      route: '/api/profile',
      entityType: 'profile',
      data: {
        reason: 'unauthenticated',
      },
    })
  })

  it('returns 500 when repository fails', async () => {
    mockGetProfile.mockResolvedValue({ data: null, error: 'db failure' })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to load profile.' })
  })

  it('returns 500 on unexpected exception', async () => {
    mockGetProfile.mockRejectedValue(new Error('boom'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to load profile.' })
    expect(mockLogError).toHaveBeenCalled()
  })
})

describe('PATCH /api/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'user-123', email: 'climber@example.com' })
    mockUpdateProfile.mockResolvedValue({
      data: { ...profile, display_name: 'Updated Name' },
      error: null,
    })
  })

  it('updates the authenticated user profile', async () => {
    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'Updated Name' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      data: { ...profile, display_name: 'Updated Name' },
      error: null,
    })
    expect(mockUpdateProfile).toHaveBeenCalledWith('user-123', {
      display_name: 'Updated Name',
    })
  })

  it('returns 400 for invalid payload', async () => {
    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ display_name: '' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.data).toBeNull()
    expect(body.error).toContain('Invalid request:')
    expect(mockUpdateProfile).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new UnauthenticatedError())
    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'Updated Name' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Authentication required.' })
  })

  it('returns 500 when repository update fails', async () => {
    mockUpdateProfile.mockResolvedValue({ data: null, error: 'db failure' })
    const request = new NextRequest('http://localhost:3000/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ display_name: 'Updated Name' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to update profile.' })
  })
})