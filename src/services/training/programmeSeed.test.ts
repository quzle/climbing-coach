import {
  createMesocycle,
  deleteMesocycle,
} from '@/services/data/mesocycleRepository'
import {
  createPlannedSession,
  deletePlannedSession,
} from '@/services/data/plannedSessionRepository'
import {
  createProgramme,
  deleteProgramme,
  getProgrammes,
} from '@/services/data/programmeRepository'
import {
  createWeeklyTemplate,
  deleteWeeklyTemplate,
} from '@/services/data/weeklyTemplateRepository'
import type { Mesocycle, PlannedSession, Programme, WeeklyTemplate } from '@/types'
import { SINGLE_USER_PLACEHOLDER_ID } from '@/lib/placeholder-user-id'
import { seedSummerMultipitchProgramme } from './programmeSeed'

jest.mock('@/services/data/programmeRepository', () => ({
  getProgrammes: jest.fn(),
  createProgramme: jest.fn(),
  deleteProgramme: jest.fn(),
}))

jest.mock('@/services/data/mesocycleRepository', () => ({
  createMesocycle: jest.fn(),
  deleteMesocycle: jest.fn(),
}))

jest.mock('@/services/data/weeklyTemplateRepository', () => ({
  createWeeklyTemplate: jest.fn(),
  deleteWeeklyTemplate: jest.fn(),
}))

jest.mock('@/services/data/plannedSessionRepository', () => ({
  createPlannedSession: jest.fn(),
  deletePlannedSession: jest.fn(),
}))

const mockGetProgrammes = getProgrammes as jest.Mock
const mockCreateProgramme = createProgramme as jest.Mock
const mockDeleteProgramme = deleteProgramme as jest.Mock
const mockCreateMesocycle = createMesocycle as jest.Mock
const mockDeleteMesocycle = deleteMesocycle as jest.Mock
const mockCreateWeeklyTemplate = createWeeklyTemplate as jest.Mock
const mockDeleteWeeklyTemplate = deleteWeeklyTemplate as jest.Mock
const mockCreatePlannedSession = createPlannedSession as jest.Mock
const mockDeletePlannedSession = deletePlannedSession as jest.Mock

function makeProgramme(overrides?: Partial<Programme>): Programme {
  return {
    id: 'programme-1',
    created_at: '2026-03-25T10:00:00Z',
    goal: 'Arrive ready for big routes',
    name: 'Summer Multipitch Season',
    notes: null,
    start_date: '2026-03-23',
    status: 'active',
    target_date: '2026-07-12',
    athlete_profile: null,
    user_id: 'user-1',
    ...overrides,
  }
}

function makeMesocycle(index: number, overrides?: Partial<Mesocycle>): Mesocycle {
  return {
    id: `mesocycle-${index}`,
    actual_end: null,
    actual_start: null,
    created_at: '2026-03-25T10:00:00Z',
    focus: 'Focus',
    interruption_notes: null,
    name: `Mesocycle ${index}`,
    phase_type: 'base',
    planned_end: '2026-04-19',
    planned_start: '2026-03-23',
    programme_id: 'programme-1',
    status: index === 1 ? 'active' : 'planned',
    user_id: 'user-1',
    ...overrides,
  }
}

function makeWeeklyTemplate(index: number, overrides?: Partial<WeeklyTemplate>): WeeklyTemplate {
  return {
    id: `template-${index}`,
    day_of_week: ((index - 1) % 7) + 1,
    duration_mins: 60,
    intensity: 'medium',
    mesocycle_id: 'mesocycle-1',
    notes: null,
    primary_focus: 'Focus',
    session_label: `Template ${index}`,
    session_type: 'lead',
    user_id: 'user-1',
    ...overrides,
  }
}

function makePlannedSession(index: number, overrides?: Partial<PlannedSession>): PlannedSession {
  return {
    id: `planned-session-${index}`,
    created_at: '2026-03-25T10:00:00Z',
    generated_plan: null,
    generation_notes: 'Phase 2F starter seed',
    mesocycle_id: 'mesocycle-1',
    planned_date: '2026-03-23',
    session_type: 'lead',
    status: 'planned',
    template_id: 'template-1',
    user_id: 'user-1',
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers().setSystemTime(new Date('2026-03-25T12:00:00Z'))

  mockGetProgrammes.mockResolvedValue({ data: [], error: null })
  mockCreateProgramme.mockResolvedValue({ data: makeProgramme(), error: null })
  mockDeleteProgramme.mockResolvedValue({ data: makeProgramme(), error: null })
  mockDeleteMesocycle.mockResolvedValue({ data: makeMesocycle(1), error: null })
  mockDeleteWeeklyTemplate.mockResolvedValue({ data: makeWeeklyTemplate(1), error: null })
  mockDeletePlannedSession.mockResolvedValue({ data: makePlannedSession(1), error: null })

  let mesocycleIndex = 0
  mockCreateMesocycle.mockImplementation(async (input) => {
    mesocycleIndex += 1
    return {
      data: makeMesocycle(mesocycleIndex, {
        name: input.name,
        phase_type: input.phase_type,
        planned_start: input.planned_start,
        planned_end: input.planned_end,
        status: input.status,
      }),
      error: null,
    }
  })

  let templateIndex = 0
  mockCreateWeeklyTemplate.mockImplementation(async (input) => {
    templateIndex += 1
    return {
      data: makeWeeklyTemplate(templateIndex, {
        day_of_week: input.day_of_week,
        mesocycle_id: input.mesocycle_id,
        session_label: input.session_label,
        session_type: input.session_type,
        intensity: input.intensity,
        duration_mins: input.duration_mins,
        primary_focus: input.primary_focus,
        notes: input.notes,
      }),
      error: null,
    }
  })

  let plannedSessionIndex = 0
  mockCreatePlannedSession.mockImplementation(async (input) => {
    plannedSessionIndex += 1
    return {
      data: makePlannedSession(plannedSessionIndex, {
        mesocycle_id: input.mesocycle_id,
        planned_date: input.planned_date,
        session_type: input.session_type,
        status: input.status,
        template_id: input.template_id,
        generated_plan: input.generated_plan ?? null,
      }),
      error: null,
    }
  })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('seedSummerMultipitchProgramme', () => {
  it('creates the starter summer programme tree when no seed exists', async () => {
    const result = await seedSummerMultipitchProgramme()

    expect(result.error).toBeNull()
    expect(mockGetProgrammes).toHaveBeenCalledWith(SINGLE_USER_PLACEHOLDER_ID)
    expect(result.data).toEqual({
      seeded: true,
      programmeId: 'programme-1',
      programmeName: 'Summer Multipitch Season',
      createdMesocycleCount: 4,
      createdWeeklyTemplateCount: 28,
      createdPlannedSessionCount: 14,
    })
    expect(mockCreateProgramme).toHaveBeenCalledTimes(1)
    expect(mockCreateProgramme.mock.calls[0][0]).toMatchObject({
      name: 'Summer Multipitch Season',
      start_date: '2026-03-23',
      target_date: '2026-07-12',
    })
    expect(mockCreateProgramme.mock.calls[0][0].notes).toContain('[phase2f-seed:v1]')
    expect(mockCreateMesocycle).toHaveBeenCalledTimes(4)
    expect(mockCreateWeeklyTemplate).toHaveBeenCalledTimes(28)
    expect(mockCreatePlannedSession).toHaveBeenCalledTimes(14)
    expect(mockCreatePlannedSession.mock.calls[0][0]).toMatchObject({
      planned_date: '2026-03-23',
      status: 'planned',
    })
    expect(mockCreatePlannedSession.mock.calls[7][0]).toMatchObject({
      planned_date: '2026-03-30',
      status: 'planned',
    })
  })

  it('does not create duplicate rows when the seed marker already exists', async () => {
    mockGetProgrammes.mockResolvedValue({
      data: [makeProgramme({ notes: 'Phase 2F starter seed\n\n[phase2f-seed:v1]' })],
      error: null,
    })

    const result = await seedSummerMultipitchProgramme()

    expect(result.error).toBeNull()
    expect(result.data).toEqual({
      seeded: false,
      programmeId: 'programme-1',
      programmeName: 'Summer Multipitch Season',
      createdMesocycleCount: 0,
      createdWeeklyTemplateCount: 0,
      createdPlannedSessionCount: 0,
    })
    expect(mockCreateProgramme).not.toHaveBeenCalled()
    expect(mockCreateMesocycle).not.toHaveBeenCalled()
    expect(mockCreateWeeklyTemplate).not.toHaveBeenCalled()
    expect(mockCreatePlannedSession).not.toHaveBeenCalled()
  })

  it('returns an error when programme creation fails', async () => {
    mockCreateProgramme.mockResolvedValue({ data: null, error: 'insert failed' })

    const result = await seedSummerMultipitchProgramme()

    expect(result.data).toBeNull()
    expect(result.error).toBe('insert failed')
    expect(mockCreateMesocycle).not.toHaveBeenCalled()
  })

  it('passes user scope when deleting planned sessions during rollback', async () => {
    mockCreatePlannedSession.mockResolvedValueOnce({ data: null, error: 'insert failed' })

    await seedSummerMultipitchProgramme()

    expect(mockDeletePlannedSession.mock.calls.every((call) => call[1] === SINGLE_USER_PLACEHOLDER_ID)).toBe(true)
  })
})