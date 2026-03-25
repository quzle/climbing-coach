/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import {
  deletePlannedSession,
  getPlannedSessionById,
  updatePlannedSession,
} from '@/services/data/plannedSessionRepository'
import { DELETE, GET, PUT } from './route'

jest.mock('@/services/data/plannedSessionRepository', () => ({
  getPlannedSessionById: jest.fn(),
  updatePlannedSession: jest.fn(),
  deletePlannedSession: jest.fn(),
}))

const mockGetPlannedSessionById = getPlannedSessionById as jest.Mock
const mockUpdatePlannedSession = updatePlannedSession as jest.Mock
const mockDeletePlannedSession = deletePlannedSession as jest.Mock

const id = '559f2dc4-e2a2-463a-8aef-acdb94fe74ec'
const plannedSession = {
  id,
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
  mockGetPlannedSessionById.mockResolvedValue({ data: plannedSession, error: null })
  mockUpdatePlannedSession.mockResolvedValue({ data: plannedSession, error: null })
  mockDeletePlannedSession.mockResolvedValue({ data: plannedSession, error: null })
})

describe('GET /api/planned-sessions/:id', () => {
  it('returns one planned session', async () => {
    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id }),
    })

    expect(response.status).toBe(200)
    expect(mockGetPlannedSessionById).toHaveBeenCalledWith(id)
  })
})

describe('PUT /api/planned-sessions/:id', () => {
  it('updates one planned session', async () => {
    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ status: 'completed' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PUT(request, { params: Promise.resolve({ id }) })
    expect(response.status).toBe(200)
    expect(mockUpdatePlannedSession).toHaveBeenCalledWith(id, { status: 'completed' })
  })
})

describe('DELETE /api/planned-sessions/:id', () => {
  it('deletes one planned session', async () => {
    const response = await DELETE(new NextRequest('http://localhost', { method: 'DELETE' }), {
      params: Promise.resolve({ id }),
    })

    expect(response.status).toBe(200)
    expect(mockDeletePlannedSession).toHaveBeenCalledWith(id)
  })
})
