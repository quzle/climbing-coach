/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { UnauthenticatedError } from '@/lib/errors'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

jest.mock('@/lib/supabase/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

const mockGetCurrentUser = getCurrentUser as jest.Mock
const mockCreateClient = createClient as jest.Mock

describe('POST /api/mesocycles/[id]/confirm-weekly', () => {
  const mesocycleId = '9b8f9f0f-68c7-4298-89fd-79f41455d2c1'
  const userId = '389326ff-9b22-4dcc-a69b-916e327ff4ba'

  const validBody = {
    slots: [
      {
        day_of_week: 1,
        session_label: 'Limit Bouldering',
        session_type: 'bouldering',
        intensity: 'high',
        duration_mins: 90,
        primary_focus: 'Power',
        notes: null,
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: userId, email: 'user@example.com' })
  })

  it('inserts slots with authenticated user_id and user-scoped delete', async () => {
    const deleteEqUserId = jest.fn().mockResolvedValue({ error: null })
    const deleteEqMesocycle = jest.fn().mockReturnValue({ eq: deleteEqUserId })
    const deleteFn = jest.fn().mockReturnValue({ eq: deleteEqMesocycle })

    const selectFn = jest.fn().mockResolvedValue({ data: [{ id: 'wt-1' }], error: null })
    const insertFn = jest.fn().mockReturnValue({ select: selectFn })

    const fromFn = jest.fn().mockReturnValue({
      delete: deleteFn,
      insert: insertFn,
    })

    mockCreateClient.mockResolvedValue({ from: fromFn })

    const request = new NextRequest(`http://localhost/api/mesocycles/${mesocycleId}/confirm-weekly`, {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: mesocycleId }),
    })

    expect(response.status).toBe(201)
    expect(fromFn).toHaveBeenCalledWith('weekly_templates')
    expect(deleteEqMesocycle).toHaveBeenCalledWith('mesocycle_id', mesocycleId)
    expect(deleteEqUserId).toHaveBeenCalledWith('user_id', userId)
    expect(insertFn).toHaveBeenCalledWith([
      {
        mesocycle_id: mesocycleId,
        user_id: userId,
        day_of_week: 1,
        session_label: 'Limit Bouldering',
        session_type: 'bouldering',
        intensity: 'high',
        duration_mins: 90,
        primary_focus: 'Power',
        notes: null,
      },
    ])
  })

  it('returns 400 for invalid payload', async () => {
    const request = new NextRequest(`http://localhost/api/mesocycles/${mesocycleId}/confirm-weekly`, {
      method: 'POST',
      body: JSON.stringify({ slots: [] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: mesocycleId }),
    })

    expect(response.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockRejectedValue(new UnauthenticatedError())

    const request = new NextRequest(`http://localhost/api/mesocycles/${mesocycleId}/confirm-weekly`, {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: mesocycleId }),
    })

    expect(response.status).toBe(401)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })
})
