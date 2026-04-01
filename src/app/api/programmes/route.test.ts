/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { createProgramme, getProgrammes } from '@/services/data/programmeRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { GET, POST } from './route'

jest.mock('@/services/data/programmeRepository', () => ({
  getProgrammes: jest.fn(),
  createProgramme: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}))

const mockGetProgrammes = getProgrammes as jest.Mock
const mockCreateProgramme = createProgramme as jest.Mock
const mockGetCurrentUser = getCurrentUser as jest.Mock

const programme = {
  id: '9f9d2ebd-cd7c-4d2d-b1f8-a8fae1f019d1',
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
  mockGetProgrammes.mockResolvedValue({ data: [programme], error: null })
  mockCreateProgramme.mockResolvedValue({ data: programme, error: null })
})

describe('GET /api/programmes', () => {
  it('returns programmes list', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mockGetProgrammes).toHaveBeenCalledWith('user-1')
    expect(body.data.programmes).toHaveLength(1)
    expect(body.error).toBeNull()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('Unauthenticated'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockGetProgrammes).not.toHaveBeenCalled()
  })

  it('returns 500 when service returns an error', async () => {
    mockGetProgrammes.mockResolvedValue({ data: null, error: 'Database error' })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to load programmes.' })
  })
})

describe('POST /api/programmes', () => {
  it('creates a programme with valid payload', async () => {
    const request = new NextRequest('http://localhost:3000/api/programmes', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Summer Season',
        goal: '7b onsight',
        start_date: '2026-01-05',
        target_date: '2026-04-26',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(201)
    expect(mockCreateProgramme).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1' }),
    )
  })

  it('returns 400 for invalid payload', async () => {
    const request = new NextRequest('http://localhost:3000/api/programmes', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('Unauthenticated'))

    const request = new NextRequest('http://localhost:3000/api/programmes', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Summer Season',
        goal: '7b onsight',
        start_date: '2026-01-05',
        target_date: '2026-04-26',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockCreateProgramme).not.toHaveBeenCalled()
  })

  it('returns 500 when service returns an error', async () => {
    mockCreateProgramme.mockResolvedValue({ data: null, error: 'Database error' })

    const request = new NextRequest('http://localhost:3000/api/programmes', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Summer Season',
        goal: '7b onsight',
        start_date: '2026-01-05',
        target_date: '2026-04-26',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to create programme.' })
  })
})
