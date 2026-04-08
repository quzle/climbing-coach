/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { getMesocycleById, updateMesocycle } from '@/services/data/mesocycleRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { GET, PUT } from './route'

jest.mock('@/services/data/mesocycleRepository', () => ({
  getMesocycleById: jest.fn(),
  updateMesocycle: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}))

const mockGetMesocycleById = getMesocycleById as jest.Mock
const mockUpdateMesocycle = updateMesocycle as jest.Mock
const mockGetCurrentUser = getCurrentUser as jest.Mock

const id = '11711946-7ec0-4640-9f03-2be6ac3cd571'
const mesocycle = {
  id,
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
  mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
  mockGetMesocycleById.mockResolvedValue({ data: mesocycle, error: null })
  mockUpdateMesocycle.mockResolvedValue({ data: mesocycle, error: null })
})

describe('GET /api/mesocycles/:id', () => {
  it('returns one mesocycle', async () => {
    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id }),
    })
    expect(response.status).toBe(200)
    expect(mockGetMesocycleById).toHaveBeenCalledWith(id, 'user-1')
  })
})

describe('PUT /api/mesocycles/:id', () => {
  it('updates one mesocycle', async () => {
    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ focus: 'Updated focus' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PUT(request, { params: Promise.resolve({ id }) })
    expect(response.status).toBe(200)
    expect(mockUpdateMesocycle).toHaveBeenCalledWith(id, { focus: 'Updated focus' }, 'user-1')
  })
})
