import { createClient } from '@/lib/supabase/server'
import type {
  WeeklyTemplate,
  WeeklyTemplateInsert,
  WeeklyTemplateUpdate,
} from '@/types'
import {
  createWeeklyTemplate,
  deleteWeeklyTemplate,
  getWeeklyTemplateById,
  getWeeklyTemplateByMesocycle,
  updateWeeklyTemplate,
} from './weeklyTemplateRepository'

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
    single: jest.fn().mockResolvedValue(mockResult),
  }
  const mockFrom = jest.fn().mockReturnValue(mockChain)
  return { mockFrom, mockChain }
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

describe('weeklyTemplateRepository', () => {
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']
  const TEST_USER_ID = 'user-1'

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mock.mockFrom })
  })

  it('getWeeklyTemplateByMesocycle returns weekly slots ordered by day_of_week', async () => {
    const templates = [makeWeeklyTemplate()]
    mockChain.order.mockResolvedValue({ data: templates, error: null })

    const result = await getWeeklyTemplateByMesocycle('mesocycle-1', TEST_USER_ID)

    expect(mockChain.eq).toHaveBeenCalledWith('mesocycle_id', 'mesocycle-1')
    expect(mockChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
    expect(mockChain.order).toHaveBeenCalledWith('day_of_week', { ascending: true })
    expect(result.data).toEqual(templates)
  })

  it('createWeeklyTemplate inserts and returns the created template', async () => {
    const input: WeeklyTemplateInsert = {
      day_of_week: 1,
      intensity: 'high',
      mesocycle_id: 'mesocycle-1',
      primary_focus: 'Power',
      session_label: 'Limit Bouldering',
      session_type: 'bouldering',
      user_id: 'user-1',
    }
    const template = makeWeeklyTemplate()
    mockChain.single.mockResolvedValue({ data: template, error: null })

    const result = await createWeeklyTemplate(input)

    expect(mockChain.insert).toHaveBeenCalledWith(input)
    expect(result.data).toEqual(template)
  })

  it('getWeeklyTemplateById returns a single template row', async () => {
    const template = makeWeeklyTemplate()
    mockChain.single.mockResolvedValue({ data: template, error: null })

    const result = await getWeeklyTemplateById('template-1', TEST_USER_ID)

    expect(mockChain.eq).toHaveBeenCalledWith('id', 'template-1')
    expect(mockChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
    expect(result.data).toEqual(template)
  })

  it('updateWeeklyTemplate updates and returns the template', async () => {
    const updates: WeeklyTemplateUpdate = { session_label: 'Fingerboard' }
    const template = makeWeeklyTemplate({ session_label: 'Fingerboard' })
    mockChain.single.mockResolvedValue({ data: template, error: null })

    const result = await updateWeeklyTemplate('template-1', updates, TEST_USER_ID)

    expect(mockChain.update).toHaveBeenCalledWith(updates)
    expect(mockChain.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
    expect(result.data?.session_label).toBe('Fingerboard')
  })
})