import { createClient } from '@/lib/supabase/server'
import type { Mesocycle, MesocycleInsert, MesocycleUpdate } from '@/types'
import {
  createMesocycle,
  getActiveMesocycle,
  getMesocycleById,
  getMesocyclesByProgramme,
  updateMesocycle,
} from './mesocycleRepository'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

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
    single: jest.fn().mockResolvedValue(mockResult),
    maybeSingle: jest.fn().mockResolvedValue(mockResult),
  }
  const mockFrom = jest.fn().mockReturnValue(mockChain)
  return { mockFrom, mockChain }
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
    ...overrides,
  }
}

describe('mesocycleRepository', () => {
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mock.mockFrom })
  })

  it('getMesocyclesByProgramme returns ordered mesocycle rows', async () => {
    const mesocycles = [makeMesocycle()]
    mockChain.order.mockResolvedValue({ data: mesocycles, error: null })

    const result = await getMesocyclesByProgramme('programme-1')

    expect(mockChain.eq).toHaveBeenCalledWith('programme_id', 'programme-1')
    expect(result.data).toEqual(mesocycles)
  })

  it('getActiveMesocycle returns the active block', async () => {
    const mesocycle = makeMesocycle()
    mockChain.maybeSingle.mockResolvedValue({ data: mesocycle, error: null })

    const result = await getActiveMesocycle()

    expect(mockChain.lte).toHaveBeenCalled()
    expect(mockChain.gte).toHaveBeenCalled()
    expect(result.data).toEqual(mesocycle)
  })

  it('getMesocycleById returns a single mesocycle', async () => {
    const mesocycle = makeMesocycle()
    mockChain.single.mockResolvedValue({ data: mesocycle, error: null })

    const result = await getMesocycleById('mesocycle-1')

    expect(mockChain.eq).toHaveBeenCalledWith('id', 'mesocycle-1')
    expect(result.data).toEqual(mesocycle)
  })

  it('createMesocycle inserts and returns the created mesocycle', async () => {
    const input: MesocycleInsert = {
      focus: 'Power and finger strength',
      name: 'Power Block',
      phase_type: 'power',
      planned_end: '2026-03-30',
      planned_start: '2026-03-03',
      programme_id: 'programme-1',
    }
    const mesocycle = makeMesocycle()
    mockChain.single.mockResolvedValue({ data: mesocycle, error: null })

    const result = await createMesocycle(input)

    expect(mockChain.insert).toHaveBeenCalledWith(input)
    expect(result.data).toEqual(mesocycle)
  })

  it('updateMesocycle updates and returns the mesocycle', async () => {
    const updates: MesocycleUpdate = { status: 'completed' }
    const mesocycle = makeMesocycle({ status: 'completed' })
    mockChain.single.mockResolvedValue({ data: mesocycle, error: null })

    const result = await updateMesocycle('mesocycle-1', updates)

    expect(mockChain.update).toHaveBeenCalledWith(updates)
    expect(result.data?.status).toBe('completed')
  })
})