import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { AuthProvider, type ClientAuthUser } from '@/components/providers/auth-provider'
import { useAuth } from './useAuth'

function makeUser(overrides?: Partial<ClientAuthUser>): ClientAuthUser {
  return {
    id: 'user-123',
    email: 'climber@example.com',
    displayName: 'Test Climber',
    role: 'user',
    inviteStatus: 'active',
    ...overrides,
  }
}

function makeWrapper(initialUser: ClientAuthUser | null) {
  return function Wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    return <AuthProvider initialUser={initialUser}>{children}</AuthProvider>
  }
}

describe('useAuth', () => {
  it('returns the initial authenticated user state', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(makeUser()),
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(makeUser())
  })

  it('returns unauthenticated state when no initial user exists', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(null),
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('updates profile fields without losing the rest of the user state', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(makeUser()),
    })

    act(() => {
      result.current.updateProfile({ displayName: 'New Name' })
    })

    expect(result.current.user).toEqual(
      makeUser({ displayName: 'New Name' }),
    )
  })

  it('clears the current user', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(makeUser()),
    })

    act(() => {
      result.current.clearUser()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })
})