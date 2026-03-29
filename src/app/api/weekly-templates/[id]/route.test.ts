/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import {
  getWeeklyTemplateById,
  updateWeeklyTemplate,
} from '@/services/data/weeklyTemplateRepository'
import { GET, PUT } from './route'

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: 'user-1', errorResponse: null }),
}))

jest.mock('@/services/data/weeklyTemplateRepository', () => ({
  getWeeklyTemplateById: jest.fn(),
  updateWeeklyTemplate: jest.fn(),
}))

const mockGetWeeklyTemplateById = getWeeklyTemplateById as jest.Mock
const mockUpdateWeeklyTemplate = updateWeeklyTemplate as jest.Mock

const id = 'c42df97b-26a8-44f2-b923-2546f0f81116'
const template = {
  id,
  day_of_week: 1,
  duration_mins: 90,
  intensity: 'high',
  mesocycle_id: '11711946-7ec0-4640-9f03-2be6ac3cd571',
  notes: null,
  primary_focus: 'Power',
  session_label: 'Limit Bouldering',
  session_type: 'bouldering',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetWeeklyTemplateById.mockResolvedValue({ data: template, error: null })
  mockUpdateWeeklyTemplate.mockResolvedValue({ data: template, error: null })
})

describe('GET /api/weekly-templates/:id', () => {
  it('returns one weekly template', async () => {
    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id }),
    })
    expect(response.status).toBe(200)
  })
})

describe('PUT /api/weekly-templates/:id', () => {
  it('updates one weekly template', async () => {
    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ session_label: 'Updated label' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PUT(request, { params: Promise.resolve({ id }) })
    expect(response.status).toBe(200)
    expect(mockUpdateWeeklyTemplate).toHaveBeenCalledWith('user-1', id, {
      session_label: 'Updated label',
    })
  })
})
