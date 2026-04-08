/**
 * @jest-environment node
 */
import { UnauthenticatedError } from '@/lib/errors'
import { NextRequest } from 'next/server'
import {
  createPlannedSession,
  getPlannedSessionsInRange,
  getUpcomingPlannedSessions,
} from '@/services/data/plannedSessionRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { GET, POST } from './route'

jest.mock('@/services/data/plannedSessionRepository', () => ({
  getPlannedSessionsInRange: jest.fn(),
  getUpcomingPlannedSessions: jest.fn(),
  createPlannedSession: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}))

const mockGetPlannedSessionsInRange = getPlannedSessionsInRange as jest.Mock
const mockGetUpcomingPlannedSessions = getUpcomingPlannedSessions as jest.Mock
const mockCreatePlannedSession = createPlannedSession as jest.Mock
const mockGetCurrentUser = getCurrentUser as jest.Mock

const plannedSession = {
  id: '559f2dc4-e2a2-463a-8aef-acdb94fe74ec',
  created_at: '2026-03-25T10:00:00Z',
  generated_plan: null,
  generation_notes: null,
  mesocycle_id: null,
  planned_date: '2026-03-30',
  session_type: 'bouldering',
  status: 'planned',
  template_id: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
  mockGetPlannedSessionsInRange.mockResolvedValue({ data: [plannedSession], error: null })
  mockGetUpcomingPlannedSessions.mockResolvedValue({ data: [plannedSession], error: null })
  mockCreatePlannedSession.mockResolvedValue({ data: plannedSession, error: null })
})

describe('GET /api/planned-sessions', () => {
  it('returns by date range when start/end provided', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/planned-sessions?start_date=2026-03-30&end_date=2026-04-05',
      ),
    )

    expect(response.status).toBe(200)
    expect(mockGetPlannedSessionsInRange).toHaveBeenCalledWith(
      '2026-03-30',
      '2026-04-05',
      'user-1',
    )
  })

  it('returns 400 for malformed range query', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/planned-sessions?start_date=2026-03-30'),
    )
    expect(response.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new UnauthenticatedError())

    const response = await GET(
      new NextRequest(
        'http://localhost/api/planned-sessions?start_date=2026-03-30&end_date=2026-04-05',
      ),
    )
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockGetPlannedSessionsInRange).not.toHaveBeenCalled()
  })

  it('returns 500 when repository returns an error', async () => {
    mockGetPlannedSessionsInRange.mockResolvedValue({ data: null, error: 'Database error' })

    const response = await GET(
      new NextRequest(
        'http://localhost/api/planned-sessions?start_date=2026-03-30&end_date=2026-04-05',
      ),
    )
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to load planned sessions.' })
  })
})

describe('POST /api/planned-sessions', () => {
  it('creates planned session with valid body', async () => {
    const request = new NextRequest('http://localhost/api/planned-sessions', {
      method: 'POST',
      body: JSON.stringify({
        planned_date: '2026-03-30',
        session_type: 'bouldering',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(201)
    expect(mockCreatePlannedSession).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1' }),
    )
  })

  it('returns 400 for invalid payload', async () => {
    const request = new NextRequest('http://localhost/api/planned-sessions', {
      method: 'POST',
      body: JSON.stringify({ planned_date: 'invalid-date' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new UnauthenticatedError())

    const request = new NextRequest('http://localhost/api/planned-sessions', {
      method: 'POST',
      body: JSON.stringify({
        planned_date: '2026-03-30',
        session_type: 'bouldering',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockCreatePlannedSession).not.toHaveBeenCalled()
  })

  it('returns 500 when repository returns an error', async () => {
    mockCreatePlannedSession.mockResolvedValue({ data: null, error: 'Database error' })

    const request = new NextRequest('http://localhost/api/planned-sessions', {
      method: 'POST',
      body: JSON.stringify({
        planned_date: '2026-03-30',
        session_type: 'bouldering',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to create planned session.' })
  })
})
