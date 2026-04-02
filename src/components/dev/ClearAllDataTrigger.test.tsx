import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/lib/test-utils'
import { ClearAllDataTrigger } from './ClearAllDataTrigger'

describe('ClearAllDataTrigger', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('renders the initial clear button', () => {
    render(<ClearAllDataTrigger targetUserId="11111111-1111-4111-8111-111111111111" />)
    expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeInTheDocument()
  })

  it('shows a confirmation step when the initial button is clicked', async () => {
    const user = userEvent.setup()
    render(<ClearAllDataTrigger targetUserId="11111111-1111-4111-8111-111111111111" />)

    await user.click(screen.getByRole('button', { name: 'Clear All Data' }))

    expect(screen.getByText(/Are you sure\?/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Yes, delete everything/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('returns to idle state when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<ClearAllDataTrigger targetUserId="11111111-1111-4111-8111-111111111111" />)

    await user.click(screen.getByRole('button', { name: 'Clear All Data' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeInTheDocument()
    expect(screen.queryByText(/Are you sure\?/i)).not.toBeInTheDocument()
  })

  it('posts to the clear-all endpoint and shows per-table row counts on success', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          tablesCleared: {
            session_logs: 3,
            planned_sessions: 2,
            weekly_templates: 5,
            mesocycles: 2,
            programmes: 1,
            readiness_checkins: 7,
            chat_messages: 12,
            injury_areas: 2,
          },
        },
        error: null,
      }),
    })

    const user = userEvent.setup()
    render(<ClearAllDataTrigger targetUserId="11111111-1111-4111-8111-111111111111" />)

    await user.click(screen.getByRole('button', { name: 'Clear All Data' }))
    await user.click(screen.getByRole('button', { name: /Yes, delete everything/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/dev/clear-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUserId: '11111111-1111-4111-8111-111111111111' }),
      })
    })

    expect(await screen.findByText(/34 rows deleted across 8 tables/i)).toBeInTheDocument()
    expect(screen.getByText(/session_logs: 3 rows/i)).toBeInTheDocument()
    expect(screen.getByText(/programmes: 1 row$/i)).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({
        data: null,
        error: 'Failed to clear database.',
      }),
    })

    const user = userEvent.setup()
    render(<ClearAllDataTrigger targetUserId="11111111-1111-4111-8111-111111111111" />)

    await user.click(screen.getByRole('button', { name: 'Clear All Data' }))
    await user.click(screen.getByRole('button', { name: /Yes, delete everything/i }))

    expect(await screen.findByText('Failed to clear database.')).toBeInTheDocument()
  })

  it('disables reset when no target user is selected', () => {
    render(<ClearAllDataTrigger targetUserId={null} />)

    expect(screen.getByText('Select a target user before resetting data.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear All Data' })).toBeDisabled()
  })
})
