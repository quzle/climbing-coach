/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { createMesocycle, getMesocyclesByProgramme } from '@/services/data/mesocycleRepository'
import { GET, POST } from './route'

jest.mock('@/services/data/mesocycleRepository', () => ({
  getMesocyclesByProgramme: jest.fn(),
  createMesocycle: jest.fn(),
}))

const mockGetMesocyclesByProgramme = getMesocyclesByProgramme as jest.Mock
const mockCreateMesocycle = createMesocycle as jest.Mock

const mesocycle = {
  id: '11711946-7ec0-4640-9f03-2be6ac3cd571',
  actual_end: null,
  actual_start: null,
  created_at: '2026-03-25T10:00:00Z',
  focus: 'Power',
  interruption_notes: null,
  name: 'Power Block',
  phase_type: 'power',
  planned_end: '2026-03-30',
  planned_start: '2026-03-03',
  programme_id: '9f9d2ebd-cd7c-4d2d-b1f8-a8fae1f019d1',
  status: 'active',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetMesocyclesByProgramme.mockResolvedValue({ data: [mesocycle], error: null })
  mockCreateMesocycle.mockResolvedValue({ data: mesocycle, error: null })
})

describe('GET /api/mesocycles', () => {
  it('returns mesocycles for programme_id', async () => {
    const response = await GET(
      new NextRequest(
        `http://localhost/api/mesocycles?programme_id=${mesocycle.programme_id}`,
      ),
    )

    expect(response.status).toBe(200)
    expect(mockGetMesocyclesByProgramme).toHaveBeenCalledWith(mesocycle.programme_id)
  })

  it('returns 400 when programme_id is missing', async () => {
    const response = await GET(new NextRequest('http://localhost/api/mesocycles'))
    expect(response.status).toBe(400)
  })
})

describe('POST /api/mesocycles', () => {
  it('creates mesocycle with valid body', async () => {
    const request = new NextRequest('http://localhost/api/mesocycles', {
      method: 'POST',
      body: JSON.stringify({
        programme_id: mesocycle.programme_id,
        name: mesocycle.name,
        focus: mesocycle.focus,
        phase_type: mesocycle.phase_type,
        planned_start: mesocycle.planned_start,
        planned_end: mesocycle.planned_end,
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(201)
    expect(mockCreateMesocycle).toHaveBeenCalled()
  })
})
