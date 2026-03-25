/**
 * @jest-environment node
 */
import {
  seedSummerMultipitchProgramme,
  type SeedProgrammeResult,
} from '@/services/training/programmeSeed'
import { POST } from './route'

jest.mock('@/services/training/programmeSeed', () => ({
  seedSummerMultipitchProgramme: jest.fn(),
}))

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
    mockSeedSummerMultipitchProgramme.mockResolvedValue({
      data: mockSeedSummary,
      error: null,
    })
  })

  afterAll(() => {
    setNodeEnv(originalNodeEnv)
  })

  it('returns 200 with the seed summary on success', async () => {
    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual(mockSeedSummary)
    expect(body.error).toBeNull()
  })

  it('returns 404 in production', async () => {
    setNodeEnv('production')

    const response = await POST()
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

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.data).toBeNull()
    expect(body.error).toContain('Failed to seed programme data')
  })
})