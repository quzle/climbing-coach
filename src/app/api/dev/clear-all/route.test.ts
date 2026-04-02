/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError, logInfo } from '@/lib/logger'
import { requireSuperuser } from '@/lib/supabase/get-current-user'
import { POST } from './route'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
}))

jest.mock('@/lib/supabase/get-current-user', () => ({
  requireSuperuser: jest.fn(),
}))

const mockCreateClient = createClient as jest.Mock
const mockRequireSuperuser = requireSuperuser as jest.Mock
const mockLogError = logError as jest.Mock
const mockLogInfo = logInfo as jest.Mock

function makeMockSupabase(
  deleteResult: { data: { id: string }[] | null; error: null | { message: string } },
) {
  const mockSelect = jest.fn().mockResolvedValue(deleteResult)
  const mockEq = jest.fn().mockReturnValue({ select: mockSelect })
  const mockDelete = jest.fn().mockReturnValue({ eq: mockEq })
  const mockFrom = jest.fn().mockReturnValue({ delete: mockDelete })
  return { from: mockFrom }
}

describe('POST /api/dev/clear-all', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireSuperuser.mockResolvedValue({ id: 'super-123', email: 'admin@example.com' })
  })

  it('returns 200 with per-table row counts on success', async () => {
    const mockSupabase = makeMockSupabase({
      data: [{ id: 'row-1' }, { id: 'row-2' }],
      error: null,
    })
    mockCreateClient.mockResolvedValue(mockSupabase)

    const request = new NextRequest('http://localhost:3000/api/dev/clear-all', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.error).toBeNull()
    expect(body.data.targetUserId).toBe('super-123')
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
    expect(mockLogInfo).toHaveBeenCalledWith({
      event: 'privileged_dev_action_executed',
      outcome: 'success',
      route: '/api/dev/clear-all',
      userId: 'super-123',
      profileRole: 'superuser',
      entityType: 'dev_action',
      entityId: 'clear_all',
      data: {
        tables_cleared: expect.objectContaining({
          session_logs: 2,
          planned_sessions: 2,
          weekly_templates: 2,
          mesocycles: 2,
          programmes: 2,
          readiness_checkins: 2,
          chat_messages: 2,
          injury_areas: 2,
        }),
        targetUserId: 'super-123',
      },
    })
  })

  it('clears tables in FK-safe order', async () => {
    const mockSupabase = makeMockSupabase({ data: [], error: null })
    mockCreateClient.mockResolvedValue(mockSupabase)
    const request = new NextRequest('http://localhost:3000/api/dev/clear-all', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

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

  it('uses target user ID from request payload for deletions', async () => {
    const mockEq = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    })
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEq })
    const mockFrom = jest.fn().mockReturnValue({ delete: mockDelete })
    mockCreateClient.mockResolvedValue({ from: mockFrom })

    const request = new NextRequest('http://localhost:3000/api/dev/clear-all', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: '11111111-1111-4111-8111-111111111111' }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(mockEq).toHaveBeenCalledWith('user_id', '11111111-1111-4111-8111-111111111111')
  })

  it('returns 500 when a table delete fails', async () => {
    const mockSelect = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'db error' } })
    const mockEq = jest.fn().mockReturnValue({ select: mockSelect })
    const mockDelete = jest.fn().mockReturnValue({ eq: mockEq })
    const mockFrom = jest.fn().mockReturnValue({ delete: mockDelete })
    mockCreateClient.mockResolvedValue({ from: mockFrom })
    const request = new NextRequest('http://localhost:3000/api/dev/clear-all', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: '11111111-1111-4111-8111-111111111111' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.data).toBeNull()
    expect(body.error).toContain('Failed to clear table')
    expect(mockLogError).toHaveBeenCalledWith({
      event: 'privileged_dev_action_executed',
      outcome: 'failure',
      route: '/api/dev/clear-all',
      userId: 'super-123',
      profileRole: 'superuser',
      entityType: 'dev_action',
      entityId: 'clear_all',
      data: {
        table: 'session_logs',
        targetUserId: '11111111-1111-4111-8111-111111111111',
      },
      error: { message: 'db error' },
    })
  })

  it('returns 401 when requester is unauthenticated', async () => {
    mockRequireSuperuser.mockRejectedValue(new Error('Unauthenticated'))
    const request = new NextRequest('http://localhost:3000/api/dev/clear-all', {
      method: 'POST',
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.data).toBeNull()
    expect(body.error).toBe('Authentication required.')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns 403 when requester is not a superuser', async () => {
    mockRequireSuperuser.mockRejectedValue(new Error('Forbidden'))
    const request = new NextRequest('http://localhost:3000/api/dev/clear-all', {
      method: 'POST',
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.data).toBeNull()
    expect(body.error).toBe('Forbidden.')
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid target user payload', async () => {
    const request = new NextRequest('http://localhost:3000/api/dev/clear-all', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: 'not-a-uuid' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ data: null, error: 'Invalid request.' })
  })
})
