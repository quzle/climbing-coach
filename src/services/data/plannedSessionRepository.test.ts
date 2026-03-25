import { createClient } from '@/lib/supabase/server'
import type {
  PlannedSession,
  PlannedSessionInsert,
  PlannedSessionUpdate,
} from '@/types'
import {
  createPlannedSession,
  getPlannedSessionById,
  getPlannedSessionsInRange,
  getUpcomingPlannedSessions,
  updatePlannedSession,
} from './plannedSessionRepository'

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
  }
  const mockFrom = jest.fn().mockReturnValue(mockChain)
  return { mockFrom, mockChain }
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
    ...overrides,
  }
}

describe('plannedSessionRepository', () => {
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mock.mockFrom })
  })

  it('getPlannedSessionsInRange returns planned sessions ordered by date', async () => {
    const sessions = [makePlannedSession()]
    mockChain.order.mockResolvedValue({ data: sessions, error: null })

    const result = await getPlannedSessionsInRange('2026-03-25', '2026-03-31')

    expect(mockChain.gte).toHaveBeenCalledWith('planned_date', '2026-03-25')
    expect(mockChain.lte).toHaveBeenCalledWith('planned_date', '2026-03-31')
    expect(result.data).toEqual(sessions)
  })

  it('getUpcomingPlannedSessions fetches future sessions using a date range', async () => {
    const sessions = [makePlannedSession()]
    mockChain.order.mockResolvedValue({ data: sessions, error: null })

    const result = await getUpcomingPlannedSessions(7)

    expect(mockChain.gte).toHaveBeenCalled()
    expect(mockChain.lte).toHaveBeenCalled()
    expect(result.data).toEqual(sessions)
  })

  it('getPlannedSessionById returns a single planned session', async () => {
    const session = makePlannedSession()
    mockChain.single.mockResolvedValue({ data: session, error: null })

    const result = await getPlannedSessionById('planned-session-1')

    expect(mockChain.eq).toHaveBeenCalledWith('id', 'planned-session-1')
    expect(result.data).toEqual(session)
  })

  it('createPlannedSession inserts and returns the created row', async () => {
    const input: PlannedSessionInsert = {
      mesocycle_id: 'mesocycle-1',
      planned_date: '2026-03-26',
      session_type: 'bouldering',
      template_id: 'template-1',
    }
    const session = makePlannedSession()
    mockChain.single.mockResolvedValue({ data: session, error: null })

    const result = await createPlannedSession(input)

    expect(mockChain.insert).toHaveBeenCalledWith(input)
    expect(result.data).toEqual(session)
  })

  it('updatePlannedSession updates and returns the row', async () => {
    const updates: PlannedSessionUpdate = { status: 'completed' }
    const session = makePlannedSession({ status: 'completed' })
    mockChain.single.mockResolvedValue({ data: session, error: null })

    const result = await updatePlannedSession('planned-session-1', updates)

    expect(mockChain.update).toHaveBeenCalledWith(updates)
    expect(result.data?.status).toBe('completed')
  })
})