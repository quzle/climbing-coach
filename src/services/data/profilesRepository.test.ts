import { createClient } from '@/lib/supabase/server'
import type { Profile, ProfileInsert, ProfileUpdate } from '@/types'
import {
  getProfile,
  getProfileByEmail,
  listProfiles,
  updateProfile,
  upsertProfile,
} from './profilesRepository'

// =============================================================================
// MODULE MOCK
// =============================================================================

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

// =============================================================================
// MOCK FACTORY
// =============================================================================

/**
 * Returns a fresh chainable Supabase query builder mock.
 * Every method returns `this` so chains like .select().eq().maybeSingle()
 * are supported. Override the terminal methods (single / maybeSingle) per
 * test using mockResolvedValue.
 */
function makeSupabaseMock() {
  const mockResult = { data: null, error: null }
  const mockChain = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(mockResult),
    maybeSingle: jest.fn().mockResolvedValue(mockResult),
    then: undefined,
  }
  const mockFrom = jest.fn().mockReturnValue(mockChain)
  return { mockFrom, mockChain }
}

/**
 * Factory for Profile test fixtures.
 * All fields are populated with sensible defaults; pass overrides to
 * customise individual fields without repeating boilerplate in every test.
 */
function makeProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: 'user-1',
    email: 'climber@example.com',
    display_name: 'Test Climber',
    role: 'user',
    invite_status: 'active',
    created_at: '2026-03-31T10:00:00Z',
    updated_at: '2026-03-31T10:00:00Z',
    ...overrides,
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('getProfile', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('returns the profile when found', async () => {
    const profile = makeProfile()
    mockChain.maybeSingle.mockResolvedValue({ data: profile, error: null })

    const result = await getProfile('user-1')

    expect(result).toEqual({ data: profile, error: null })
    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('returns data: null when profile does not exist', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await getProfile('nonexistent')

    expect(result).toEqual({ data: null, error: null })
  })

  it('returns an error message on Supabase error', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'db failure' },
    })

    const result = await getProfile('user-1')

    expect(result.data).toBeNull()
    expect(result.error).toBe('Failed to retrieve profile')
  })

  it('returns an error message on unexpected exception', async () => {
    ;(createClient as jest.Mock).mockRejectedValue(new Error('network error'))

    const result = await getProfile('user-1')

    expect(result.data).toBeNull()
    expect(result.error).toBe('An unexpected error occurred')
  })
})

describe('getProfileByEmail', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('returns the profile when found by email', async () => {
    const profile = makeProfile()
    mockChain.maybeSingle.mockResolvedValue({ data: profile, error: null })

    const result = await getProfileByEmail('climber@example.com')

    expect(result).toEqual({ data: profile, error: null })
    expect(mockChain.eq).toHaveBeenCalledWith('email', 'climber@example.com')
  })

  it('returns data: null when no profile matches the email', async () => {
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await getProfileByEmail('nobody@example.com')

    expect(result).toEqual({ data: null, error: null })
  })

  it('returns an error message on Supabase error', async () => {
    mockChain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'db failure' },
    })

    const result = await getProfileByEmail('climber@example.com')

    expect(result.data).toBeNull()
    expect(result.error).toBe('Failed to retrieve profile')
  })

  it('returns an error message on unexpected exception', async () => {
    ;(createClient as jest.Mock).mockRejectedValue(new Error('network error'))

    const result = await getProfileByEmail('climber@example.com')

    expect(result.data).toBeNull()
    expect(result.error).toBe('An unexpected error occurred')
  })
})

describe('upsertProfile', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('returns the upserted profile on success', async () => {
    const profile = makeProfile()
    const input: ProfileInsert = {
      id: 'user-1',
      email: 'climber@example.com',
      display_name: 'Test Climber',
    }
    mockChain.single.mockResolvedValue({ data: profile, error: null })

    const result = await upsertProfile(input)

    expect(result).toEqual({ data: profile, error: null })
    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockChain.upsert).toHaveBeenCalledWith(input, { onConflict: 'id' })
  })

  it('returns an error message on Supabase error', async () => {
    const input: ProfileInsert = { id: 'user-1', email: 'climber@example.com' }
    mockChain.single.mockResolvedValue({
      data: null,
      error: { message: 'unique violation' },
    })

    const result = await upsertProfile(input)

    expect(result.data).toBeNull()
    expect(result.error).toBe('Failed to save profile')
  })

  it('returns an error message on unexpected exception', async () => {
    ;(createClient as jest.Mock).mockRejectedValue(new Error('network error'))

    const result = await upsertProfile({ id: 'user-1', email: 'climber@example.com' })

    expect(result.data).toBeNull()
    expect(result.error).toBe('An unexpected error occurred')
  })
})

describe('listProfiles', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('returns all profiles in descending created order', async () => {
    const profiles = [
      makeProfile({ id: 'user-2', created_at: '2026-04-01T10:00:00Z' }),
      makeProfile({ id: 'user-1', created_at: '2026-03-31T10:00:00Z' }),
    ]
    mockChain.order.mockResolvedValue({ data: profiles, error: null })

    const result = await listProfiles()

    expect(result).toEqual({ data: profiles, error: null })
    expect(mockFrom).toHaveBeenCalledWith('profiles')
    expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('returns an error message on Supabase error', async () => {
    mockChain.order.mockResolvedValue({ data: null, error: { message: 'db failure' } })

    const result = await listProfiles()

    expect(result).toEqual({ data: null, error: 'Failed to list profiles' })
  })

  it('returns an error message on unexpected exception', async () => {
    ;(createClient as jest.Mock).mockRejectedValue(new Error('network error'))

    const result = await listProfiles()

    expect(result).toEqual({ data: null, error: 'An unexpected error occurred' })
  })
})

describe('updateProfile', () => {
  let mockFrom: jest.Mock
  let mockChain: ReturnType<typeof makeSupabaseMock>['mockChain']

  beforeEach(() => {
    const mock = makeSupabaseMock()
    mockFrom = mock.mockFrom
    mockChain = mock.mockChain
    ;(createClient as jest.Mock).mockResolvedValue({ from: mockFrom })
  })

  it('returns the updated profile on success', async () => {
    const updated = makeProfile({ display_name: 'New Name' })
    const update: ProfileUpdate = { display_name: 'New Name' }
    mockChain.single.mockResolvedValue({ data: updated, error: null })

    const result = await updateProfile('user-1', update)

    expect(result).toEqual({ data: updated, error: null })
    expect(mockChain.update).toHaveBeenCalledWith(update)
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('returns an error message on Supabase error', async () => {
    mockChain.single.mockResolvedValue({
      data: null,
      error: { message: 'row not found' },
    })

    const result = await updateProfile('user-1', { display_name: 'New Name' })

    expect(result.data).toBeNull()
    expect(result.error).toBe('Failed to update profile')
  })

  it('returns an error message on unexpected exception', async () => {
    ;(createClient as jest.Mock).mockRejectedValue(new Error('network error'))

    const result = await updateProfile('user-1', { invite_status: 'active' })

    expect(result.data).toBeNull()
    expect(result.error).toBe('An unexpected error occurred')
  })
})
