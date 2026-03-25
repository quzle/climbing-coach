import { createClient } from '@/lib/supabase/server'
import type { InjuryAreaHealth, ReadinessCheckin, ReadinessCheckinInsert } from '@/types'
import {
  createCheckin,
  getAverageReadiness,
  getReadinessTrend,
  getTodaysCheckin,
  hasCheckedInToday,
} from './readinessRepository'

// =============================================================================
// MODULE MOCK
// =============================================================================

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

// =============================================================================
// MOCK FACTORY
// =============================================================================

/**
 * Returns a fresh chainable Supabase query builder mock.
 * Every method returns `this` so chains like .select().eq().maybeSingle()
 * are supported. Override the terminal methods (single / maybeSingle) per
 * test using mockResolvedValue.
 */
function makeSupabaseMock() {
  const mockResult = { data: null, error: null }
  const mockChain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(mockResult),
    maybeSingle: jest.fn().mockResolvedValue(mockResult),
    then: undefined,
  }
  const mockFrom = jest.fn().mockReturnValue(mockChain)
  return { mockFrom, mockChain }
}

/**
 * Factory for ReadinessCheckin test fixtures.
 * All fields are populated with sensible defaults; pass overrides to
 * customise individual fields without repeating boilerplate in every test.
 */
function makeReadinessCheckin(
  overrides?: Partial<ReadinessCheckin>,
): ReadinessCheckin {
  return {
    id: 'checkin-1',
    date: '2026-03-24',
    sleep_quality: 4,
    fatigue: 2,
    finger_health: 4,
    life_stress: 2,
    illness_flag: false,
    injury_area_health: null,
    readiness_score: 3.8,
    notes: null,
    created_at: '2026-03-24T08:00:00Z',
    ...overrides,
  }
}

/**
 * Valid input payload for createCheckin (excludes readiness_score).
 */
function makeCheckinInput(
  overrides?: Partial<Omit<ReadinessCheckinInsert, 'readiness_score'>>,
): Omit<ReadinessCheckinInsert, 'readiness_score'> {
  return {
    date: '2026-03-24',
    sleep_quality: 4,
    fatigue: 2,
    finger_health: 4,
    life_stress: 2,
    illness_flag: false,
    notes: null,
    ...overrides,
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('calculateReadinessScore (via createCheckin behaviour)', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('computes a higher score for best-case inputs with no injuries', async () => {
    // sleep=5, fatigue=1 (inverted to 5), finger=5, no injuries (defaults to 5),
    // life_stress=1 (inverted to 5).
    // score = 5×0.25 + 5×0.30 + 5×0.20 + 5×0.15 + 5×0.10 = 5.0
    const highReadinessInput = makeCheckinInput({
      sleep_quality: 5,
      fatigue: 1,
      finger_health: 5,
      life_stress: 1,
    })
    const createdRecord = makeReadinessCheckin({ readiness_score: 5.0 })
    mockChain.single.mockResolvedValue({ data: createdRecord, error: null })

    await createCheckin(highReadinessInput, [])

    const insertPayload = mockChain.insert.mock.calls[0]?.[0] as
      | (Omit<ReadinessCheckinInsert, 'readiness_score'> & {
          readiness_score: number
        })
      | undefined
    expect(insertPayload?.readiness_score).toBeCloseTo(5.0, 1)
  })

  it('computes a lower score for worst-case inputs with a critical injury area', async () => {
    // sleep=1, fatigue=5 (inverted to 1), finger=1, generalInjuryHealth=1, life_stress=5 (inverted to 1).
    // score = 1×0.25 + 1×0.30 + 1×0.20 + 1×0.15 + 1×0.10 = 1.0
    const lowReadinessInput = makeCheckinInput({
      sleep_quality: 1,
      fatigue: 5,
      finger_health: 1,
      life_stress: 5,
    })
    const criticalInjuryArea: InjuryAreaHealth = {
      area: 'shoulder_left',
      health: 1,
      notes: null,
    }
    const createdRecord = makeReadinessCheckin({ readiness_score: 1.0 })
    mockChain.single.mockResolvedValue({ data: createdRecord, error: null })

    await createCheckin(lowReadinessInput, [criticalInjuryArea])

    const insertPayload = mockChain.insert.mock.calls[0]?.[0] as
      | (Omit<ReadinessCheckinInsert, 'readiness_score'> & {
          readiness_score: number
        })
      | undefined
    expect(insertPayload?.readiness_score).toBeCloseTo(1.0, 1)
  })

  it('uses the minimum health across multiple injury areas for generalInjuryHealth', async () => {
    // Two injuries: shoulder=4, finger=2 → generalInjuryHealth = 2
    // All other inputs at 3.
    // score = 3×0.25 + (6-3)×0.30 + 3×0.20 + 2×0.15 + (6-3)×0.10 = 2.85
    const input = makeCheckinInput({
      sleep_quality: 3,
      fatigue: 3,
      finger_health: 3,
      life_stress: 3,
    })
    const injuryAreas: InjuryAreaHealth[] = [
      { area: 'shoulder_left', health: 4, notes: null },
      { area: 'finger_a2_right', health: 2, notes: null },
    ]
    const createdRecord = makeReadinessCheckin({ readiness_score: 2.85 })
    mockChain.single.mockResolvedValue({ data: createdRecord, error: null })

    await createCheckin(input, injuryAreas)

    const insertPayload = mockChain.insert.mock.calls[0]?.[0] as
      | { readiness_score: number }
      | undefined
    expect(insertPayload?.readiness_score).toBeCloseTo(2.85, 2)
  })

  it('defaults generalInjuryHealth to 5 when no injury areas are tracked', async () => {
    // With no injuries and all inputs at 3:
    // score = 3×0.25 + (6-3)×0.30 + 3×0.20 + 5×0.15 + (6-3)×0.10 = 3.15
    // Compare to one area at health=3:
    // score = 3×0.25 + (6-3)×0.30 + 3×0.20 + 3×0.15 + (6-3)×0.10 = 2.85
    // The no-injury score should be higher.
    const input = makeCheckinInput({
      sleep_quality: 3,
      fatigue: 3,
      finger_health: 3,
      life_stress: 3,
    })
    const createdRecord = makeReadinessCheckin()
    mockChain.single.mockResolvedValue({ data: createdRecord, error: null })

    await createCheckin(input, []) // no injuries
    const noInjuryScore = (mockChain.insert.mock.calls[0]?.[0] as { readiness_score: number }).readiness_score

    mockChain.insert.mockClear()

    await createCheckin(input, [{ area: 'shoulder_left', health: 3, notes: null }])
    const withInjuryScore = (mockChain.insert.mock.calls[0]?.[0] as { readiness_score: number }).readiness_score

    expect(noInjuryScore).toBeGreaterThan(withInjuryScore)
  })

  it('weights fatigue more heavily than generalInjuryHealth', async () => {
    // Base: all metrics at 3, one injury at health=3.
    // Improving fatigue by 2: delta = 2 × 0.30 = 0.60
    // Improving injury health by 2 (3→5): delta = 2 × 0.15 = 0.30
    // Fatigue change must produce a larger score delta.

    const baseInput = makeCheckinInput({
      sleep_quality: 3,
      fatigue: 3,
      finger_health: 3,
      life_stress: 3,
    })
    const baseInjury: InjuryAreaHealth[] = [
      { area: 'shoulder_left', health: 3, notes: null },
    ]
    const betterFatigueInput = makeCheckinInput({
      sleep_quality: 3,
      fatigue: 1, // improved by 2
      finger_health: 3,
      life_stress: 3,
    })
    const betterInjuryHealth: InjuryAreaHealth[] = [
      { area: 'shoulder_left', health: 5, notes: null }, // improved by 2
    ]

    const record = makeReadinessCheckin()
    mockChain.single.mockResolvedValue({ data: record, error: null })

    await createCheckin(baseInput, baseInjury)
    const baseScore = (mockChain.insert.mock.calls[0]?.[0] as { readiness_score: number }).readiness_score

    mockChain.insert.mockClear()
    await createCheckin(betterFatigueInput, baseInjury)
    const fatigueScore = (mockChain.insert.mock.calls[0]?.[0] as { readiness_score: number }).readiness_score

    mockChain.insert.mockClear()
    await createCheckin(baseInput, betterInjuryHealth)
    const injuryScore = (mockChain.insert.mock.calls[0]?.[0] as { readiness_score: number }).readiness_score

    expect(fatigueScore - baseScore).toBeGreaterThan(injuryScore - baseScore)
  })
})

describe('getTodaysCheckin', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('returns null data when no check-in exists today', async () => {
    // maybeSingle returns null data when the row does not exist — not an error.
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await getTodaysCheckin()

    expect(result.data).toBeNull()
    expect(result.error).toBeNull()
  })

  it('returns the check-in when one exists today', async () => {
    const fakeCheckin = makeReadinessCheckin({ date: '2026-03-24' })
    mockChain.maybeSingle.mockResolvedValue({ data: fakeCheckin, error: null })

    const result = await getTodaysCheckin()

    expect(result.data).toEqual(fakeCheckin)
    expect(result.error).toBeNull()
  })

  it('returns an error string when the database query fails', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    })

    const result = await getTodaysCheckin()

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(typeof result.error).toBe('string')
  })
})

describe('createCheckin', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('inserts a check-in with a computed readiness_score', async () => {
    const input = makeCheckinInput()
    const createdRecord = makeReadinessCheckin()
    mockChain.single.mockResolvedValue({ data: createdRecord, error: null })

    const result = await createCheckin(input)

    // insert must have been called exactly once
    expect(mockChain.insert).toHaveBeenCalledTimes(1)

    // The payload passed to insert must include a computed readiness_score
    const insertPayload = mockChain.insert.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(insertPayload).toHaveProperty('readiness_score')
    expect(typeof insertPayload['readiness_score']).toBe('number')

    expect(result.data).toEqual(createdRecord)
    expect(result.error).toBeNull()
  })

  it('returns an error string when the insert fails', async () => {
    mockChain.single.mockResolvedValue({
      data: null,
      error: { message: 'Insert failed' },
    })

    const result = await createCheckin(makeCheckinInput())

    expect(result.data).toBeNull()
    expect(result.error).not.toBeNull()
    expect(typeof result.error).toBe('string')
  })

  it('maps duplicate-date insert failures to the already checked-in message', async () => {
    mockChain.single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    const result = await createCheckin(makeCheckinInput())

    expect(result.data).toBeNull()
    expect(result.error).toBe(
      'Already checked in today. Only one check-in per day is allowed.',
    )
  })
})

describe('hasCheckedInToday', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('returns true when a check-in exists for today', async () => {
    // maybeSingle returns a row (even just the id field) when a record exists
    mockChain.maybeSingle.mockResolvedValue({
      data: { id: 'checkin-1' },
      error: null,
    })

    const result = await hasCheckedInToday()

    expect(result.data).toBe(true)
    expect(result.error).toBeNull()
  })

  it('returns false when no check-in exists for today', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await hasCheckedInToday()

    expect(result.data).toBe(false)
    expect(result.error).toBeNull()
  })
})

describe('getAverageReadiness', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('returns 0 when no check-ins exist in the period', async () => {
    // The query resolves successfully but with an empty array
    mockChain.lte.mockResolvedValue({ data: [], error: null })

    const result = await getAverageReadiness(7)

    expect(result.data).toBe(0)
    expect(result.error).toBeNull()
  })

  it('correctly averages readiness_score values', async () => {
    mockChain.lte.mockResolvedValue({
      data: [{ readiness_score: 3.0 }, { readiness_score: 4.0 }],
      error: null,
    })

    const result = await getAverageReadiness(7)

    expect(result.data).toBe(3.5)
    expect(result.error).toBeNull()
  })

  it('ignores null readiness_score values when averaging', async () => {
    // A row with a null score should not affect the average
    mockChain.lte.mockResolvedValue({
      data: [
        { readiness_score: 4.0 },
        { readiness_score: null },
        { readiness_score: 2.0 },
      ],
      error: null,
    })

    const result = await getAverageReadiness(7)

    expect(result.data).toBe(3.0)
    expect(result.error).toBeNull()
  })
})

describe('getReadinessTrend', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('returns an empty array when no data exists', async () => {
    mockChain.order.mockResolvedValue({ data: [], error: null })

    const result = await getReadinessTrend(7)

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('maps rows to { date, score } shape', async () => {
    mockChain.order.mockResolvedValue({
      data: [
        { date: '2026-03-22', readiness_score: 3.5 },
        { date: '2026-03-23', readiness_score: 4.0 },
        { date: '2026-03-24', readiness_score: 3.8 },
      ],
      error: null,
    })

    const result = await getReadinessTrend(3)

    expect(result.data).toEqual([
      { date: '2026-03-22', score: 3.5 },
      { date: '2026-03-23', score: 4.0 },
      { date: '2026-03-24', score: 3.8 },
    ])
  })

  it('returns data ordered oldest first (ascending by date)', async () => {
    // The repository calls .order('date', { ascending: true }) —
    // this test confirms the order argument was passed correctly.
    mockChain.order.mockResolvedValue({
      data: [
        { date: '2026-03-22', readiness_score: 3.0 },
        { date: '2026-03-24', readiness_score: 4.5 },
      ],
      error: null,
    })

    const result = await getReadinessTrend(7)

    // Verify ascending order in the returned data
    const dates = result.data?.map((d) => d.date) ?? []
    expect(dates).toEqual([...dates].sort())

    // Verify the order call was made with ascending: true
    expect(mockChain.order).toHaveBeenCalledWith('date', { ascending: true })
  })

  it('excludes rows where readiness_score is null', async () => {
    mockChain.order.mockResolvedValue({
      data: [
        { date: '2026-03-22', readiness_score: 3.0 },
        { date: '2026-03-23', readiness_score: null },
        { date: '2026-03-24', readiness_score: 4.0 },
      ],
      error: null,
    })

    const result = await getReadinessTrend(3)

    expect(result.data).toHaveLength(2)
    expect(result.data?.every((d) => d.score !== null)).toBe(true)
  })
})
