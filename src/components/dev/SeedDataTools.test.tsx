import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/lib/test-utils'
import { SeedDataTools } from './SeedDataTools'

describe('SeedDataTools', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('loads users and applies selected target user to seed request', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              email: 'user.one@example.com',
              display_name: 'User One',
              role: 'user',
              invite_status: 'active',
            },
            {
              id: '22222222-2222-4222-8222-222222222222',
              email: 'user.two@example.com',
              display_name: 'User Two',
              role: 'user',
              invite_status: 'active',
            },
          ],
          error: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            seeded: true,
            programmeId: 'programme-1',
            programmeName: 'Summer Multipitch Season',
            createdMesocycleCount: 4,
            createdWeeklyTemplateCount: 28,
            createdPlannedSessionCount: 14,
          },
          error: null,
        }),
      })

    const user = userEvent.setup()
    render(<SeedDataTools />)

    await screen.findByRole('option', { name: /User Two/i })
    const select = screen.getByLabelText('Target User')
    await user.selectOptions(select, '22222222-2222-4222-8222-222222222222')
    await user.click(screen.getByRole('button', { name: 'Seed Summer Multipitch Programme' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/dev/seed-programme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUserId: '22222222-2222-4222-8222-222222222222' }),
      })
    })
  })

  it('shows load error when target users request fails', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({ data: null, error: 'Failed to load target users.' }),
      }),
    )

    render(<SeedDataTools />)

    expect(await screen.findByText('Failed to load target users.')).toBeInTheDocument()
  })
})
