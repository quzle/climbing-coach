import { createClient } from '@/lib/supabase/server'
import type { InjuryAreaRow } from '@/types'
import {
  addInjuryArea,
  archiveInjuryArea,
  getActiveInjuryAreas,
} from './injuryAreasRepository'

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
 * Terminal methods (single, maybeSingle) default to resolving with null data.
 */
function makeSupabaseMock() {
  const mockChain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: undefined,
  }
  const mockFrom = jest.fn().mockReturnValue(mockChain)
  return { mockFrom, mockChain }
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

// =============================================================================
// TESTS
// =============================================================================

describe('getActiveInjuryAreas', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('returns active injury areas ordered by added_at ascending', async () => {
    const areas = [
      makeInjuryAreaRow({ area: 'shoulder_left' }),
      makeInjuryAreaRow({ id: 'area-uuid-2', area: 'finger_a2_right' }),
    ]
    mockChain.order.mockResolvedValue({ data: areas, error: null })

    const result = await getActiveInjuryAreas()

    expect(result.data).toEqual(areas)
    expect(result.error).toBeNull()
    expect(mockFrom).toHaveBeenCalledWith('injury_areas')
    expect(mockChain.eq).toHaveBeenCalledWith('is_active', true)
    expect(mockChain.order).toHaveBeenCalledWith('added_at', {
      ascending: true,
    })
  })

  it('returns an empty array when no injury areas are tracked', async () => {
    mockChain.order.mockResolvedValue({ data: [], error: null })

    const result = await getActiveInjuryAreas()

    expect(result.data).toEqual([])
    expect(result.error).toBeNull()
  })

  it('returns an error string when the database query fails', async () => {
    mockChain.order.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    })

    const result = await getActiveInjuryAreas()

    expect(result.data).toBeNull()
    expect(result.error).toBe('Failed to fetch injury areas')
  })

  it('returns an error string when createClient throws', async () => {
    ;(createClient as jest.Mock).mockRejectedValue(new Error('connect failed'))

    const result = await getActiveInjuryAreas()

    expect(result.data).toBeNull()
    expect(result.error).toBe('An unexpected error occurred')
  })
})

describe('addInjuryArea', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('upserts the area and returns the created record', async () => {
    const newArea = makeInjuryAreaRow({ area: 'shoulder_left' })
    mockChain.single.mockResolvedValue({ data: newArea, error: null })

    const result = await addInjuryArea('shoulder_left')

    expect(result.data).toEqual(newArea)
    expect(result.error).toBeNull()
    expect(mockFrom).toHaveBeenCalledWith('injury_areas')
    expect(mockChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ area: 'shoulder_left', is_active: true }),
      { onConflict: 'area' },
    )
  })

  it('reactivates a previously archived area via upsert', async () => {
    const reactivated = makeInjuryAreaRow({
      area: 'finger_a2_right',
      is_active: true,
      archived_at: null,
    })
    mockChain.single.mockResolvedValue({ data: reactivated, error: null })

    const result = await addInjuryArea('finger_a2_right')

    expect(result.data?.is_active).toBe(true)
    expect(result.data?.archived_at).toBeNull()
  })

  it('returns an error string when the upsert fails', async () => {
    mockChain.single.mockResolvedValue({
      data: null,
      error: { message: 'unique violation' },
    })

    const result = await addInjuryArea('shoulder_left')

    expect(result.data).toBeNull()
    expect(result.error).toBe('Failed to add injury area')
  })
})

describe('archiveInjuryArea', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('sets is_active to false and records archived_at', async () => {
    const archived = makeInjuryAreaRow({
      area: 'shoulder_left',
      is_active: false,
      archived_at: '2026-03-25T12:00:00Z',
    })
    mockChain.single.mockResolvedValue({ data: archived, error: null })

    const result = await archiveInjuryArea('shoulder_left')

    expect(result.data?.is_active).toBe(false)
    expect(result.data?.archived_at).not.toBeNull()
    expect(result.error).toBeNull()
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false }),
    )
    expect(mockChain.eq).toHaveBeenCalledWith('area', 'shoulder_left')
  })

  it('returns an error string when the update fails', async () => {
    mockChain.single.mockResolvedValue({
      data: null,
      error: { message: 'not found' },
    })

    const result = await archiveInjuryArea('shoulder_left')

    expect(result.data).toBeNull()
    expect(result.error).toBe('Failed to archive injury area')
  })

  it('returns an error string when createClient throws', async () => {
    ;(createClient as jest.Mock).mockRejectedValue(new Error('connect failed'))

    const result = await archiveInjuryArea('shoulder_left')

    expect(result.data).toBeNull()
    expect(result.error).toBe('An unexpected error occurred')
  })
})
