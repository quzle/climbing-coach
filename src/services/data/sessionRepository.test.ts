import { createClient } from '@/lib/supabase/server'
import type { BoulderingLogData, SessionLog, SessionLogInsert } from '@/types'
import type { Json } from '@/lib/database.types'
import {
  createSession,
  getGradeProgressionData,
  getLastSessionDate,
  getRecentSessions,
  getSessionById,
  getSessionCountThisWeek,
  updateSessionDeviation,
} from './sessionRepository'

// =============================================================================
// MODULE MOCK
// =============================================================================

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

// =============================================================================
// SHARED MOCK CHAIN
// =============================================================================

// A single shared mockChain is used across all tests. The beforeEach resets
// every method's implementation so that tests which override a chain link to
// be the terminal (e.g. lte for getSessionCountThisWeek) do not bleed into
// unrelated tests that expect that same link to chain onward.
const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
}

beforeEach(() => {
  jest.clearAllMocks()
  // Re-apply all chain implementations so previous tests' overrides don't bleed
  // into subsequent tests. clearAllMocks() clears call records but not implementations.
  mockChain.select.mockReturnThis()
  mockChain.insert.mockReturnThis()
  mockChain.update.mockReturnThis()
  mockChain.eq.mockReturnThis()
  mockChain.in.mockReturnThis()
  mockChain.gte.mockReturnThis()
  mockChain.lte.mockReturnThis()
  mockChain.order.mockReturnThis()
  mockChain.limit.mockReturnThis()
  mockChain.single.mockResolvedValue({ data: null, error: null })
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })
  ;(createClient as jest.Mock).mockResolvedValue({
    from: jest.fn().mockReturnValue(mockChain),
  })
})

// =============================================================================
// FACTORIES
// =============================================================================

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
    ...overrides,
  }
}

/**
 * Returns a BoulderingLogData fixture.
 * Default includes one 'send' at 6c and one 'multiple_attempts' at 7a,
 * so extractBestGrade should return '6c'.
 */
function makeBoulderingLogData(
  overrides?: Partial<BoulderingLogData>,
): BoulderingLogData {
  return {
    location_type: 'gym',
    attempts: [
      {
        grade: '6c',
        style: 'overhang',
        hold_type: 'crimp',
        result: 'send',
        attempt_number: 1,
      },
      {
        grade: '7a',
        style: 'overhang',
        hold_type: 'sloper',
        result: 'multiple_attempts',
        attempt_number: 5,
        notes: 'crux long move to sloper',
      },
    ],
    ...overrides,
  }
}

/** Computes Monday of the current calendar week as 'YYYY-MM-DD'. */
function getMondayOfCurrentWeek(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  return monday.toISOString().split('T')[0]!
}

// =============================================================================
// TESTS
// =============================================================================

describe('getRecentSessions', () => {
  it('returns sessions ordered by date descending', async () => {
    const session1 = makeSessionLog({ date: '2025-03-24' })
    const session2 = makeSessionLog({ id: 'session-2', date: '2025-03-22' })
    // order is the terminal for getRecentSessions
    mockChain.order.mockResolvedValue({ data: [session1, session2], error: null })

    const result = await getRecentSessions(7)

    expect(mockChain.order).toHaveBeenCalledWith('date', { ascending: false })
    expect(result.data).toEqual([session1, session2])
    expect(result.error).toBeNull()
  })

  it('returns empty array when no sessions exist', async () => {
    mockChain.order.mockResolvedValue({ data: [], error: null })

    const result = await getRecentSessions(7)

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('returns error string when query fails', async () => {
    mockChain.order.mockResolvedValue({ data: null, error: { message: 'DB error' } })

    const result = await getRecentSessions(7)

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(typeof result.error).toBe('string')
  })
})

describe('getSessionById', () => {
  it('returns the session when found', async () => {
    const fakeSession = makeSessionLog()
    mockChain.single.mockResolvedValue({ data: fakeSession, error: null })

    const result = await getSessionById('test-session-uuid')

    expect(result.data).toEqual(fakeSession)
    expect(result.error).toBeNull()
  })

  it('returns error string when session is not found', async () => {
    mockChain.single.mockResolvedValue({ data: null, error: { message: 'No rows' } })

    const result = await getSessionById('nonexistent-id')

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(typeof result.error).toBe('string')
  })
})

describe('createSession', () => {
  const validInput: SessionLogInsert = {
    date: '2025-03-24',
    session_type: 'bouldering',
    location: 'Boulder World Geneva',
    duration_mins: 90,
    rpe: 7,
  }

  it('calls insert and returns the created session', async () => {
    const fakeSession = makeSessionLog()
    mockChain.single.mockResolvedValue({ data: fakeSession, error: null })

    const result = await createSession(validInput)

    expect(mockChain.insert).toHaveBeenCalledTimes(1)
    expect(result.data).toEqual(fakeSession)
    expect(result.error).toBeNull()
  })

  it('accepts injury_flags as a jsonb array of area names', async () => {
    const inputWithFlags: SessionLogInsert = {
      ...validInput,
      injury_flags: ['shoulder_left', 'finger_a2_right'] as unknown as import('@/lib/database.types').Json,
    }
    const sessionWithFlags = makeSessionLog({
      injury_flags: ['shoulder_left', 'finger_a2_right'] as unknown as import('@/lib/database.types').Json,
    })
    mockChain.single.mockResolvedValue({ data: sessionWithFlags, error: null })

    const result = await createSession(inputWithFlags)

    expect(mockChain.insert).toHaveBeenCalledTimes(1)
    const insertArg = mockChain.insert.mock.calls[0]?.[0] as SessionLogInsert
    expect(insertArg.injury_flags).toEqual(['shoulder_left', 'finger_a2_right'])
    expect(result.data?.injury_flags).toEqual(['shoulder_left', 'finger_a2_right'])
    expect(result.error).toBeNull()
  })

  it('returns error string when insert fails', async () => {
    mockChain.single.mockResolvedValue({
      data: null,
      error: { message: 'Insert failed' },
    })

    const result = await createSession(validInput)

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(typeof result.error).toBe('string')
  })
})

describe('updateSessionDeviation', () => {
  it('calls update with the deviation text and returns the updated session', async () => {
    const deviationText = 'Ran 20 minutes shorter than planned'
    const updatedSession = makeSessionLog({ deviation_from_plan: deviationText })
    mockChain.single.mockResolvedValue({ data: updatedSession, error: null })

    const result = await updateSessionDeviation('test-session-uuid', deviationText)

    expect(mockChain.update).toHaveBeenCalledTimes(1)
    expect(result.data?.deviation_from_plan).toBe(deviationText)
    expect(result.error).toBeNull()
  })

  it('returns error string when update fails', async () => {
    mockChain.single.mockResolvedValue({
      data: null,
      error: { message: 'Update failed' },
    })

    const result = await updateSessionDeviation('test-session-uuid', 'some deviation')

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(typeof result.error).toBe('string')
  })
})

describe('getSessionCountThisWeek', () => {
  // lte is the terminal for this function — no .order() follows it
  it('returns count of sessions logged this week', async () => {
    const sessions = [
      makeSessionLog({ id: '1' }),
      makeSessionLog({ id: '2' }),
      makeSessionLog({ id: '3' }),
    ]
    mockChain.lte.mockResolvedValue({ data: sessions, error: null })

    const result = await getSessionCountThisWeek()

    expect(result.data).toBe(3)
    expect(result.error).toBeNull()
  })

  it('returns 0 when no sessions exist this week', async () => {
    mockChain.lte.mockResolvedValue({ data: [], error: null })

    const result = await getSessionCountThisWeek()

    expect(result.data).toBe(0)
    expect(result.error).toBeNull()
  })

  it('uses Monday of the current week as the start date', async () => {
    mockChain.lte.mockResolvedValue({ data: [], error: null })

    await getSessionCountThisWeek()

    const expectedMonday = getMondayOfCurrentWeek()
    // .gte is called with ('date', <monday>) before .lte is called
    expect(mockChain.gte).toHaveBeenCalledWith('date', expectedMonday)
  })
})

describe('getLastSessionDate', () => {
  it('returns the date of the most recent session', async () => {
    const recentSession = makeSessionLog({ date: '2025-03-20' })
    mockChain.maybeSingle.mockResolvedValue({ data: recentSession, error: null })

    const result = await getLastSessionDate()

    expect(result.data).toBe('2025-03-20')
    expect(result.error).toBeNull()
  })

  it('returns null when no sessions have been logged', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await getLastSessionDate()

    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })
})

describe('getGradeProgressionData', () => {
  it('extracts best grade from sessions with completed attempts', async () => {
    // The default makeBoulderingLogData() has a 'send' at 6c and
    // 'multiple_attempts' at 7a. Only the send counts → best grade = '6c'.
    const sessionWithGrades = makeSessionLog({
      date: '2025-03-24',
      session_type: 'bouldering',
      log_data: makeBoulderingLogData() as unknown as Json,
    })
    mockChain.order.mockResolvedValue({ data: [sessionWithGrades], error: null })

    const result = await getGradeProgressionData()

    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]?.best_grade).toBe('6c')
  })

  it('excludes sessions where no attempt was completed', async () => {
    // All attempts are 'multiple_attempts' or 'project' — no sends or flashes
    const projectOnlyLogData = makeBoulderingLogData({
      attempts: [
        {
          grade: '7b',
          style: 'overhang',
          hold_type: 'crimp',
          result: 'multiple_attempts',
        },
        {
          grade: '7a+',
          style: 'slab',
          hold_type: 'sloper',
          result: 'project',
        },
      ],
    })
    const sessionNoSends = makeSessionLog({
      session_type: 'bouldering',
      log_data: projectOnlyLogData as unknown as Json,
    })
    mockChain.order.mockResolvedValue({ data: [sessionNoSends], error: null })

    const result = await getGradeProgressionData()

    expect(result.error).toBeNull()
    // No completed attempts → nothing to chart
    expect(result.data).toEqual([])
  })

  it('filters to climbing session types only using .in()', async () => {
    mockChain.order.mockResolvedValue({ data: [], error: null })

    await getGradeProgressionData()

    expect(mockChain.in).toHaveBeenCalledWith('session_type', [
      'bouldering',
      'kilterboard',
      'lead',
    ])
  })

  it('returns empty array when no climbing sessions exist', async () => {
    mockChain.order.mockResolvedValue({ data: [], error: null })

    const result = await getGradeProgressionData()

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })
})

