import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/lib/test-utils'
import { SeedProgrammeTrigger } from './SeedProgrammeTrigger'

describe('SeedProgrammeTrigger', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('posts to the seed endpoint and shows a success summary', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
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
    render(<SeedProgrammeTrigger />)

    await user.click(screen.getByRole('button', { name: 'Seed Summer Multipitch Programme' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/dev/seed-programme', {
        method: 'POST',
      })
    })

    expect(
      await screen.findByText(/Summer Multipitch Season seeded successfully/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/4 mesocycles, 28 weekly templates, and 14 planned sessions created/i),
    ).toBeInTheDocument()
  })

  it('shows the no-op message when the seed already exists', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          seeded: false,
          programmeId: 'programme-1',
          programmeName: 'Summer Multipitch Season',
          createdMesocycleCount: 0,
          createdWeeklyTemplateCount: 0,
          createdPlannedSessionCount: 0,
        },
        error: null,
      }),
    })

    const user = userEvent.setup()
    render(<SeedProgrammeTrigger />)

    await user.click(screen.getByRole('button', { name: 'Seed Summer Multipitch Programme' }))

    expect(
      await screen.findByText(/already exists\. No new rows were created\./i),
    ).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({
        data: null,
        error: 'Failed to seed programme data.',
      }),
    })

    const user = userEvent.setup()
    render(<SeedProgrammeTrigger />)

    await user.click(screen.getByRole('button', { name: 'Seed Summer Multipitch Programme' }))

    expect(
      await screen.findByText('Failed to seed programme data.'),
    ).toBeInTheDocument()
  })
})