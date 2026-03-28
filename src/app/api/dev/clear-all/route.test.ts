/**
 * @jest-environment node
 */
import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

const mockCreateClient = createClient as jest.Mock

function makeMockSupabase(
  deleteResult: { data: { id: string }[] | null; error: null | { message: string } },
) {
  const mockSelect = jest.fn().mockResolvedValue(deleteResult)
  const mockNeq = jest.fn().mockReturnValue({ select: mockSelect })
  const mockDelete = jest.fn().mockReturnValue({ neq: mockNeq })
  const mockFrom = jest.fn().mockReturnValue({ delete: mockDelete })
  return { from: mockFrom }
}

describe('POST /api/dev/clear-all', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 with per-table row counts on success', async () => {
    const mockSupabase = makeMockSupabase({
      data: [{ id: 'row-1' }, { id: 'row-2' }],
      error: null,
    })
    mockCreateClient.mockResolvedValue(mockSupabase)

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.error).toBeNull()
    expect(body.data.tablesCleared).toMatchObject({
      session_logs: 2,
      planned_sessions: 2,
      weekly_templates: 2,
      mesocycles: 2,
      programmes: 2,
      readiness_checkins: 2,
      chat_messages: 2,
      injury_areas: 2,
    })
  })

  it('clears tables in FK-safe order', async () => {
    const mockSupabase = makeMockSupabase({ data: [], error: null })
    mockCreateClient.mockResolvedValue(mockSupabase)

    await POST()

    const calledTables = (mockSupabase.from as jest.Mock).mock.calls.map(
      ([table]: [string]) => table,
    )
    expect(calledTables).toEqual([
      'session_logs',
      'planned_sessions',
      'weekly_templates',
      'mesocycles',
      'programmes',
      'readiness_checkins',
      'chat_messages',
      'injury_areas',
    ])
  })

  it('returns 500 when a table delete fails', async () => {
    const mockSelect = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'db error' } })
    const mockNeq = jest.fn().mockReturnValue({ select: mockSelect })
    const mockDelete = jest.fn().mockReturnValue({ neq: mockNeq })
    const mockFrom = jest.fn().mockReturnValue({ delete: mockDelete })
    mockCreateClient.mockResolvedValue({ from: mockFrom })

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.data).toBeNull()
    expect(body.error).toContain('Failed to clear table')
  })
})
