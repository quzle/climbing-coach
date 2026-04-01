import { buildAthleteContext } from '@/services/ai/contextBuilder'
import { generateSessionPlan } from '@/services/ai/geminiClient'
import { getActiveMesocycle } from '@/services/data/mesocycleRepository'
import {
  createPlannedSession,
  getPlannedSessionsInRange,
} from '@/services/data/plannedSessionRepository'
import { getWeeklyTemplateByMesocycle } from '@/services/data/weeklyTemplateRepository'
import { SINGLE_USER_PLACEHOLDER_ID } from '@/lib/placeholder-user-id'
import type {
  AthleteContext,
  Mesocycle,
  PlannedSession,
  SessionLog,
  WeeklyTemplate,
} from '@/types'
import { generatePlannedSessionsForActiveMesocycle } from './sessionGenerator'

jest.mock('@/services/data/mesocycleRepository', () => ({
  getActiveMesocycle: jest.fn(),
}))

jest.mock('@/services/data/weeklyTemplateRepository', () => ({
  getWeeklyTemplateByMesocycle: jest.fn(),
}))

jest.mock('@/services/data/plannedSessionRepository', () => ({
  getPlannedSessionsInRange: jest.fn(),
  createPlannedSession: jest.fn(),
}))

jest.mock('@/services/ai/contextBuilder', () => ({
  buildAthleteContext: jest.fn(),
}))

jest.mock('@/services/ai/geminiClient', () => ({
  generateSessionPlan: jest.fn(),
}))

const mockGetActiveMesocycle = getActiveMesocycle as jest.Mock
const mockGetWeeklyTemplateByMesocycle = getWeeklyTemplateByMesocycle as jest.Mock
const mockGetPlannedSessionsInRange = getPlannedSessionsInRange as jest.Mock
const mockCreatePlannedSession = createPlannedSession as jest.Mock
const mockBuildAthleteContext = buildAthleteContext as jest.Mock
const mockGenerateSessionPlan = generateSessionPlan as jest.Mock

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
    planned_end: '2026-04-05',
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

function makeSessionLog(overrides?: Partial<SessionLog>): SessionLog {
  const base: SessionLog = {
    id: 'session-1',
    created_at: '2026-03-20T09:00:00Z',
    date: '2026-03-20',
    deviation_from_plan: null,
    duration_mins: 90,
    injury_flags: [],
    location: null,
    log_data: null,
    notes: 'Good power output',
    planned_session_id: null,
    quality_rating: 4,
    rpe: 7,
    session_type: 'bouldering',
    user_id: 'user-1',
  }

  return {
    ...base,
    ...overrides,
    deviation_from_plan: overrides?.deviation_from_plan ?? base.deviation_from_plan,
  }
}

function makePlannedSession(overrides?: Partial<PlannedSession>): PlannedSession {
  return {
    id: 'planned-1',
    created_at: '2026-03-25T10:00:00Z',
    generated_plan: null,
    generation_notes: null,
    mesocycle_id: 'mesocycle-1',
    planned_date: '2026-03-31',
    session_type: 'bouldering',
    status: 'planned',
    template_id: 'template-1',
    user_id: 'user-1',
    ...overrides,
  }
}

function makeAthleteContext(overrides?: Partial<AthleteContext>): AthleteContext {
  return {
    todaysReadiness: null,
    weeklyReadinessAvg: 3.6,
    recentCheckins: [],
    recentSessions: [makeSessionLog()],
    sessionCountThisWeek: 2,
    lastSessionDate: '2026-03-20',
    daysSinceLastSession: 2,
    currentFingerHealth: 4,
    illnessFlag: false,
    currentProgramme: null,
    activeMesocycle: null,
    currentWeeklyTemplate: [],
    upcomingPlannedSessions: [],
    injuryAreas: [],
    activeInjuryFlags: [],
    criticalInjuryAreas: [],
    lowInjuryAreas: [],
    warnings: [],
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetActiveMesocycle.mockResolvedValue({ data: makeMesocycle(), error: null })
  mockGetWeeklyTemplateByMesocycle.mockResolvedValue({
    data: [
      makeWeeklyTemplate({ id: 'template-1', day_of_week: 0, session_type: 'bouldering' }),
      makeWeeklyTemplate({ id: 'template-2', day_of_week: 2, session_type: 'fingerboard' }),
    ],
    error: null,
  })
  mockGetPlannedSessionsInRange.mockResolvedValue({ data: [], error: null })
  mockBuildAthleteContext.mockResolvedValue(makeAthleteContext())
  mockGenerateSessionPlan.mockResolvedValue('AI session plan')
  mockCreatePlannedSession.mockImplementation(async (payload: Partial<PlannedSession>) => ({
    data: makePlannedSession({
      id: `planned-${payload.template_id}`,
      planned_date: payload.planned_date,
      session_type: payload.session_type,
      template_id: payload.template_id,
    }),
    error: null,
  }))
})

describe('generatePlannedSessionsForActiveMesocycle', () => {
  it('creates planned sessions for template days in the requested week', async () => {
    const result = await generatePlannedSessionsForActiveMesocycle('2026-03-31')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2)
    expect(mockGetActiveMesocycle).toHaveBeenCalledWith(SINGLE_USER_PLACEHOLDER_ID)
    expect(mockGetPlannedSessionsInRange).toHaveBeenCalledWith(
      '2026-03-30',
      '2026-04-05',
      SINGLE_USER_PLACEHOLDER_ID,
    )
    expect(mockGenerateSessionPlan).not.toHaveBeenCalled()
    expect(mockCreatePlannedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        planned_date: '2026-03-30',
        template_id: 'template-1',
        session_type: 'bouldering',
      }),
    )
    expect(mockCreatePlannedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        planned_date: '2026-04-01',
        template_id: 'template-2',
        session_type: 'fingerboard',
      }),
    )
  })

  it('returns empty data when no active mesocycle exists', async () => {
    mockGetActiveMesocycle.mockResolvedValue({ data: null, error: null })

    const result = await generatePlannedSessionsForActiveMesocycle('2026-03-31')

    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
    expect(mockGetWeeklyTemplateByMesocycle).not.toHaveBeenCalled()
    expect(mockCreatePlannedSession).not.toHaveBeenCalled()
  })

  it('skips creation for sessions that already exist for date+template', async () => {
    mockGetPlannedSessionsInRange.mockResolvedValue({
      data: [
        makePlannedSession({
          planned_date: '2026-03-30',
          template_id: 'template-1',
        }),
      ],
      error: null,
    })

    const result = await generatePlannedSessionsForActiveMesocycle('2026-03-31')

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(mockCreatePlannedSession).toHaveBeenCalledTimes(1)
    expect(mockCreatePlannedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        planned_date: '2026-04-01',
        template_id: 'template-2',
      }),
    )
  })

  it('returns an error when planned session creation fails', async () => {
    mockCreatePlannedSession.mockResolvedValueOnce({
      data: null,
      error: 'Insert failed',
    })

    const result = await generatePlannedSessionsForActiveMesocycle('2026-03-31')

    expect(result.data).toBeNull()
    expect(result.error).toBe('Insert failed')
  })
})
