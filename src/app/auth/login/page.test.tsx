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

const mockSignInWithOtp = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: { signInWithOtp: mockSignInWithOtp },
  })),
}))

// =============================================================================
// HELPERS
// =============================================================================

function renderLoginPage() {
  return render(<LoginPage />)
}

async function fillAndSubmit(email: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.click(screen.getByRole('button', { name: /send sign-in link/i }))
}

// =============================================================================
// TESTS
// =============================================================================

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGet.mockReturnValue(null)
    mockSignInWithOtp.mockResolvedValue({ error: null })
  })

  it('renders email-only form and no password field', () => {
    renderLoginPage()

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /send sign-in link/i }),
    ).toBeInTheDocument()
  })

  it('shows confirmation message on successful magic link request', async () => {
    renderLoginPage()

    await fillAndSubmit('athlete@example.com')

    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: 'athlete@example.com',
      })
      expect(screen.getByRole('status')).toHaveTextContent(
        'Check your email for a sign-in link.',
      )
    })
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('shows a generic error message when magic link request fails', async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: { message: 'rate limit exceeded' },
    })
    renderLoginPage()

    await fillAndSubmit('athlete@example.com')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unable to send sign-in link. Please try again.',
      )
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows validation error when email is empty', async () => {
    renderLoginPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await waitFor(() => {
      expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    })
    expect(mockSignInWithOtp).not.toHaveBeenCalled()
  })

  it('shows callback error message when redirected here after a failed invite link', () => {
    mockGet.mockReturnValue('callback_failed')
    renderLoginPage()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The sign-in link has expired or is invalid. Please try again.',
    )
  })

  it('disables the submit button while request is in progress', async () => {
    // Simulate a slow network response that never resolves during the assertion
    mockSignInWithOtp.mockReturnValue(new Promise(() => {}))
    renderLoginPage()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'athlete@example.com')
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending link/i })).toBeDisabled()
    })
  })
})
