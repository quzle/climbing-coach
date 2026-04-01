/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}))

const mockCreateClient = createClient as jest.Mock
const mockGetCurrentUser = getCurrentUser as jest.Mock

const validBody = {
  wizard_input: {
    goal: 'Onsight 7b by October',
    start_date: '2026-04-01',
    duration_weeks: 8,
    focus: 'power',
    strengths: 'Good finger strength',
    weaknesses: 'Route reading',
  },
  plan: {
    programme: {
      name: 'Spring Power Block',
      goal: 'Onsight 7b by October',
      notes: null,
    },
    mesocycles: [
      {
        name: 'Power 1',
        focus: 'Explosive bouldering power',
        phase_type: 'power',
        duration_weeks: 4,
        objectives: 'Increase max boulder intensity',
      },
    ],
  },
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/programme/confirm', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeSupabaseMock(options?: {
  deactivateError?: { message: string } | null
  programmeError?: { message: string } | null
  programmeData?: { id: string } | null
  mesocycleError?: { message: string } | null
  mesocycleData?: { id: string } | null
}) {
  const deactivateError = options?.deactivateError ?? null
  const programmeError = options?.programmeError ?? null
  const programmeData = options?.programmeData ?? { id: 'programme-1' }
  const mesocycleError = options?.mesocycleError ?? null
  const mesocycleData = options?.mesocycleData ?? { id: 'mesocycle-1' }

  const mockDeactivateEqStatus = jest.fn().mockResolvedValue({ error: deactivateError })
  const mockDeactivateEqUser = jest.fn().mockReturnValue({ eq: mockDeactivateEqStatus })
  const mockProgrammeUpdate = jest.fn().mockReturnValue({ eq: mockDeactivateEqUser })

  const mockProgrammeSingle = jest
    .fn()
    .mockResolvedValue({ data: programmeData, error: programmeError })
  const mockProgrammeSelect = jest.fn().mockReturnValue({ single: mockProgrammeSingle })
  const mockProgrammeInsert = jest.fn().mockReturnValue({ select: mockProgrammeSelect })

  const mockMesocycleSingle = jest
    .fn()
    .mockResolvedValue({ data: mesocycleData, error: mesocycleError })
  const mockMesocycleSelect = jest.fn().mockReturnValue({ single: mockMesocycleSingle })
  const mockMesocycleInsert = jest.fn().mockReturnValue({ select: mockMesocycleSelect })

  const mockFrom = jest.fn((table: string) => {
    if (table === 'programmes') {
      return {
        update: mockProgrammeUpdate,
        insert: mockProgrammeInsert,
      }
    }

    if (table === 'mesocycles') {
      return {
        insert: mockMesocycleInsert,
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    from: mockFrom,
    mockDeactivateEqUser,
    mockProgrammeInsert,
    mockMesocycleInsert,
  }
}

describe('POST /api/programme/confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
  })

  it('returns 201 and persists programme/mesocycle for authenticated user', async () => {
    const supabase = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(supabase)

    const response = await POST(makeRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toEqual({
      data: { programme_id: 'programme-1', first_mesocycle_id: 'mesocycle-1' },
      error: null,
    })

    expect(supabase.mockDeactivateEqUser).toHaveBeenCalledWith('user_id', 'user-1')

    expect(supabase.mockProgrammeInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1' }),
    )

    expect(supabase.mockMesocycleInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', programme_id: 'programme-1' }),
    )
  })

  it('returns 400 for invalid request body', async () => {
    const response = await POST(makeRequest({}))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ data: null, error: 'Invalid request body.' })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('Unauthenticated'))

    const response = await POST(makeRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns 500 when deactivate existing programme fails', async () => {
    const supabase = makeSupabaseMock({ deactivateError: { message: 'deactivate failed' } })
    mockCreateClient.mockResolvedValue(supabase)

    const response = await POST(makeRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to deactivate existing programme.' })
  })

  it('returns 500 when programme insert fails', async () => {
    const supabase = makeSupabaseMock({ programmeData: null, programmeError: { message: 'insert failed' } })
    mockCreateClient.mockResolvedValue(supabase)

    const response = await POST(makeRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to create programme.' })
  })

  it('returns 500 when mesocycle insert fails', async () => {
    const supabase = makeSupabaseMock({ mesocycleData: null, mesocycleError: { message: 'insert failed' } })
    mockCreateClient.mockResolvedValue(supabase)

    const response = await POST(makeRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toContain('Failed to create mesocycle')
  })
})
