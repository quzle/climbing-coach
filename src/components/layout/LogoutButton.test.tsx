import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/lib/test-utils'
import { AuthProvider, type ClientAuthUser } from '@/components/providers/auth-provider'
import { toast } from 'sonner'
import { LogoutButton } from './LogoutButton'

const mockPush = jest.fn()
const mockRefresh = jest.fn()
const mockSignOut = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}))

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}))

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

function renderLogoutButton(initialUser: ClientAuthUser | null = makeUser()) {
  return render(
    <AuthProvider initialUser={initialUser}>
      <LogoutButton />
    </AuthProvider>,
  )
}

describe('LogoutButton', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockSignOut.mockResolvedValue({ error: null })
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('signs the user out and redirects to the login page', async () => {
    const user = userEvent.setup()
    renderLogoutButton()

    await user.click(screen.getByRole('button', { name: /log out/i }))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/auth/login')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows a generic error toast when sign out fails', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'network error' } })
    const user = userEvent.setup()
    renderLogoutButton()

    await user.click(screen.getByRole('button', { name: /log out/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to sign out. Please try again.')
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('disables the button while sign out is in progress', async () => {
    mockSignOut.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderLogoutButton()

    await user.click(screen.getByRole('button', { name: /log out/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing out/i })).toBeDisabled()
    })
  })
})