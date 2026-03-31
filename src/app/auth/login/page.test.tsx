import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/lib/test-utils'
import LoginPage from './page'

// =============================================================================
// MOCKS
// =============================================================================

const mockPush = jest.fn()
const mockRefresh = jest.fn()
const mockGet = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: mockPush, refresh: mockRefresh })),
  useSearchParams: jest.fn(() => ({ get: mockGet })),
}))

const mockSignInWithPassword = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: { signInWithPassword: mockSignInWithPassword },
  })),
}))

// =============================================================================
// HELPERS
// =============================================================================

function renderLoginPage() {
  return render(<LoginPage />)
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: /sign in/i }))
}

// =============================================================================
// TESTS
// =============================================================================

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockReturnValue(null)
    mockSignInWithPassword.mockResolvedValue({ error: null })
  })

  it('renders email and password fields with a submit button', () => {
    renderLoginPage()

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('redirects to home on successful sign-in', async () => {
    renderLoginPage()

    await fillAndSubmit('athlete@example.com', 'correct-password')

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'athlete@example.com',
        password: 'correct-password',
      })
      expect(mockPush).toHaveBeenCalledWith('/')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows a generic error message when sign-in fails', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    })
    renderLoginPage()

    await fillAndSubmit('athlete@example.com', 'wrong-password')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Invalid email or password.',
      )
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows validation error when email is empty', async () => {
    renderLoginPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    })
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })

  it('shows validation error when password is empty', async () => {
    renderLoginPage()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'athlete@example.com')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })

  it('shows callback error message when redirected here after a failed invite link', () => {
    mockGet.mockReturnValue('callback_failed')
    renderLoginPage()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The sign-in link has expired or is invalid. Please try again.',
    )
  })

  it('disables the submit button while sign-in is in progress', async () => {
    // Simulate a slow network response that never resolves during the assertion
    mockSignInWithPassword.mockReturnValue(new Promise(() => {}))
    renderLoginPage()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'athlete@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    })
  })
})
