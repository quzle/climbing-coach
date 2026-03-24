import type { ReadinessCheckin, SessionLog } from '@/types'
import {
  getTodaysCheckin,
  getRecentCheckins,
  getAverageReadiness,
} from '@/services/data/readinessRepository'
import {
  getRecentSessions,
  getSessionCountThisWeek,
  getLastSessionDate,
  getSessionsWithShoulderFlag,
} from '@/services/data/sessionRepository'
import { buildAthleteContext, formatContextForPrompt } from './contextBuilder'

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
  getSessionsWithShoulderFlag: jest.fn(),
}))

// Typed references to mocked functions
const mockGetTodaysCheckin = getTodaysCheckin as jest.Mock
const mockGetRecentCheckins = getRecentCheckins as jest.Mock
const mockGetAverageReadiness = getAverageReadiness as jest.Mock
const mockGetRecentSessions = getRecentSessions as jest.Mock
const mockGetSessionCountThisWeek = getSessionCountThisWeek as jest.Mock
const mockGetLastSessionDate = getLastSessionDate as jest.Mock
// Declared to satisfy type-checking of the full mock module declaration above
const _mockGetSessionsWithShoulderFlag = getSessionsWithShoulderFlag as jest.Mock

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
    shoulder_health: 5,
    life_stress: 2,
    illness_flag: false,
    readiness_score: 3.8,
    notes: null,
    created_at: new Date().toISOString(),
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
    shoulder_flag: false,
    notes: null,
    planned_session_id: null,
    log_data: null,
    deviation_from_plan: null,
    created_at: '2025-03-24T18:00:00Z',
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

describe('computeWarnings — shoulder health', () => {
  it('adds critical warning when shoulder_health is 1 or 2', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({ shoulder_health: 2 }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(
      context.warnings.some((w) => w.includes('Shoulder health critical')),
    ).toBe(true)
  })

  it('adds advisory warning when shoulder_health is 3', async () => {
    mockGetTodaysCheckin.mockResolvedValue({
      data: makeReadinessCheckin({ shoulder_health: 3 }),
      error: null,
    })

    const context = await buildAthleteContext()

    expect(
      context.warnings.some((w) => w.includes('Shoulder health low (3/5)')),
    ).toBe(true)
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
  })

  it('uses Promise.all for parallel fetching — all repository functions called once', async () => {
    await buildAthleteContext()

    expect(mockGetTodaysCheckin).toHaveBeenCalledTimes(1)
    expect(mockGetRecentCheckins).toHaveBeenCalledTimes(1)
    expect(mockGetAverageReadiness).toHaveBeenCalledTimes(1)
    expect(mockGetRecentSessions).toHaveBeenCalledTimes(1)
    expect(mockGetSessionCountThisWeek).toHaveBeenCalledTimes(1)
    expect(mockGetLastSessionDate).toHaveBeenCalledTimes(1)
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
})
