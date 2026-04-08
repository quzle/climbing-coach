import { createClient } from '@/lib/supabase/server'
import type { Programme, ProgrammeInsert, ProgrammeUpdate } from '@/types'
import {
  createProgramme,
  deleteProgramme,
  getActiveProgramme,
  getProgrammeById,
  getProgrammes,
  updateProgramme,
} from './programmeRepository'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

function makeSupabaseMock() {
  const mockResult = { data: null, error: null }
  const mockChain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(mockResult),
    maybeSingle: jest.fn().mockResolvedValue(mockResult),
  }
  const mockFrom = jest.fn().mockReturnValue(mockChain)
  return { mockFrom, mockChain }
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
    status: 'active',
    athlete_profile: null,
    user_id: 'user-1',
    ...overrides,
  }
}

describe('programmeRepository', () => {
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mock.mockFrom })
  })

  describe('getProgrammes', () => {
    it('scopes programmes by user_id and returns ordered results', async () => {
      const userId = 'user-1'
      const programmes = [makeProgramme()]
      mockChain.order.mockResolvedValue({ data: programmes, error: null })

      const result = await getProgrammes(userId)

      expect(mockChain.eq).toHaveBeenCalledWith('user_id', userId)
      expect(mockChain.order).toHaveBeenCalledWith('start_date', { ascending: false })
      expect(result.data).toEqual(programmes)
      expect(result.error).toBeNull()
    })

    it('returns empty array when no programmes found', async () => {
      mockChain.order.mockResolvedValue({ data: [], error: null })

      const result = await getProgrammes('user-1')

      expect(result.data).toEqual([])
      expect(result.error).toBeNull()
    })

    it('returns error when query fails', async () => {
      const queryError = new Error('Database error')
      mockChain.order.mockResolvedValue({ data: null, error: queryError })

      const result = await getProgrammes('user-1')

      expect(result.data).toBeNull()
      expect(result.error).toBe('Failed to fetch programmes')
    })
  })

  describe('getProgrammeById', () => {
    it('scopes programme by both id and user_id', async () => {
      const userId = 'user-1'
      const programme = makeProgramme()
      mockChain.single.mockResolvedValue({ data: programme, error: null })

      const result = await getProgrammeById('programme-1', userId)

      expect(mockChain.eq).toHaveBeenCalledWith('id', 'programme-1')
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', userId)
      expect(result.data).toEqual(programme)
    })

    it('returns error when programme not found', async () => {
      const queryError = new Error('Not found')
      mockChain.single.mockResolvedValue({ data: null, error: queryError })

      const result = await getProgrammeById('programme-1', 'user-1')

      expect(result.data).toBeNull()
      expect(result.error).toBe('Failed to fetch programme')
    })
  })

  describe('getActiveProgramme', () => {
    it('scopes active programme by user_id', async () => {
      const userId = 'user-1'
      const programme = makeProgramme()
      mockChain.maybeSingle.mockResolvedValue({ data: programme, error: null })

      const result = await getActiveProgramme(userId)

      const eqCalls = (mockChain.eq as jest.Mock).mock.calls
      expect(eqCalls).toContainEqual(['user_id', userId])
      expect(eqCalls).toContainEqual(['status', 'active'])
      expect(result.data).toEqual(programme)
    })

    it('returns null when no active programme exists', async () => {
      mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })

      const result = await getActiveProgramme('user-1')

      expect(result.data).toBeNull()
      expect(result.error).toBeNull()
    })

    it('returns error when query fails', async () => {
      const queryError = new Error('Database error')
      mockChain.maybeSingle.mockResolvedValue({ data: null, error: queryError })

      const result = await getActiveProgramme('user-1')

      expect(result.data).toBeNull()
      expect(result.error).toBe('Failed to fetch active programme')
    })
  })

  describe('createProgramme', () => {
    it('creates programme with user_id in payload', async () => {
      const input: ProgrammeInsert = {
        goal: 'Consistent 7b onsight',
        name: 'Summer Multipitch Season',
        start_date: '2026-01-05',
        target_date: '2026-04-26',
        user_id: 'user-1',
      }
      const programme = makeProgramme()
      mockChain.single.mockResolvedValue({ data: programme, error: null })

      const result = await createProgramme(input)

      expect(mockChain.insert).toHaveBeenCalledWith(input)
      expect(result.data).toEqual(programme)
    })

    it('returns error when insert fails', async () => {
      const input: ProgrammeInsert = {
        goal: 'Test',
        name: 'Test',
        start_date: '2026-01-05',
        target_date: '2026-04-26',
        user_id: 'user-1',
      }
      const insertError = new Error('Insert failed')
      mockChain.single.mockResolvedValue({ data: null, error: insertError })

      const result = await createProgramme(input)

      expect(result.data).toBeNull()
      expect(result.error).toBe('Failed to create programme')
    })
  })

  describe('updateProgramme', () => {
    it('scopes update by both id and user_id', async () => {
      const userId = 'user-1'
      const updates: ProgrammeUpdate = { notes: 'Updated notes' }
      const programme = makeProgramme({ notes: 'Updated notes' })
      mockChain.single.mockResolvedValue({ data: programme, error: null })

      const result = await updateProgramme('programme-1', updates, userId)

      expect(mockChain.update).toHaveBeenCalledWith(updates)
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'programme-1')
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', userId)
      expect(result.data?.notes).toBe('Updated notes')
    })

    it('returns error when update fails', async () => {
      const updateError = new Error('Update failed')
      mockChain.single.mockResolvedValue({ data: null, error: updateError })

      const result = await updateProgramme('programme-1', { notes: 'Test' }, 'user-1')

      expect(result.data).toBeNull()
      expect(result.error).toBe('Failed to update programme')
    })
  })

  describe('deleteProgramme', () => {
    it('scopes delete by both id and user_id', async () => {
      const userId = 'user-1'
      const programme = makeProgramme()
      mockChain.single.mockResolvedValue({ data: programme, error: null })

      const result = await deleteProgramme('programme-1', userId)

      expect(mockChain.delete).toHaveBeenCalled()
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'programme-1')
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', userId)
      expect(result.data).toEqual(programme)
    })

    it('returns error when delete fails', async () => {
      const deleteError = new Error('Delete failed')
      mockChain.single.mockResolvedValue({ data: null, error: deleteError })

      const result = await deleteProgramme('programme-1', 'user-1')

      expect(result.data).toBeNull()
      expect(result.error).toBe('Failed to delete programme')
    })
  })
})