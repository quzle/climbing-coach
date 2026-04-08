import { upsertProfile } from '@/services/data/profilesRepository'
import { finalizeInvitedUserProfile } from './authLifecycleService'

jest.mock('@/services/data/profilesRepository', () => ({
  upsertProfile: jest.fn(),
}))

describe('finalizeInvitedUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('finalizes the invited user profile when upsert succeeds', async () => {
    ;(upsertProfile as jest.Mock).mockResolvedValue({
      data: {
        id: 'user-1',
        email: 'climber@example.com',
        display_name: null,
        role: 'user',
        invite_status: 'active',
        created_at: '2026-03-31T10:00:00Z',
        updated_at: '2026-03-31T10:00:00Z',
      },
      error: null,
    })

    const result = await finalizeInvitedUserProfile({
      id: 'user-1',
      email: 'climber@example.com',
    })

    expect(upsertProfile).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'climber@example.com',
      role: 'user',
      invite_status: 'active',
    })
    expect(result).toEqual({ data: true, error: null })
  })

  it('returns a safe error when profile upsert fails', async () => {
    ;(upsertProfile as jest.Mock).mockResolvedValue({
      data: null,
      error: 'Failed to save profile',
    })

    const result = await finalizeInvitedUserProfile({
      id: 'user-1',
      email: 'climber@example.com',
    })

    expect(result).toEqual({
      data: null,
      error: 'Failed to finalize profile lifecycle',
    })
  })

  it('returns an unexpected error when upsert throws', async () => {
    ;(upsertProfile as jest.Mock).mockRejectedValue(new Error('network down'))

    const result = await finalizeInvitedUserProfile({
      id: 'user-1',
      email: 'climber@example.com',
    })

    expect(result).toEqual({
      data: null,
      error: 'An unexpected error occurred',
    })
  })
})
