/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { getProgrammeById, updateProgramme } from '@/services/data/programmeRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { GET, PUT } from './route'

jest.mock('@/services/data/programmeRepository', () => ({
  getProgrammeById: jest.fn(),
  updateProgramme: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}))

const mockGetProgrammeById = getProgrammeById as jest.Mock
const mockUpdateProgramme = updateProgramme as jest.Mock
const mockGetCurrentUser = getCurrentUser as jest.Mock

const id = '9f9d2ebd-cd7c-4d2d-b1f8-a8fae1f019d1'
const programme = {
  id,
  created_at: '2026-03-25T10:00:00Z',
  goal: '7b onsight',
  name: 'Summer Season',
  notes: null,
  start_date: '2026-01-05',
  target_date: '2026-04-26',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
  mockGetProgrammeById.mockResolvedValue({ data: programme, error: null })
  mockUpdateProgramme.mockResolvedValue({ data: programme, error: null })
})

describe('GET /api/programmes/:id', () => {
  it('returns the programme for a valid id', async () => {
    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id }),
    })
    expect(response.status).toBe(200)
    expect(mockGetProgrammeById).toHaveBeenCalledWith(id, 'user-1')
  })
})

describe('PUT /api/programmes/:id', () => {
  it('updates a programme with valid payload', async () => {
    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ notes: 'updated' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PUT(request, { params: Promise.resolve({ id }) })
    expect(response.status).toBe(200)
    expect(mockUpdateProgramme).toHaveBeenCalledWith(id, { notes: 'updated' }, 'user-1')
  })

  it('returns 400 for invalid id', async () => {
    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ notes: 'updated' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PUT(request, { params: Promise.resolve({ id: 'bad-id' }) })
    expect(response.status).toBe(400)
  })
})
