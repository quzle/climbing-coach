import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/lib/test-utils'
import ChangePasswordPage from './page'

const mockPush = jest.fn()
const mockRefresh = jest.fn()
const mockUpdateUser = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: mockPush, refresh: mockRefresh })),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: { updateUser: mockUpdateUser },
  })),
}))

describe('ChangePasswordPage', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateUser.mockResolvedValue({ error: null })
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('renders password and confirm password fields', () => {
    render(<ChangePasswordPage />)

    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument()
  })

  it('updates password and redirects to profile on success', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('New password'), 'strongpass123')
    await user.type(screen.getByLabelText('Confirm password'), 'strongpass123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'strongpass123' })
      expect(mockPush).toHaveBeenCalledWith('/profile')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows a validation error when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('New password'), 'strongpass123')
    await user.type(screen.getByLabelText('Confirm password'), 'wrongpass123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.getByText('Passwords must match')).toBeInTheDocument()
    })
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('shows a generic error when update fails', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'Weak password' } })
    const user = userEvent.setup()
    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('New password'), 'strongpass123')
    await user.type(screen.getByLabelText('Confirm password'), 'strongpass123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Unable to update password. Please try again.',
      )
    })
  })

  it('disables the button while update is in progress', async () => {
    mockUpdateUser.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(<ChangePasswordPage />)

    await user.type(screen.getByLabelText('New password'), 'strongpass123')
    await user.type(screen.getByLabelText('Confirm password'), 'strongpass123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /updating password/i })).toBeDisabled()
    })
  })
})