import { createClient } from '@/lib/supabase/server'
import { inviteUserByEmail } from './invitesRepository'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('inviteUserByEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns success when Supabase invite succeeds', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        admin: {
          inviteUserByEmail: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        },
      },
    })

    const result = await inviteUserByEmail({ email: 'new.user@example.com' })

    expect(result).toEqual({ data: true, error: null })
  })

  it('returns safe error when Supabase invite fails', async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        admin: {
          inviteUserByEmail: jest.fn().mockResolvedValue({ data: null, error: { message: 'forbidden' } }),
        },
      },
    })

    const result = await inviteUserByEmail({ email: 'new.user@example.com' })

    expect(result).toEqual({ data: null, error: 'Failed to send invite' })
  })

  it('returns unexpected error when invite throws', async () => {
    ;(createClient as jest.Mock).mockRejectedValue(new Error('network down'))

    const result = await inviteUserByEmail({ email: 'new.user@example.com' })

    expect(result).toEqual({ data: null, error: 'An unexpected error occurred' })
  })
})
