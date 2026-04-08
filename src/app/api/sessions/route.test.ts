/**
 * @jest-environment node
 */
import { UnauthenticatedError } from '@/lib/errors'
import { NextRequest } from 'next/server'
import {
  createSession,
  getRecentSessions,
  getSessionsByType,
  updateSessionDeviation,
} from '@/services/data/sessionRepository'
import { updatePlannedSession } from '@/services/data/plannedSessionRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { POST, GET } from './route'

// =============================================================================
// MODULE MOCKS
// =============================================================================

jest.mock('@/services/data/sessionRepository', () => ({
  createSession: jest.fn(),
  getRecentSessions: jest.fn(),
  getSessionsByType: jest.fn(),
  updateSessionDeviation: jest.fn(),
}))

jest.mock('@/services/data/plannedSessionRepository', () => ({
  updatePlannedSession: jest.fn(),
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

const mockCreateSession = createSession as jest.Mock
const mockGetRecentSessions = getRecentSessions as jest.Mock
const mockGetSessionsByType = getSessionsByType as jest.Mock
const mockUpdatePlannedSession = updatePlannedSession as jest.Mock
const mockGetCurrentUser = getCurrentUser as jest.Mock

// Suppress unused warning — mocked to prevent real calls, not asserted against
void (updateSessionDeviation as jest.Mock)

// =============================================================================
// FIXTURES
// =============================================================================

const validBody = {
  date: '2025-03-24',
  session_type: 'bouldering',
  location: 'Boulder World Geneva',
  duration_mins: 90,
  quality_rating: 4,
  rpe: 7,
  notes: null,
  planned_session_id: null,
  log_data: null,
}

const mockSession = {
  ...validBody,
  id: 'test-id',
  deviation_from_plan: null,
  created_at: '2025-03-24T18:00:00Z',
}

// =============================================================================
// SETUP
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
  mockCreateSession.mockResolvedValue({ data: mockSession, error: null })
  mockGetRecentSessions.mockResolvedValue({ data: [], error: null })
  mockGetSessionsByType.mockResolvedValue({ data: [], error: null })
  mockUpdatePlannedSession.mockResolvedValue({ data: null, error: null })
})

// =============================================================================
// HELPERS
// =============================================================================

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// =============================================================================
// TESTS
// =============================================================================

describe('POST /api/sessions', () => {
  it('returns 201 with created session on valid request', async () => {
    const response = await POST(makePostRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.data.session).not.toBeNull()
    expect(body.error).toBeNull()
  })

  it('marks linked planned session as completed using user scope', async () => {
    const plannedSessionId = '559f2dc4-e2a2-463a-8aef-acdb94fe74ec'
    const response = await POST(
      makePostRequest({ ...validBody, planned_session_id: plannedSessionId }),
    )

    expect(response.status).toBe(201)
    expect(mockUpdatePlannedSession).toHaveBeenCalledWith(
      plannedSessionId,
      { status: 'completed' },
      'user-1',
    )
  })

  it('returns 400 when date format is invalid', async () => {
    const response = await POST(makePostRequest({ ...validBody, date: '24-03-2025' }))

    expect(response.status).toBe(400)
  })

  it('returns 400 when session_type is invalid', async () => {
    const response = await POST(makePostRequest({ ...validBody, session_type: 'swimming' }))

    expect(response.status).toBe(400)
  })

  it('returns 400 when duration_mins exceeds 480', async () => {
    const response = await POST(makePostRequest({ ...validBody, duration_mins: 500 }))

    expect(response.status).toBe(400)
  })

  it('returns 400 when rpe is out of range', async () => {
    const response = await POST(makePostRequest({ ...validBody, rpe: 11 }))

    expect(response.status).toBe(400)
  })

  it('defaults injury_flags to an empty array when omitted', async () => {
    const bodyWithoutInjuryFlags = {
      date: validBody.date,
      session_type: validBody.session_type,
      location: validBody.location,
      duration_mins: validBody.duration_mins,
      quality_rating: validBody.quality_rating,
      rpe: validBody.rpe,
      notes: validBody.notes,
      planned_session_id: validBody.planned_session_id,
      log_data: validBody.log_data,
    }

    const response = await POST(makePostRequest(bodyWithoutInjuryFlags))

    expect(response.status).toBe(201)
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ injury_flags: [] }),
    )
  })

  it('returns 500 when repository fails', async () => {
    mockCreateSession.mockResolvedValue({ data: null, error: 'DB error' })

    const response = await POST(makePostRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({
      data: null,
      error: 'Failed to save session. Please try again.',
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new UnauthenticatedError())

    const response = await POST(makePostRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockCreateSession).not.toHaveBeenCalled()
  })
})

describe('GET /api/sessions', () => {
  it('returns 200 with sessions array', async () => {
    mockGetRecentSessions.mockResolvedValue({
      data: [{ ...mockSession, id: 'id-1' }, { ...mockSession, id: 'id-2' }],
      error: null,
    })

    const response = await GET(new NextRequest('http://localhost:3000/api/sessions'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.sessions).toHaveLength(2)
  })

  it('filters by type when type param provided', async () => {
    await GET(new NextRequest('http://localhost:3000/api/sessions?type=bouldering'))

    expect(mockGetSessionsByType).toHaveBeenCalledWith(
      'bouldering',
      expect.any(Number),
      'user-1',
    )
    expect(mockGetRecentSessions).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid session type param', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/sessions?type=swimming'))

    expect(response.status).toBe(400)
  })

  it('defaults to 30 days when no days param', async () => {
    await GET(new NextRequest('http://localhost:3000/api/sessions'))

    expect(mockGetRecentSessions).toHaveBeenCalledWith(30, 'user-1')
  })

  it('clamps days param to maximum of 365', async () => {
    await GET(new NextRequest('http://localhost:3000/api/sessions?days=400'))

    expect(mockGetRecentSessions).toHaveBeenCalledWith(365, 'user-1')
  })

  it('returns 500 when repository fails', async () => {
    mockGetRecentSessions.mockResolvedValue({ data: null, error: 'DB error' })

    const response = await GET(new NextRequest('http://localhost:3000/api/sessions'))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({
      data: null,
      error: 'Failed to load sessions. Please try again.',
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new UnauthenticatedError())

    const response = await GET(new NextRequest('http://localhost:3000/api/sessions'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockGetRecentSessions).not.toHaveBeenCalled()
  })
})
