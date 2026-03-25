/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { generatePlannedSessionsForActiveMesocycle } from '@/services/training/sessionGenerator'
import { POST } from './route'

jest.mock('@/services/training/sessionGenerator', () => ({
  generatePlannedSessionsForActiveMesocycle: jest.fn(),
}))

const mockGeneratePlannedSessionsForActiveMesocycle =
  generatePlannedSessionsForActiveMesocycle as jest.Mock

const generatedSession = {
  id: 'planned-1',
  created_at: '2026-03-25T10:00:00Z',
  generated_plan: { ai_plan_text: 'Generated plan' },
  generation_notes: 'Auto-generated for power phase',
  mesocycle_id: 'mesocycle-1',
  planned_date: '2026-03-30',
  session_type: 'bouldering',
  status: 'planned',
  template_id: 'template-1',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGeneratePlannedSessionsForActiveMesocycle.mockResolvedValue({
    data: [generatedSession],
    error: null,
  })
})

describe('POST /api/planned-sessions/generate', () => {
  it('returns 200 and generated planned sessions for a valid request', async () => {
    const request = new NextRequest('http://localhost:3000/api/planned-sessions/generate', {
      method: 'POST',
      body: JSON.stringify({ week_start: '2026-03-30' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.error).toBeNull()
    expect(body.data.plannedSessions).toHaveLength(1)
    expect(mockGeneratePlannedSessionsForActiveMesocycle).toHaveBeenCalledWith(
      '2026-03-30',
    )
  })

  it('uses current week when week_start is omitted', async () => {
    const request = new NextRequest('http://localhost:3000/api/planned-sessions/generate', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockGeneratePlannedSessionsForActiveMesocycle).toHaveBeenCalledWith(undefined)
  })

  it('returns 400 when week_start is malformed', async () => {
    const request = new NextRequest('http://localhost:3000/api/planned-sessions/generate', {
      method: 'POST',
      body: JSON.stringify({ week_start: '30-03-2026' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('returns 500 when generation fails', async () => {
    mockGeneratePlannedSessionsForActiveMesocycle.mockResolvedValue({
      data: null,
      error: 'Generation failed',
    })

    const request = new NextRequest('http://localhost:3000/api/planned-sessions/generate', {
      method: 'POST',
      body: JSON.stringify({ week_start: '2026-03-30' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)

    expect(response.status).toBe(500)
  })
})
