/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getActiveProgramme } from '@/services/data/programmeRepository'
import { getMesocyclesByProgramme } from '@/services/data/mesocycleRepository'
import { POST } from './route'

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      startChat: jest.fn().mockReturnValue({
        sendMessage: jest.fn().mockResolvedValue({
          response: {
            text: jest.fn().mockReturnValue(
              JSON.stringify({
                programme: {
                  name: 'Generated Plan',
                  goal: 'Onsight 7b by October',
                  notes: null,
                },
                mesocycles: [
                  {
                    name: 'Power Block',
                    focus: 'Power focus',
                    phase_type: 'power',
                    duration_weeks: 4,
                    objectives: 'Increase power output',
                  },
                ],
              }),
            ),
          },
        }),
      }),
    }),
  })),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/services/data/programmeRepository', () => ({
  getActiveProgramme: jest.fn(),
}))

jest.mock('@/services/data/mesocycleRepository', () => ({
  getMesocyclesByProgramme: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}))

const mockGetCurrentUser = getCurrentUser as jest.Mock
const mockGetActiveProgramme = getActiveProgramme as jest.Mock
const mockGetMesocyclesByProgramme = getMesocyclesByProgramme as jest.Mock

const validBody = {
  goal: 'Onsight 7b by October',
  start_date: '2026-04-01',
  duration_weeks: 8,
  focus: 'power',
  strengths: 'Good finger strength',
  weaknesses: 'Route reading',
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/programme/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/programme/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-api-key'
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
    mockGetActiveProgramme.mockResolvedValue({ data: null, error: null })
    mockGetMesocyclesByProgramme.mockResolvedValue({ data: [], error: null })
  })

  afterAll(() => {
    delete process.env.GEMINI_API_KEY
  })

  it('returns 200 with generated plan on valid request', async () => {
    const response = await POST(makeRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.programme.name).toBe('Generated Plan')
    expect(body.error).toBeNull()
    expect(mockGetActiveProgramme).toHaveBeenCalledWith('user-1')
  })

  it('returns 400 for invalid request', async () => {
    const response = await POST(makeRequest({ goal: '' }))

    expect(response.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('Unauthenticated'))

    const response = await POST(makeRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockGetActiveProgramme).not.toHaveBeenCalled()
  })

  it('returns 503 when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY

    const response = await POST(makeRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({ data: null, error: 'AI service is not configured.' })
  })

  it('returns 502 when AI returns invalid JSON', async () => {
    ;(GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        startChat: jest.fn().mockReturnValue({
          sendMessage: jest.fn().mockResolvedValue({
            response: {
              text: jest.fn().mockReturnValue('not-json'),
            },
          }),
        }),
      }),
    }))

    const response = await POST(makeRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({ data: null, error: 'AI returned an invalid response. Please try again.' })
  })

  it('returns 502 when AI JSON does not match schema', async () => {
    ;(GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        startChat: jest.fn().mockReturnValue({
          sendMessage: jest.fn().mockResolvedValue({
            response: {
              text: jest.fn().mockReturnValue(
                JSON.stringify({
                  programme: { name: 'Invalid' },
                  mesocycles: [],
                }),
              ),
            },
          }),
        }),
      }),
    }))

    const response = await POST(makeRequest(validBody))
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toContain('unexpected structure')
  })
})
