/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { logError, logInfo, logWarn } from '@/lib/logger'
import { requireSuperuser } from '@/lib/supabase/get-current-user'
import {
  seedSummerMultipitchProgramme,
  type SeedProgrammeResult,
} from '@/services/training/programmeSeed'
import { POST } from './route'

jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  requireSuperuser: jest.fn(),
}))

jest.mock('@/services/training/programmeSeed', () => ({
  seedSummerMultipitchProgramme: jest.fn(),
}))

const mockLogError = logError as jest.Mock
const mockLogInfo = logInfo as jest.Mock
const mockLogWarn = logWarn as jest.Mock
const mockRequireSuperuser = requireSuperuser as jest.Mock
const mockSeedSummerMultipitchProgramme = seedSummerMultipitchProgramme as jest.Mock

const mockSeedSummary: SeedProgrammeResult = {
  seeded: true,
  programmeId: 'programme-1',
  programmeName: 'Summer Multipitch Season',
  createdMesocycleCount: 4,
  createdWeeklyTemplateCount: 28,
  createdPlannedSessionCount: 14,
}

describe('POST /api/dev/seed-programme', () => {
  const originalNodeEnv = process.env.NODE_ENV

  function setNodeEnv(value: string | undefined): void {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value,
      configurable: true,
      writable: true,
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    setNodeEnv('test')
    mockRequireSuperuser.mockResolvedValue({ id: 'super-123', email: 'admin@example.com' })
    mockSeedSummerMultipitchProgramme.mockResolvedValue({
      data: mockSeedSummary,
      error: null,
    })
  })

  afterAll(() => {
    setNodeEnv(originalNodeEnv)
  })

  it('returns 200 with the seed summary on success', async () => {
    const request = new NextRequest('http://localhost:3000/api/dev/seed-programme', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual(mockSeedSummary)
    expect(body.error).toBeNull()
    expect(mockSeedSummerMultipitchProgramme).toHaveBeenCalledWith('super-123')
    expect(mockLogInfo).toHaveBeenCalled()
  })

  it('returns 404 in production', async () => {
    setNodeEnv('production')
    const request = new NextRequest('http://localhost:3000/api/dev/seed-programme', {
      method: 'POST',
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.data).toBeNull()
    expect(body.error).toBe('Not found.')
    expect(mockSeedSummerMultipitchProgramme).not.toHaveBeenCalled()
  })

  it('returns 500 when the seed service fails', async () => {
    mockSeedSummerMultipitchProgramme.mockResolvedValue({
      data: null,
      error: 'db error',
    })

    const request = new NextRequest('http://localhost:3000/api/dev/seed-programme', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.data).toBeNull()
    expect(body.error).toContain('Failed to seed programme data')
    expect(mockLogError).toHaveBeenCalled()
  })

  it('returns 409 when reseed is attempted without a reset', async () => {
    mockSeedSummerMultipitchProgramme.mockResolvedValue({
      data: {
        ...mockSeedSummary,
        seeded: false,
        createdMesocycleCount: 0,
        createdWeeklyTemplateCount: 0,
        createdPlannedSessionCount: 0,
      },
      error: null,
    })

    const request = new NextRequest('http://localhost:3000/api/dev/seed-programme', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: '11111111-1111-4111-8111-111111111111' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toEqual({
      data: null,
      error: 'Reset is required before reseeding this user.',
    })
    expect(mockLogWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/dev/seed-programme',
        data: expect.objectContaining({
          reason: 'reset_required_before_reseed',
          targetUserId: '11111111-1111-4111-8111-111111111111',
        }),
      }),
    )
  })

  it('returns 403 when requester is not a superuser', async () => {
    mockRequireSuperuser.mockRejectedValue(new Error('Forbidden'))

    const request = new NextRequest('http://localhost:3000/api/dev/seed-programme', {
      method: 'POST',
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ data: null, error: 'Forbidden.' })
    expect(mockSeedSummerMultipitchProgramme).not.toHaveBeenCalled()
  })

  it('returns 401 when requester is unauthenticated', async () => {
    mockRequireSuperuser.mockRejectedValue(new Error('Unauthenticated'))

    const request = new NextRequest('http://localhost:3000/api/dev/seed-programme', {
      method: 'POST',
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Authentication required.' })
    expect(mockSeedSummerMultipitchProgramme).not.toHaveBeenCalled()
  })

  it('uses target user ID from request payload', async () => {
    const request = new NextRequest('http://localhost:3000/api/dev/seed-programme', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: '11111111-1111-4111-8111-111111111111' }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(mockSeedSummerMultipitchProgramme).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    )
  })
})