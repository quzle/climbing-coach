import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/lib/test-utils'
import { InviteManagementControls } from './InviteManagementControls'

describe('InviteManagementControls', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('sends invite and shows success state', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { invited_email: 'new.user@example.com' },
        error: null,
      }),
    })

    const user = userEvent.setup()
    render(<InviteManagementControls />)

    await user.type(screen.getByLabelText('Invite Email'), 'new.user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'new.user@example.com' }),
      })
    })

    expect(await screen.findByText('Invite sent to new.user@example.com.')).toBeInTheDocument()
  })

  it('shows validation errors without calling the endpoint', async () => {
    const user = userEvent.setup()
    render(<InviteManagementControls />)

    await user.type(screen.getByLabelText('Invite Email'), 'invalid-email')
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    expect(
      await screen.findByText((content) => content.toLowerCase().includes('valid email')),
    ).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows API failure message', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({
        data: null,
        error: 'Failed to send invite.',
      }),
    })

    const user = userEvent.setup()
    render(<InviteManagementControls />)

    await user.type(screen.getByLabelText('Invite Email'), 'new.user@example.com')
    await user.click(screen.getByRole('button', { name: 'Send Invite' }))

    expect(await screen.findByText('Failed to send invite.')).toBeInTheDocument()
  })
})
