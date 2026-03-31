/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { requireSuperuser } from '@/lib/supabase/get-current-user'
import { inviteUserByEmail } from '@/services/data/invitesRepository'
import { POST } from './route'

jest.mock('@/lib/supabase/get-current-user', () => ({
  requireSuperuser: jest.fn(),
}))

jest.mock('@/services/data/invitesRepository', () => ({
  inviteUserByEmail: jest.fn(),
}))

const mockRequireSuperuser = requireSuperuser as jest.Mock
const mockInviteUserByEmail = inviteUserByEmail as jest.Mock

describe('POST /api/invites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireSuperuser.mockResolvedValue({ id: 'super-123', email: 'admin@example.com' })
    mockInviteUserByEmail.mockResolvedValue({ data: true, error: null })
  })

  it('returns 201 when invite succeeds', async () => {
    const request = new NextRequest('http://localhost:3000/api/invites', {
      method: 'POST',
      body: JSON.stringify({ email: 'new.user@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toEqual({
      data: { invited_email: 'new.user@example.com' },
      error: null,
    })
    expect(mockInviteUserByEmail).toHaveBeenCalledWith({
      email: 'new.user@example.com',
    })
  })

  it('returns 400 for invalid payload', async () => {
    const request = new NextRequest('http://localhost:3000/api/invites', {
      method: 'POST',
      body: JSON.stringify({ email: 'bad-email' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.data).toBeNull()
    expect(body.error).toContain('Invalid request:')
    expect(mockInviteUserByEmail).not.toHaveBeenCalled()
  })

  it('returns 401 when requester is unauthenticated', async () => {
    mockRequireSuperuser.mockRejectedValue(new Error('Unauthenticated'))

    const request = new NextRequest('http://localhost:3000/api/invites', {
      method: 'POST',
      body: JSON.stringify({ email: 'new.user@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ data: null, error: 'Authentication required.' })
    expect(mockInviteUserByEmail).not.toHaveBeenCalled()
  })

  it('returns 403 when requester is not a superuser', async () => {
    mockRequireSuperuser.mockRejectedValue(new Error('Forbidden'))

    const request = new NextRequest('http://localhost:3000/api/invites', {
      method: 'POST',
      body: JSON.stringify({ email: 'new.user@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body).toEqual({ data: null, error: 'Forbidden.' })
    expect(mockInviteUserByEmail).not.toHaveBeenCalled()
  })

  it('returns 500 when invite service fails', async () => {
    mockInviteUserByEmail.mockResolvedValue({ data: null, error: 'Failed to send invite' })

    const request = new NextRequest('http://localhost:3000/api/invites', {
      method: 'POST',
      body: JSON.stringify({ email: 'new.user@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ data: null, error: 'Failed to send invite.' })
  })
})
