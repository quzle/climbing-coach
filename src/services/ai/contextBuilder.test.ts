import type {
  InjuryAreaRow,
  Mesocycle,
  PlannedSession,
  Programme,
  ReadinessCheckin,
  SessionLog,
  WeeklyTemplate,
} from '@/types'
import { SINGLE_USER_PLACEHOLDER_ID } from '@/lib/placeholder-user-id'
import { logWarn } from '@/lib/logger'
import {
  getTodaysCheckin,
  getRecentCheckins,
  getAverageReadiness,
} from '@/services/data/readinessRepository'
import {
  getRecentSessions,
  getSessionCountThisWeek,
  getLastSessionDate,
} from '@/services/data/sessionRepository'
import { getActiveInjuryAreas } from '@/services/data/injuryAreasRepository'
import { getActiveProgramme } from '@/services/data/programmeRepository'
import { getActiveMesocycle } from '@/services/data/mesocycleRepository'
import { getWeeklyTemplateByMesocycle } from '@/services/data/weeklyTemplateRepository'
import { getUpcomingPlannedSessions } from '@/services/data/plannedSessionRepository'
import {
  buildAthleteContext,
  buildProgrammeContext,
  formatContextForPrompt,
  parseInjuryAreaHealth,
} from './contextBuilder'

// =============================================================================
// MODULE MOCKS
// =============================================================================

jest.mock('@/services/data/readinessRepository', () => ({
  getTodaysCheckin: jest.fn(),
  getRecentCheckins: jest.fn(),
  getAverageReadiness: jest.fn(),
}))

jest.mock('@/services/data/sessionRepository', () => ({
  getRecentSessions: jest.fn(),
  getSessionCountThisWeek: jest.fn(),
  getLastSessionDate: jest.fn(),
}))

jest.mock('@/services/data/injuryAreasRepository', () => ({
  getActiveInjuryAreas: jest.fn(),
}))

jest.mock('@/services/data/programmeRepository', () => ({
  getActiveProgramme: jest.fn(),
}))

jest.mock('@/services/data/mesocycleRepository', () => ({
  getActiveMesocycle: jest.fn(),
}))

jest.mock('@/services/data/weeklyTemplateRepository', () => ({
  getWeeklyTemplateByMesocycle: jest.fn(),
}))

jest.mock('@/services/data/plannedSessionRepository', () => ({
  getUpcomingPlannedSessions: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logWarn: jest.fn(),
}))

// Typed references to mocked functions
const mockGetTodaysCheckin = getTodaysCheckin as jest.Mock
const mockGetRecentCheckins = getRecentCheckins as jest.Mock
const mockGetAverageReadiness = getAverageReadiness as jest.Mock
const mockGetRecentSessions = getRecentSessions as jest.Mock
const mockGetSessionCountThisWeek = getSessionCountThisWeek as jest.Mock
const mockGetLastSessionDate = getLastSessionDate as jest.Mock
const mockGetActiveInjuryAreas = getActiveInjuryAreas as jest.Mock
const mockGetActiveProgramme = getActiveProgramme as jest.Mock
const mockGetActiveMesocycle = getActiveMesocycle as jest.Mock
const mockGetWeeklyTemplateByMesocycle = getWeeklyTemplateByMesocycle as jest.Mock
const mockGetUpcomingPlannedSessions = getUpcomingPlannedSessions as jest.Mock
const mockLogWarn = logWarn as jest.Mock

// =============================================================================
// FACTORIES & HELPERS
// =============================================================================

/**
 * Returns a fresh ReadinessCheckin with healthy defaults.
 * Pass overrides to customise individual fields per test.
 */
function makeReadinessCheckin(
  overrides?: Partial<ReadinessCheckin>,
): ReadinessCheckin {
  return {
    id: 'checkin-1',
    date: new Date().toISOString().split('T')[0] as string,
    sleep_quality: 4,
    fatigue: 2,
    finger_health: 5,
    life_stress: 2,
    illness_flag: false,
    readiness_score: 3.8,
    notes: null,
    injury_area_health: null,
    created_at: new Date().toISOString(),
    user_id: 'user-1',
    ...overrides,
  }
}

/**
 * Returns a complete SessionLog with sensible defaults.
 * Pass overrides to customise individual fields per test.
 */
function makeSessionLog(overrides?: Partial<SessionLog>): SessionLog {
  return {
    id: 'test-session-uuid',
    date: '2025-03-24',
    session_type: 'bouldering',
    location: 'Boulder World Geneva',
    duration_mins: 90,
    quality_rating: 4,
    rpe: 7,
    injury_flags: null,
    notes: null,
    planned_session_id: null,
    log_data: null,
    deviation_from_plan: null,
    created_at: '2025-03-24T18:00:00Z',
    user_id: 'user-1',
    ...overrides,
  }
}

function makeInjuryAreaRow(overrides?: Partial<InjuryAreaRow>): InjuryAreaRow {
  return {
    id: 'area-uuid-1',
    area: 'shoulder_left',
    is_active: true,
    added_at: '2026-03-25T10:00:00Z',
    archived_at: null,
    user_id: 'user-1',
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

/**
 * Returns an ISO date string (YYYY-MM-DD) for n days before today.
 * Uses local date components (not toISOString) so the result matches the
 * local calendar day that computeDaysSince will also resolve via setHours.
 * Mixing toISOString (UTC) with setHours (local) causes off-by-one errors
 * in timezones ahead of UTC.
 */
function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// =============================================================================
// DEFAULT MOCK SETUP
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks()

  mockGetTodaysCheckin.mockResolvedValue({
    data: makeReadinessCheckin(),
    error: null,
  })
  mockGetRecentCheckins.mockResolvedValue({
    data: [makeReadinessCheckin()],
    error: null,
  })
  mockGetAverageReadiness.mockResolvedValue({ data: 3.8, error: null })
  mockGetRecentSessions.mockResolvedValue({
    data: [makeSessionLog()],
    error: null,
  })
  mockGetSessionCountThisWeek.mockResolvedValue({ data: 3, error: null })
  mockGetLastSessionDate.mockResolvedValue({ data: '2025-03-22', error: null })
  mockGetActiveInjuryAreas.mockResolvedValue({ data: [], error: null })
  mockGetActiveProgramme.mockResolvedValue({ data: null, error: null })
  mockGetActiveMesocycle.mockResolvedValue({ data: null, error: null })
  mockGetWeeklyTemplateByMesocycle.mockResolvedValue({ data: [], error: null })
  mockGetUpcomingPlannedSessions.mockResolvedValue({ data: [], error: null })
})

describe('buildProgrammeContext', () => {
  it('returns live programme state when planning data exists', async () => {
    mockGetActiveProgramme.mockResolvedValue({ data: makeProgramme(), error: null })
    mockGetActiveMesocycle.mockResolvedValue({ data: makeMesocycle(), error: null })
    mockGetWeeklyTemplateByMesocycle.mockResolvedValue({
      data: [makeWeeklyTemplate()],
      error: null,
    })
    mockGetUpcomingPlannedSessions.mockResolvedValue({
      data: [makePlannedSession()],
      error: null,
    })

    const result = await buildProgrammeContext()

    expect(mockGetActiveProgramme).toHaveBeenCalledWith(SINGLE_USER_PLACEHOLDER_ID)
    expect(mockGetActiveMesocycle).toHaveBeenCalledWith(SINGLE_USER_PLACEHOLDER_ID)
    expect(mockGetUpcomingPlannedSessions).toHaveBeenCalledWith(7, SINGLE_USER_PLACEHOLDER_ID)
    expect(result.currentProgramme?.name).toBe('Summer Multipitch Season')
    expect(result.activeMesocycle?.name).toBe('Power Block')
    expect(result.currentWeeklyTemplate).toHaveLength(1)
    expect(result.upcomingPlannedSessions).toHaveLength(1)
  })

  it('returns safe fallbacks when no planning data exists', async () => {
    const result = await buildProgrammeContext()

    expect(result.currentProgramme).toBeNull()
    expect(result.activeMesocycle).toBeNull()
    expect(result.currentWeeklyTemplate).toEqual([])
    expect(result.upcomingPlannedSessions).toEqual([])
  })
})

// =============================================================================
// TESTS
// =============================================================================

describe('computeWarnings — illness', () => {
  it('adds illness warning when illness_flag is true', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({ illness_flag: true }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(context.warnings.some((w) => w.includes('ILLNESS FLAG ACTIVE'))).toBe(
      true,
    )
  })

  it('does not add illness warning when flag is false', async () => {
    // Default mock has illness_flag: false
    const context = await buildAthleteContext()

    expect(context.warnings.some((w) => w.includes('ILLNESS'))).toBe(false)
  })
})

describe('buildAthleteContext — programme context', () => {
  it('merges current programme state into AthleteContext', async () => {
    mockGetActiveProgramme.mockResolvedValue({ data: makeProgramme(), error: null })
    mockGetActiveMesocycle.mockResolvedValue({ data: makeMesocycle(), error: null })
    mockGetWeeklyTemplateByMesocycle.mockResolvedValue({
      data: [makeWeeklyTemplate()],
      error: null,
    })
    mockGetUpcomingPlannedSessions.mockResolvedValue({
      data: [makePlannedSession()],
      error: null,
    })

    const context = await buildAthleteContext()

    expect(context.currentProgramme?.name).toBe('Summer Multipitch Season')
    expect(context.activeMesocycle?.phase_type).toBe('power')
    expect(context.currentWeeklyTemplate[0]?.session_label).toBe('Limit Bouldering')
    expect(context.upcomingPlannedSessions[0]?.planned_date).toBe('2026-03-26')
  })
})

describe('computeWarnings — finger health', () => {
  it('adds critical warning when finger_health is 1', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({ finger_health: 1 }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(
      context.warnings.some((w) => w.includes('Finger health critical')),
    ).toBe(true)
  })

  it('adds critical warning when finger_health is 2', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({ finger_health: 2 }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(
      context.warnings.some((w) => w.includes('Finger health critical')),
    ).toBe(true)
  })

  it('adds advisory warning when finger_health is 3', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({ finger_health: 3 }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(
      context.warnings.some((w) => w.includes('Finger health low (3/5)')),
    ).toBe(true)
  })

  it('adds no finger warning when finger_health is 4 or 5', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({ finger_health: 4 }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(context.warnings.some((w) => w.includes('Finger health'))).toBe(
      false,
    )
  })
})

describe('computeWarnings — injury areas', () => {
  it('adds critical warning for an injury area with health 1 or 2', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({
        injury_area_health: [
          { area: 'shoulder_left', health: 2, notes: null },
        ],
      }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(
      context.warnings.some(
        (w) => w.includes('shoulder_left critical') && w.includes('avoid pressing'),
      ),
    ).toBe(true)
  })

  it('adds advisory warning for an injury area with health 3', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({
        injury_area_health: [
          { area: 'finger_a2_right', health: 3, notes: null },
        ],
      }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(
      context.warnings.some(
        (w) => w.includes('finger_a2_right low (3/5)') && w.includes('avoid fingerboard'),
      ),
    ).toBe(true)
  })

  it('adds no injury area warning when all areas are health 4 or 5', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({
        injury_area_health: [
          { area: 'shoulder_left', health: 4, notes: null },
          { area: 'finger_a2_right', health: 5, notes: null },
        ],
      }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(context.warnings.some((w) => w.includes('critical'))).toBe(false)
    expect(context.warnings.some((w) => w.includes('low (3/5)'))).toBe(false)
  })

  it('adds warnings for multiple injury areas independently', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({
        injury_area_health: [
          { area: 'shoulder_left', health: 1, notes: null },
          { area: 'elbow_medial_right', health: 3, notes: null },
        ],
      }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(context.warnings.some((w) => w.includes('shoulder_left critical'))).toBe(true)
    expect(context.warnings.some((w) => w.includes('elbow_medial_right low'))).toBe(true)
  })

  it('populates criticalInjuryAreas for health <= 2', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({
        injury_area_health: [
          { area: 'wrist_left', health: 2, notes: null },
          { area: 'shoulder_right', health: 4, notes: null },
        ],
      }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(context.criticalInjuryAreas).toContain('wrist_left')
    expect(context.criticalInjuryAreas).not.toContain('shoulder_right')
  })

  it('populates lowInjuryAreas for health === 3', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({
        injury_area_health: [
          { area: 'knee_left', health: 3, notes: null },
          { area: 'lower_back', health: 4, notes: null },
        ],
      }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(context.lowInjuryAreas).toContain('knee_left')
    expect(context.lowInjuryAreas).not.toContain('lower_back')
  })

  it('returns empty injuryAreas when injury_area_health is null', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({ injury_area_health: null }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(context.injuryAreas).toEqual([])
    expect(context.criticalInjuryAreas).toEqual([])
    expect(context.lowInjuryAreas).toEqual([])
  })
})

describe('computeWarnings — return to training', () => {
  it('adds 7-day warning when 7-13 days since last session', async () => {
    mockGetLastSessionDate.mockResolvedValue({
      data: daysAgoISO(10),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(
      context.warnings.some((w) => w.includes('days since last session')),
    ).toBe(true)
    expect(context.warnings.some((w) => w.includes('60% volume'))).toBe(true)
  })

  it('adds 14-day warning when 14+ days since last session', async () => {
    mockGetLastSessionDate.mockResolvedValue({
      data: daysAgoISO(20),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(
      context.warnings.some((w) => w.includes('significant detraining')),
    ).toBe(true)
  })

  it('adds no gap warning when session was recent', async () => {
    mockGetLastSessionDate.mockResolvedValue({
      data: daysAgoISO(1),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(
      context.warnings.some((w) => w.includes('days since last session')),
    ).toBe(false)
  })
})

describe('computeWarnings — no check-in', () => {
  it('adds no check-in warning when todaysReadiness is null', async () => {
    mockGetTodaysCheckin.mockResolvedValue({ data: null, error: null })

    const context = await buildAthleteContext()

    expect(
      context.warnings.some((w) =>
        w.includes('No readiness check-in today'),
      ),
    ).toBe(true)
  })
})

describe('buildAthleteContext', () => {
  it('returns correct sessionCountThisWeek', async () => {
    mockGetSessionCountThisWeek.mockResolvedValue({ data: 4, error: null })

    const context = await buildAthleteContext()

    expect(context.sessionCountThisWeek).toBe(4)
  })

  it('returns correct daysSinceLastSession', async () => {
    mockGetLastSessionDate.mockResolvedValue({
      data: daysAgoISO(3),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(context.daysSinceLastSession).toBe(3)
  })

  it('returns 999 for daysSinceLastSession when no sessions', async () => {
    mockGetLastSessionDate.mockResolvedValue({ data: null, error: null })

    const context = await buildAthleteContext()

    expect(context.daysSinceLastSession).toBe(999)
  })

  it('handles repository errors gracefully without throwing', async () => {
    mockGetRecentSessions.mockResolvedValue({ data: null, error: 'DB error' })

    const context = await buildAthleteContext()

    expect(context.recentSessions).toEqual([])
    expect(mockLogWarn).toHaveBeenCalledWith({
      event: 'ai_context_dependency_failed',
      outcome: 'failure',
      userId: '00000000-0000-0000-0000-000000000001',
      entityType: 'athlete_context',
      data: {
        stage: 'athlete',
        dependency: 'getRecentSessions',
      },
      error: 'DB error',
    })
  })

  it('uses Promise.all for parallel fetching — all repository functions called once', async () => {
    await buildAthleteContext()

    expect(mockGetTodaysCheckin).toHaveBeenCalledTimes(1)
    expect(mockGetRecentCheckins).toHaveBeenCalledTimes(1)
    expect(mockGetAverageReadiness).toHaveBeenCalledTimes(1)
    expect(mockGetRecentSessions).toHaveBeenCalledTimes(1)
    expect(mockGetSessionCountThisWeek).toHaveBeenCalledTimes(1)
    expect(mockGetLastSessionDate).toHaveBeenCalledTimes(1)
    expect(mockGetActiveInjuryAreas).toHaveBeenCalledTimes(1)
  })
})

describe('formatContextForPrompt', () => {
  it('includes illness warning section when flag is true', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({ illness_flag: true }),
      error: null,
    })

    const context = await buildAthleteContext()
    const output = formatContextForPrompt(context)

    expect(output).toContain('ACTIVE WARNINGS')
    expect(output).toContain('ILLNESS')
  })

  it('shows "No active warnings" when warnings array is empty', async () => {
    // Use a recent session date so no return-to-training warning fires,
    // healthy defaults so no health warnings fire, and a check-in so no
    // missing check-in warning fires.
    mockGetLastSessionDate.mockResolvedValue({
      data: daysAgoISO(1),
      error: null,
    })

    const context = await buildAthleteContext()
    const output = formatContextForPrompt(context)

    expect(output).toContain('No active warnings')
  })

  it('shows "No sessions logged yet" when sessions array is empty', async () => {
    mockGetRecentSessions.mockResolvedValue({ data: [], error: null })

    const context = await buildAthleteContext()
    const output = formatContextForPrompt(context)

    expect(output).toContain('No sessions logged yet')
  })

  it('limits sessions to 15 and shows overflow count', async () => {
    const twentySessions = Array.from({ length: 20 }, (_, i) =>
      makeSessionLog({ id: `session-${i}` }),
    )
    mockGetRecentSessions.mockResolvedValue({
      data: twentySessions,
      error: null,
    })

    const context = await buildAthleteContext()
    const output = formatContextForPrompt(context)

    expect(output).toContain('+5 more sessions not shown')
  })

  it('includes injury area health block when injuryAreas is populated', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({
        injury_area_health: [
          { area: 'shoulder_left', health: 2, notes: null },
        ],
      }),
      error: null,
    })

    const context = await buildAthleteContext()
    const output = formatContextForPrompt(context)

    expect(output).toContain('shoulder_left')
    expect(output).toContain('2/5')
  })

  it('does not include a "Shoulder health" line (deprecated field)', async () => {
    const context = await buildAthleteContext()
    const output = formatContextForPrompt(context)

    expect(output).not.toContain('Shoulder health:')
  })

  it('uses "Injuries" column header in trend table', async () => {
    mockGetRecentCheckins.mockResolvedValue({
      data: [makeReadinessCheckin()],
      error: null,
    })

    const context = await buildAthleteContext()
    const output = formatContextForPrompt(context)

    expect(output).toContain('Injuries')
    expect(output).not.toContain('| Shoulder |')
  })

  it('populates activeInjuryFlags from session injury_flags', async () => {
    mockGetRecentSessions.mockResolvedValue({
      data: [makeSessionLog({ injury_flags: ['shoulder_left', 'finger_a2_right'] })],
      error: null,
    })

    const context = await buildAthleteContext()

    expect(context.activeInjuryFlags).toContain('shoulder_left')
    expect(context.activeInjuryFlags).toContain('finger_a2_right')
  })
})

describe('parseInjuryAreaHealth', () => {
  it('returns empty array for null', () => {
    expect(parseInjuryAreaHealth(null)).toEqual([])
  })

  it('returns empty array for non-array value', () => {
    expect(parseInjuryAreaHealth({ area: 'shoulder_left', health: 3 })).toEqual([])
  })

  it('returns empty array for a plain string', () => {
    expect(parseInjuryAreaHealth('shoulder_left')).toEqual([])
  })

  it('filters out items missing area or health', () => {
    const input = [
      { area: 'shoulder_left', health: 3, notes: null },
      { health: 4 },
      { area: 'wrist_left' },
      null,
    ]
    const result = parseInjuryAreaHealth(input)
    expect(result).toHaveLength(1)
    expect(result[0]?.area).toBe('shoulder_left')
  })

  it('correctly parses a valid array with notes', () => {
    const input = [
      { area: 'finger_a2_right', health: 3, notes: 'aching' },
    ]
    const result = parseInjuryAreaHealth(input)
    expect(result).toEqual([{ area: 'finger_a2_right', health: 3, notes: 'aching' }])
  })

  it('coerces notes: null when notes field is absent', () => {
    const input = [{ area: 'elbow_medial_right', health: 4 }]
    const result = parseInjuryAreaHealth(input)
    expect(result[0]?.notes).toBeNull()
  })
})
