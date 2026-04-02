/**
 * @jest-environment node
 */
import { UnauthenticatedError } from '@/lib/errors'
import { NextRequest } from 'next/server'
import {
  createCheckin,
  deleteTodaysCheckin,
  getTodaysCheckin,
  getRecentCheckins,
  getAverageReadiness,
  hasCheckedInToday,
} from '@/services/data/readinessRepository'
import { buildAthleteContext, computeWarnings, parseInjuryAreaHealth } from '@/services/ai/contextBuilder'
import { getLastSessionDate } from '@/services/data/sessionRepository'
import { getActiveInjuryAreas } from '@/services/data/injuryAreasRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { DELETE, POST, GET } from './route'

// =============================================================================
// MODULE MOCKS
// =============================================================================

jest.mock('@/services/data/readinessRepository', () => ({
  createCheckin: jest.fn(),
  deleteTodaysCheckin: jest.fn(),
  getTodaysCheckin: jest.fn(),
  getRecentCheckins: jest.fn(),
  getAverageReadiness: jest.fn(),
  hasCheckedInToday: jest.fn(),
}))

jest.mock('@/services/ai/contextBuilder', () => ({
  buildAthleteContext: jest.fn().mockResolvedValue({ warnings: [] }),
  computeWarnings: jest.fn().mockReturnValue([]),
  parseInjuryAreaHealth: jest.fn().mockReturnValue([]),
}))

jest.mock('@/services/data/sessionRepository', () => ({
  getLastSessionDate: jest.fn(),
}))

jest.mock('@/services/data/injuryAreasRepository', () => ({
  getActiveInjuryAreas: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}))

// =============================================================================
// TYPED MOCK REFERENCES
// =============================================================================

const mockCreateCheckin = createCheckin as jest.Mock
const mockDeleteTodaysCheckin = deleteTodaysCheckin as jest.Mock
const mockGetTodaysCheckin = getTodaysCheckin as jest.Mock
const mockGetRecentCheckins = getRecentCheckins as jest.Mock
const mockGetAverageReadiness = getAverageReadiness as jest.Mock
const mockHasCheckedInToday = hasCheckedInToday as jest.Mock
const mockBuildAthleteContext = buildAthleteContext as jest.Mock
const mockComputeWarnings = computeWarnings as jest.Mock
const mockParseInjuryAreaHealth = parseInjuryAreaHealth as jest.Mock
const mockGetLastSessionDate = getLastSessionDate as jest.Mock
const mockGetActiveInjuryAreas = getActiveInjuryAreas as jest.Mock
const mockGetCurrentUser = getCurrentUser as jest.Mock

// =============================================================================
// FIXTURES
// =============================================================================

const validBody = {
  sleep_quality: 4,
  fatigue: 2,
  finger_health: 5,
  injury_area_health: [],
  illness_flag: false,
  life_stress: 2,
  notes: null,
}

const mockCheckin = {
  ...validBody,
  id: 'test-id',
  date: '2025-03-24',
  readiness_score: 3.8,
  created_at: '2025-03-24T10:00:00Z',
}

// =============================================================================
// SETUP
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks()
  mockHasCheckedInToday.mockResolvedValue({ data: false, error: null })
  mockCreateCheckin.mockResolvedValue({ data: mockCheckin, error: null })
  mockDeleteTodaysCheckin.mockResolvedValue({ data: true, error: null })
  mockGetTodaysCheckin.mockResolvedValue({ data: null, error: null })
  mockGetRecentCheckins.mockResolvedValue({ data: [], error: null })
  mockGetAverageReadiness.mockResolvedValue({ data: 3.5, error: null })
  mockBuildAthleteContext.mockResolvedValue({ warnings: [] })
  mockGetLastSessionDate.mockResolvedValue({ data: null, error: null })
  mockGetActiveInjuryAreas.mockResolvedValue({ data: [], error: null })
  mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
  mockComputeWarnings.mockReturnValue([])
  mockParseInjuryAreaHealth.mockReturnValue([])
})

// =============================================================================
// HELPERS
// =============================================================================

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/readiness', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/readiness', () => {
  it('returns 201 with created check-in on valid request', async () => {
    const response = await POST(makePostRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(mockHasCheckedInToday).toHaveBeenCalledWith('user-1')
    expect(mockCreateCheckin).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1' }),
      expect.any(Array),
    )
    expect(body.data.checkin).not.toBeNull()
    expect(body.error).toBeNull()
  })

  it('returns 409 when already checked in today', async () => {
    mockHasCheckedInToday.mockResolvedValue({ data: true, error: null })

    const response = await POST(makePostRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toContain('Already checked in')
    expect(mockCreateCheckin).not.toHaveBeenCalled()
  })

  it('returns 400 when sleep_quality is out of range', async () => {
    const response = await POST(makePostRequest({ ...validBody, sleep_quality: 6 }))

    expect(response.status).toBe(400)
  })

  it('returns 400 when required field is missing', async () => {
    const bodyWithoutFlag = {
      sleep_quality: validBody.sleep_quality,
      fatigue: validBody.fatigue,
      finger_health: validBody.finger_health,
      injury_area_health: validBody.injury_area_health,
      life_stress: validBody.life_stress,
      notes: validBody.notes,
    }

    const response = await POST(makePostRequest(bodyWithoutFlag))

    expect(response.status).toBe(400)
  })

  it('returns warnings in response', async () => {
    mockBuildAthleteContext.mockResolvedValue({
      warnings: ['🟡 Finger health low (3/5)'],
    })

    const response = await POST(makePostRequest({ ...validBody, finger_health: 3 }))
    const body = await response.json()

    expect(body.data.warnings).toContain('🟡 Finger health low (3/5)')
  })

  it('returns 500 when repository fails', async () => {
    mockCreateCheckin.mockResolvedValue({ data: null, error: 'DB error' })

    const response = await POST(makePostRequest(validBody))

    expect(response.status).toBe(500)
  })

  it('returns schema migration guidance when repository detects readiness schema drift', async () => {
    mockCreateCheckin.mockResolvedValue({
      data: null,
      error: 'Readiness database schema is out of date. Apply latest Supabase migrations.',
    })

    const response = await POST(makePostRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBe(
      'Readiness database schema is out of date. Apply latest Supabase migrations.',
    )
  })

  it('returns 500 when hasCheckedInToday fails', async () => {
    mockHasCheckedInToday.mockResolvedValue({
      data: null,
      error: 'Failed to check status',
    })

    const response = await POST(makePostRequest(validBody))

    expect(response.status).toBe(500)
    expect(mockCreateCheckin).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new UnauthenticatedError())

    const response = await POST(makePostRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockCreateCheckin).not.toHaveBeenCalled()
  })

  it('returns 409 when createCheckin reports duplicate-day conflict', async () => {
    mockCreateCheckin.mockResolvedValue({
      data: null,
      error: 'Already checked in today. Only one check-in per day is allowed.',
    })

    const response = await POST(makePostRequest(validBody))

    expect(response.status).toBe(409)
  })

  it('passes injury_area_health array to createCheckin', async () => {
    const bodyWithInjury = {
      ...validBody,
      injury_area_health: [{ area: 'shoulder_left', health: 3, notes: null }],
    }

    await POST(makePostRequest(bodyWithInjury))

    expect(mockCreateCheckin).toHaveBeenCalledWith(
      expect.not.objectContaining({ injury_area_health: expect.anything() }),
      [{ area: 'shoulder_left', health: 3, notes: null }],
    )
  })
})

describe('GET /api/readiness', () => {
  it('returns 200 with check-in data', async () => {
    mockGetRecentCheckins.mockResolvedValue({
      data: [{ ...mockCheckin, id: 'id-1' }, { ...mockCheckin, id: 'id-2' }],
      error: null,
    })
    mockGetTodaysCheckin.mockResolvedValue({ data: mockCheckin, error: null })

    const response = await GET(new NextRequest('http://localhost:3000/api/readiness'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockGetTodaysCheckin).toHaveBeenCalledWith('user-1')
    expect(mockGetAverageReadiness).toHaveBeenCalledWith(7, 'user-1')
    expect(body.data.checkins).toHaveLength(2)
    expect(body.data.hasCheckedInToday).toBe(true)
  })

  it('includes warnings array in response', async () => {
    mockGetTodaysCheckin.mockResolvedValue({ data: mockCheckin, error: null })
    mockComputeWarnings.mockReturnValue(['🟡 Finger health low (3/5)'])

    const response = await GET(new NextRequest('http://localhost:3000/api/readiness'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.warnings).toEqual(['🟡 Finger health low (3/5)'])
  })

  it('returns empty warnings array when no check-in today', async () => {
    mockGetTodaysCheckin.mockResolvedValue({ data: null, error: null })

    const response = await GET(new NextRequest('http://localhost:3000/api/readiness'))
    const body = await response.json()

    expect(body.data.warnings).toEqual([])
    expect(mockComputeWarnings).not.toHaveBeenCalled()
  })

  it('calls getLastSessionDate and getActiveInjuryAreas', async () => {
    await GET(new NextRequest('http://localhost:3000/api/readiness'))

    expect(mockGetLastSessionDate).toHaveBeenCalledWith('user-1')
    expect(mockGetActiveInjuryAreas).toHaveBeenCalledWith('user-1')
  })

  it('continues with warnings=[] when getLastSessionDate errors', async () => {
    mockGetLastSessionDate.mockResolvedValue({ data: null, error: 'DB error' })
    mockGetTodaysCheckin.mockResolvedValue({ data: mockCheckin, error: null })

    const response = await GET(new NextRequest('http://localhost:3000/api/readiness'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toBeDefined()
  })

  it('defaults to 7 days when no days param provided', async () => {
    await GET(new NextRequest('http://localhost:3000/api/readiness'))

    expect(mockGetRecentCheckins).toHaveBeenCalledWith(7, 'user-1')
  })

  it('clamps days param to maximum of 90', async () => {
    await GET(new NextRequest('http://localhost:3000/api/readiness?days=200'))

    expect(mockGetRecentCheckins).toHaveBeenCalledWith(90, 'user-1')
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new UnauthenticatedError())

    const response = await GET(new NextRequest('http://localhost:3000/api/readiness'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
  })
})

describe('DELETE /api/readiness', () => {
  it('returns 200 when today\'s check-in is deleted', async () => {
    const response = await DELETE()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ data: { deleted: true }, error: null })
    expect(mockDeleteTodaysCheckin).toHaveBeenCalledWith('user-1')
  })

  it('returns 404 when no check-in exists for today', async () => {
    mockDeleteTodaysCheckin.mockResolvedValue({ data: null, error: 'No check-in found for today.' })

    const response = await DELETE()
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ data: null, error: 'No check-in found for today.' })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new UnauthenticatedError())

    const response = await DELETE()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockDeleteTodaysCheckin).not.toHaveBeenCalled()
  })
})
