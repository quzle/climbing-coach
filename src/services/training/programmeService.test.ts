import { getActiveProgramme } from '@/services/data/programmeRepository'
import {
  getActiveMesocycle,
  getMesocyclesByProgramme,
} from '@/services/data/mesocycleRepository'
import { getWeeklyTemplateByMesocycle } from '@/services/data/weeklyTemplateRepository'
import { getUpcomingPlannedSessions } from '@/services/data/plannedSessionRepository'
import { SINGLE_USER_PLACEHOLDER_ID } from '@/lib/placeholder-user-id'
import type {
  Mesocycle,
  PlannedSession,
  Programme,
  WeeklyTemplate,
} from '@/types'
import { getProgrammeBuilderSnapshot } from './programmeService'

jest.mock('@/services/data/programmeRepository', () => ({
  getActiveProgramme: jest.fn(),
}))

jest.mock('@/services/data/mesocycleRepository', () => ({
  getActiveMesocycle: jest.fn(),
  getMesocyclesByProgramme: jest.fn(),
}))

jest.mock('@/services/data/weeklyTemplateRepository', () => ({
  getWeeklyTemplateByMesocycle: jest.fn(),
}))

jest.mock('@/services/data/plannedSessionRepository', () => ({
  getUpcomingPlannedSessions: jest.fn(),
}))

const mockGetActiveProgramme = getActiveProgramme as jest.Mock
const mockGetActiveMesocycle = getActiveMesocycle as jest.Mock
const mockGetMesocyclesByProgramme = getMesocyclesByProgramme as jest.Mock
const mockGetWeeklyTemplateByMesocycle = getWeeklyTemplateByMesocycle as jest.Mock
const mockGetUpcomingPlannedSessions = getUpcomingPlannedSessions as jest.Mock

function makeProgramme(overrides?: Partial<Programme>): Programme {
  return {
    id: 'programme-1',
    created_at: '2026-03-25T10:00:00Z',
    goal: 'Consistent 7b onsight',
    name: 'Summer Multipitch Season',
    notes: null,
    start_date: '2026-01-05',
    status: 'active',
    target_date: '2026-04-26',
    athlete_profile: null,
    user_id: 'user-1',
    ...overrides,
  }
}

function makeMesocycle(overrides?: Partial<Mesocycle>): Mesocycle {
  return {
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
    user_id: 'user-1',
    ...overrides,
  }
}

function makeWeeklyTemplate(overrides?: Partial<WeeklyTemplate>): WeeklyTemplate {
  return {
    id: 'template-1',
    day_of_week: 1,
    duration_mins: 90,
    intensity: 'high',
    mesocycle_id: 'mesocycle-1',
    notes: null,
    primary_focus: 'Power',
    session_label: 'Limit Bouldering',
    session_type: 'bouldering',
    user_id: 'user-1',
    ...overrides,
  }
}

function makePlannedSession(overrides?: Partial<PlannedSession>): PlannedSession {
  return {
    id: 'planned-session-1',
    created_at: '2026-03-25T10:00:00Z',
    generated_plan: null,
    generation_notes: null,
    mesocycle_id: 'mesocycle-1',
    planned_date: '2026-03-26',
    session_type: 'bouldering',
    status: 'planned',
    template_id: 'template-1',
    user_id: 'user-1',
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetActiveProgramme.mockResolvedValue({ data: makeProgramme(), error: null })
  mockGetActiveMesocycle.mockResolvedValue({ data: makeMesocycle(), error: null })
  mockGetMesocyclesByProgramme.mockResolvedValue({
    data: [makeMesocycle()],
    error: null,
  })
  mockGetWeeklyTemplateByMesocycle.mockResolvedValue({
    data: [makeWeeklyTemplate()],
    error: null,
  })
  mockGetUpcomingPlannedSessions.mockResolvedValue({
    data: [makePlannedSession()],
    error: null,
  })
})

describe('getProgrammeBuilderSnapshot', () => {
  it('returns the aggregated planning snapshot', async () => {
    const result = await getProgrammeBuilderSnapshot()

    expect(result.error).toBeNull()
    expect(mockGetActiveProgramme).toHaveBeenCalledWith(SINGLE_USER_PLACEHOLDER_ID)
    expect(result.data?.currentProgramme?.name).toBe('Summer Multipitch Season')
    expect(result.data?.mesocycles).toHaveLength(1)
    expect(result.data?.currentWeeklyTemplate).toHaveLength(1)
    expect(result.data?.upcomingPlannedSessions).toHaveLength(1)
  })

  it('returns empty arrays when no active programme exists', async () => {
    mockGetActiveProgramme.mockResolvedValue({ data: null, error: null })
    mockGetActiveMesocycle.mockResolvedValue({ data: null, error: null })

    const result = await getProgrammeBuilderSnapshot()

    expect(result.error).toBeNull()
    expect(result.data?.currentProgramme).toBeNull()
    expect(result.data?.mesocycles).toEqual([])
    expect(result.data?.currentWeeklyTemplate).toEqual([])
  })
})