import type {
  AthleteContext,
  Mesocycle,
  PlannedSession,
  Programme,
  WeeklyTemplate,
} from '@/types'
import { formatContextForPrompt } from '@/services/ai/contextBuilder'
import { buildSystemPrompt } from './promptBuilder'

// =============================================================================
// MODULE MOCKS
// =============================================================================

jest.mock('@/services/ai/contextBuilder', () => ({
  formatContextForPrompt: jest.fn().mockReturnValue('=== TEST CONTEXT ==='),
}))

const mockFormatContextForPrompt = formatContextForPrompt as jest.Mock

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Returns an AthleteContext with safe neutral defaults.
 * Pass overrides to customise individual fields per test.
 */
function makeAthleteContext(
  overrides?: Partial<AthleteContext>,
): AthleteContext {
  return {
    todaysReadiness: null,
    weeklyReadinessAvg: 3.5,
    recentCheckins: [],
    recentSessions: [],
    sessionCountThisWeek: 2,
    lastSessionDate: '2025-03-22',
    daysSinceLastSession: 2,
    currentFingerHealth: 5,
    illnessFlag: false,
    currentProgramme: null,
    activeMesocycle: null,
    currentWeeklyTemplate: [],
    upcomingPlannedSessions: [],
    warnings: [],
    injuryAreas: [],
    criticalInjuryAreas: [],
    lowInjuryAreas: [],
    activeInjuryFlags: [],
    ...overrides,
  }
}

function makeProgramme(overrides?: Partial<Programme>): Programme {
  return {
    id: 'programme-1',
    created_at: '2026-03-25T10:00:00Z',
    goal: 'Consistent 7b onsight',
    name: 'Summer Multipitch Season',
    notes: null,
    start_date: '2026-01-05',
    target_date: '2026-04-26',
    ...overrides,
  }
}

function makeMesocycle(overrides?: Partial<Mesocycle>): Mesocycle {
  return {
    id: 'mesocycle-1',
    actual_end: null,
    actual_start: null,
    created_at: '2026-03-25T10:00:00Z',
    focus: 'Limit bouldering and finger strength',
    interruption_notes: null,
    name: 'Power & Finger Strength',
    phase_type: 'power',
    planned_end: '2026-03-30',
    planned_start: '2026-03-03',
    programme_id: 'programme-1',
    status: 'active',
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
    ...overrides,
  }
}

function makePlannedSession(overrides?: Partial<PlannedSession>): PlannedSession {
  return {
    id: 'planned-session-1',
    created_at: '2026-03-25T10:00:00Z',
    generated_plan: null,
    generation_notes: 'Increase volume by 10%',
    mesocycle_id: 'mesocycle-1',
    planned_date: '2026-03-26',
    session_type: 'bouldering',
    status: 'planned',
    template_id: 'template-1',
    ...overrides,
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('buildSystemPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFormatContextForPrompt.mockReturnValue('=== TEST CONTEXT ===')
  })

  it('returns a non-empty string', () => {
    const result = buildSystemPrompt(makeAthleteContext())

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('includes athlete profile information', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('ATHLETE PROFILE')
    expect(prompt).toContain('ATHLETE LEVEL')
    expect(prompt).toContain('Limestone')
  })

  it('includes injury area reference in athlete profile', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('Injury areas')
    expect(prompt).toContain('CURRENT ATHLETE CONTEXT')
  })

  it('includes progression rules', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('PROGRESSION RULES')
    expect(prompt).toContain('60%')
  })

  it('includes onsight-specific coaching section', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('onsight')
    expect(prompt).toContain('route reading')
  })

  it('includes the dynamic context section', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('CURRENT ATHLETE CONTEXT')
    expect(prompt).toContain('TEST CONTEXT')
  })

  it('falls back gracefully when no active programme exists', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('CURRENT PROGRAMME STATE')
    expect(prompt).toContain('No active programme found in the app yet')
  })

  it('renders live programme state, weekly template, and upcoming sessions', () => {
    const prompt = buildSystemPrompt(
      makeAthleteContext({
        currentProgramme: makeProgramme(),
        activeMesocycle: makeMesocycle(),
        currentWeeklyTemplate: [
          makeWeeklyTemplate({ day_of_week: 0 }),
          makeWeeklyTemplate({
            id: 'template-2',
            day_of_week: 2,
            duration_mins: 75,
            intensity: 'medium',
            primary_focus: 'Power-endurance',
            session_label: 'Circuits',
            session_type: 'lead',
          }),
        ],
        upcomingPlannedSessions: [makePlannedSession()],
      }),
    )

    expect(prompt).toContain('Summer Multipitch Season')
    expect(prompt).toContain('Power & Finger Strength')
    expect(prompt).toContain('WEEKLY TEMPLATE (ACTIVE MESOCYCLE)')
    expect(prompt).toContain('Mon: Limit Bouldering')
    expect(prompt).toContain('Wed: Circuits')
    expect(prompt).toContain('UPCOMING PLANNED SESSIONS')
    expect(prompt).toContain('2026-03-26: bouldering [planned]')
  })

  it('includes all decision rules', () => {
    const prompt = buildSystemPrompt(makeAthleteContext())

    expect(prompt).toContain('illness_flag')
    expect(prompt).toContain('FINGER HEALTH')
    expect(prompt).toContain('TRACKED INJURY AREAS')
  })

  it('shows no tracked areas when injuryAreas is empty', () => {
    const prompt = buildSystemPrompt(makeAthleteContext({ injuryAreas: [] }))

    expect(prompt).toContain('None currently tracked')
  })

  it('includes tracked area name and health when injuryAreas is populated', () => {
    const prompt = buildSystemPrompt(
      makeAthleteContext({
        injuryAreas: [{ area: 'shoulder_left', health: 3, notes: null }],
        criticalInjuryAreas: [],
        lowInjuryAreas: ['shoulder_left'],
      }),
    )

    expect(prompt).toContain('shoulder_left')
    expect(prompt).toContain('3/5')
    expect(prompt).toContain('[LOW]')
  })

  it('includes CRITICAL label and critical area guidance when area health <= 2', () => {
    const prompt = buildSystemPrompt(
      makeAthleteContext({
        injuryAreas: [{ area: 'wrist_left', health: 2, notes: null }],
        criticalInjuryAreas: ['wrist_left'],
        lowInjuryAreas: [],
      }),
    )

    expect(prompt).toContain('[CRITICAL]')
    expect(prompt).toContain('wrist_left')
    expect(prompt).toContain('Flag immediately')
  })

  it('calls formatContextForPrompt with the provided context', () => {
    const context = makeAthleteContext()
    buildSystemPrompt(context)

    expect(mockFormatContextForPrompt).toHaveBeenCalledTimes(1)
    expect(mockFormatContextForPrompt).toHaveBeenCalledWith(context)
  })
})
