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
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
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

  it('getProgrammes returns ordered programme rows', async () => {
    const programmes = [makeProgramme()]
    mockChain.order.mockResolvedValue({ data: programmes, error: null })

    const result = await getProgrammes()

    expect(mockChain.order).toHaveBeenCalledWith('start_date', { ascending: false })
    expect(result.data).toEqual(programmes)
    expect(result.error).toBeNull()
  })

  it('getProgrammeById returns a single programme', async () => {
    const programme = makeProgramme()
    mockChain.single.mockResolvedValue({ data: programme, error: null })

    const result = await getProgrammeById('programme-1')

    expect(mockChain.eq).toHaveBeenCalledWith('id', 'programme-1')
    expect(result.data).toEqual(programme)
  })

  it('getActiveProgramme returns the live programme for today', async () => {
    const programme = makeProgramme()
    mockChain.maybeSingle.mockResolvedValue({ data: programme, error: null })

    const result = await getActiveProgramme()

    expect(mockChain.lte).toHaveBeenCalled()
    expect(mockChain.gte).toHaveBeenCalled()
    expect(result.data).toEqual(programme)
  })

  it('createProgramme inserts and returns the created programme', async () => {
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

  it('updateProgramme updates and returns the programme', async () => {
    const updates: ProgrammeUpdate = { notes: 'Updated notes' }
    const programme = makeProgramme({ notes: 'Updated notes' })
    mockChain.single.mockResolvedValue({ data: programme, error: null })

    const result = await updateProgramme('programme-1', updates)

    expect(mockChain.update).toHaveBeenCalledWith(updates)
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'programme-1')
    expect(result.data?.notes).toBe('Updated notes')
  })

  it('deleteProgramme deletes and returns the programme', async () => {
    const programme = makeProgramme()
    mockChain.single.mockResolvedValue({ data: programme, error: null })

    const result = await deleteProgramme('programme-1')

    expect(mockChain.delete).toHaveBeenCalled()
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'programme-1')
    expect(result.data).toEqual(programme)
  })
})