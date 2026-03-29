/**
 * @jest-environment node
 */
import { getProgrammeBuilderSnapshot } from '@/services/training/programmeService'
import { GET } from './route'

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({ userId: 'user-1', errorResponse: null }),
}))

jest.mock('@/services/training/programmeService', () => ({
  getProgrammeBuilderSnapshot: jest.fn(),
}))

const mockGetProgrammeBuilderSnapshot = getProgrammeBuilderSnapshot as jest.Mock

const mockSnapshot = {
  currentProgramme: {
    id: 'programme-1',
    created_at: '2026-03-25T10:00:00Z',
    goal: 'Consistent 7b onsight',
    name: 'Summer Multipitch Season',
    notes: null,
    start_date: '2026-01-05',
    target_date: '2026-04-26',
  },
  activeMesocycle: {
    id: 'mesocycle-1',
    actual_end: null,
    actual_start: null,
    created_at: '2026-03-25T10:00:00Z',
    focus: 'Power and finger strength',
    interruption_notes: null,
    name: 'Power Block',
    phase_type: 'power',
    planned_end: '2026-03-30',
    planned_start: '2026-03-03',
    programme_id: 'programme-1',
    status: 'active',
  },
  mesocycles: [],
  currentWeeklyTemplate: [],
  upcomingPlannedSessions: [],
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetProgrammeBuilderSnapshot.mockResolvedValue({
    data: mockSnapshot,
    error: null,
  })
})

describe('GET /api/programme', () => {
  it('returns 200 with the aggregated programme snapshot', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual(mockSnapshot)
    expect(body.error).toBeNull()
  })

  it('returns 500 when the service fails', async () => {
    mockGetProgrammeBuilderSnapshot.mockResolvedValue({
      data: null,
      error: 'DB error',
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.data).toBeNull()
    expect(body.error).toContain('Failed to load programme data')
  })
})