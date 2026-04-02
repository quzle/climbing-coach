/**
 * @jest-environment node
 */
import { logError, logWarn } from '@/lib/logger'
import { requireSuperuser } from '@/lib/supabase/get-current-user'
import { listProfiles } from '@/services/data/profilesRepository'
import { GET } from './route'

jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  requireSuperuser: jest.fn(),
}))

jest.mock('@/services/data/profilesRepository', () => ({
  listProfiles: jest.fn(),
}))

const mockLogError = logError as jest.Mock
const mockLogWarn = logWarn as jest.Mock
const mockRequireSuperuser = requireSuperuser as jest.Mock
const mockListProfiles = listProfiles as jest.Mock

describe('GET /api/dev/seed-targets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireSuperuser.mockResolvedValue({ id: 'super-123', email: 'admin@example.com' })
    mockListProfiles.mockResolvedValue({
      data: [
        {
          id: 'user-1',
          email: 'user.one@example.com',
          display_name: 'User One',
          role: 'user',
          invite_status: 'active',
        },
      ],
      error: null,
    })
  })

  it('returns 200 with mapped target users', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      data: [
        {
          id: 'user-1',
          email: 'user.one@example.com',
          display_name: 'User One',
          role: 'user',
          invite_status: 'active',
        },
      ],
      error: null,
    })
    expect(mockListProfiles).toHaveBeenCalled()
  })

  it('returns 401 when requester is unauthenticated', async () => {
    mockRequireSuperuser.mockRejectedValue(new Error('Unauthenticated'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Authentication required.' })
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/dev/seed-targets',
        data: { reason: 'unauthenticated' },
      }),
    )
  })

  it('returns 403 when requester is not a superuser', async () => {
    mockRequireSuperuser.mockRejectedValue(new Error('Forbidden'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ data: null, error: 'Forbidden.' })
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/dev/seed-targets',
        data: expect.objectContaining({ reason: 'forbidden' }),
      }),
    )
  })

  it('returns 500 when listing profiles fails', async () => {
    mockListProfiles.mockResolvedValue({ data: null, error: 'db error' })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to load seed target users.' })
  })

  it('returns 500 and logs when an unexpected error occurs', async () => {
    mockListProfiles.mockRejectedValue(new Error('boom'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to load seed target users.' })
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/dev/seed-targets',
        error: new Error('boom'),
      }),
    )
  })
})
