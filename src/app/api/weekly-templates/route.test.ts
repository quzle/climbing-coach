/**
 * @jest-environment node
 */
import { UnauthenticatedError } from '@/lib/errors'
import { NextRequest } from 'next/server'
import {
  createWeeklyTemplate,
  getWeeklyTemplateByMesocycle,
} from '@/services/data/weeklyTemplateRepository'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { GET, POST } from './route'

jest.mock('@/services/data/weeklyTemplateRepository', () => ({
  getWeeklyTemplateByMesocycle: jest.fn(),
  createWeeklyTemplate: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
}))

const mockGetWeeklyTemplateByMesocycle = getWeeklyTemplateByMesocycle as jest.Mock
const mockCreateWeeklyTemplate = createWeeklyTemplate as jest.Mock
const mockGetCurrentUser = getCurrentUser as jest.Mock

const template = {
  id: 'c42df97b-26a8-44f2-b923-2546f0f81116',
  day_of_week: 1,
  duration_mins: 90,
  intensity: 'high',
  mesocycle_id: '11711946-7ec0-4640-9f03-2be6ac3cd571',
  notes: null,
  primary_focus: 'Power',
  session_label: 'Limit Bouldering',
  session_type: 'bouldering',
  user_id: 'user-1',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
  mockGetWeeklyTemplateByMesocycle.mockResolvedValue({ data: [template], error: null })
  mockCreateWeeklyTemplate.mockResolvedValue({ data: template, error: null })
})

describe('GET /api/weekly-templates', () => {
  it('returns templates for mesocycle_id', async () => {
    const response = await GET(
      new NextRequest(
        `http://localhost/api/weekly-templates?mesocycle_id=${template.mesocycle_id}`,
      ),
    )

    expect(response.status).toBe(200)
    expect(mockGetWeeklyTemplateByMesocycle).toHaveBeenCalledWith(
      template.mesocycle_id,
      'user-1',
    )
  })

  it('returns 400 when mesocycle_id is missing', async () => {
    const response = await GET(new NextRequest('http://localhost/api/weekly-templates'))

    expect(response.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new UnauthenticatedError())

    const response = await GET(
      new NextRequest(
        `http://localhost/api/weekly-templates?mesocycle_id=${template.mesocycle_id}`,
      ),
    )
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockGetWeeklyTemplateByMesocycle).not.toHaveBeenCalled()
  })

  it('returns 500 when repository returns an error', async () => {
    mockGetWeeklyTemplateByMesocycle.mockResolvedValue({ data: null, error: 'DB error' })

    const response = await GET(
      new NextRequest(
        `http://localhost/api/weekly-templates?mesocycle_id=${template.mesocycle_id}`,
      ),
    )
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to load weekly templates.' })
  })
})

describe('POST /api/weekly-templates', () => {
  it('creates a weekly template', async () => {
    const request = new NextRequest('http://localhost/api/weekly-templates', {
      method: 'POST',
      body: JSON.stringify({
        mesocycle_id: template.mesocycle_id,
        day_of_week: 1,
        session_label: 'Limit Bouldering',
        session_type: 'bouldering',
        intensity: 'high',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(201)
    expect(mockCreateWeeklyTemplate).toHaveBeenCalled()
  })

  it('returns 400 for invalid payload', async () => {
    const request = new NextRequest('http://localhost/api/weekly-templates', {
      method: 'POST',
      body: JSON.stringify({ day_of_week: 1 }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new UnauthenticatedError())

    const request = new NextRequest('http://localhost/api/weekly-templates', {
      method: 'POST',
      body: JSON.stringify({
        mesocycle_id: template.mesocycle_id,
        day_of_week: 1,
        session_label: 'Limit Bouldering',
        session_type: 'bouldering',
        intensity: 'high',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Unauthenticated.' })
    expect(mockCreateWeeklyTemplate).not.toHaveBeenCalled()
  })

  it('returns 500 when repository returns an error', async () => {
    mockCreateWeeklyTemplate.mockResolvedValue({ data: null, error: 'DB error' })

    const request = new NextRequest('http://localhost/api/weekly-templates', {
      method: 'POST',
      body: JSON.stringify({
        mesocycle_id: template.mesocycle_id,
        day_of_week: 1,
        session_label: 'Limit Bouldering',
        session_type: 'bouldering',
        intensity: 'high',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to create weekly template.' })
  })
})
