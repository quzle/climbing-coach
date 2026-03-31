import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from './get-current-user'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

const mockGetUser = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(createClient as jest.Mock).mockResolvedValue({
    auth: { getUser: mockGetUser },
  })
})

describe('getCurrentUser', () => {
  it('returns id and email when user is authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-abc-123', email: 'test@example.com' } },
      error: null,
    })

    const result = await getCurrentUser()

    expect(result).toEqual({ id: 'user-abc-123', email: 'test@example.com' })
  })

  it('returns undefined email when user has no email', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-abc-123', email: undefined } },
      error: null,
    })

    const result = await getCurrentUser()

    expect(result).toEqual({ id: 'user-abc-123', email: undefined })
  })

  it('throws when auth returns an error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'JWT expired' },
    })

    await expect(getCurrentUser()).rejects.toThrow('Unauthenticated')
  })

  it('throws when auth returns null user with no error', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    await expect(getCurrentUser()).rejects.toThrow('Unauthenticated')
  })
})
