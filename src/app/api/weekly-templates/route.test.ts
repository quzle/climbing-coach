/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import {
  createWeeklyTemplate,
  getWeeklyTemplateByMesocycle,
} from '@/services/data/weeklyTemplateRepository'
import { GET, POST } from './route'

jest.mock('@/services/data/weeklyTemplateRepository', () => ({
  getWeeklyTemplateByMesocycle: jest.fn(),
  createWeeklyTemplate: jest.fn(),
}))

const mockGetWeeklyTemplateByMesocycle = getWeeklyTemplateByMesocycle as jest.Mock
const mockCreateWeeklyTemplate = createWeeklyTemplate as jest.Mock

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
}

beforeEach(() => {
  jest.clearAllMocks()
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
    expect(mockGetWeeklyTemplateByMesocycle).toHaveBeenCalledWith(template.mesocycle_id)
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
})
