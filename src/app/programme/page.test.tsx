import React from 'react'
import { render, screen, waitFor } from '@/lib/test-utils'
import ProgrammePage from './page'

jest.mock('next/link', () => {
  const MockLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  )
  MockLink.displayName = 'Link'
  return MockLink
})

// =============================================================================
// TEST DATA
// =============================================================================

const mockSnapshot = {
  currentProgramme: {
    id: 'prog-1',
    name: '16-Week Peak 2026',
    goal: 'Redpoint 8a outdoors before September',
    start_date: '2026-01-05',
    target_date: '2026-04-26',
    notes: null,
    created_at: null,
  },
  activeMesocycle: {
    id: 'meso-1',
    name: 'Power & Finger Strength',
    phase_type: 'power',
    planned_start: '2026-03-02',
    planned_end: '2026-04-05',
    actual_start: null,
    actual_end: null,
    status: 'active',
    focus: 'Max finger recruitment and contact strength',
    programme_id: 'prog-1',
    interruption_notes: null,
    created_at: null,
  },
  mesocycles: [
    {
      id: 'meso-1',
      name: 'Power & Finger Strength',
      phase_type: 'power',
      planned_start: '2026-03-02',
      planned_end: '2026-04-05',
      actual_start: null,
      actual_end: null,
      status: 'active',
      focus: 'Max finger recruitment and contact strength',
      programme_id: 'prog-1',
      interruption_notes: null,
      created_at: null,
    },
  ],
  currentWeeklyTemplate: [
    {
      id: 'wt-2',
      mesocycle_id: 'meso-1',
      day_of_week: 2,
      session_type: 'bouldering',
      session_label: 'Bouldering — Hard Problems',
      intensity: 'high',
      primary_focus: 'V8+ projecting',
      duration_mins: 120,
      notes: null,
    },
    {
      id: 'wt-1',
      mesocycle_id: 'meso-1',
      day_of_week: 0,
      session_type: 'fingerboard',
      session_label: 'Fingerboard — Limit Hangs',
      intensity: 'high',
      primary_focus: 'Max strength on 20mm edge',
      duration_mins: 45,
      notes: null,
    },
  ],
  upcomingPlannedSessions: [
    {
      id: 'ps-1',
      planned_date: '2026-03-26',
      session_type: 'fingerboard',
      status: 'planned',
      mesocycle_id: 'meso-1',
      template_id: 'wt-1',
      generated_plan: null,
      generation_notes: null,
      created_at: null,
    },
  ],
}

// =============================================================================
// HELPERS
// =============================================================================

function mockFetchOk(data: unknown = mockSnapshot): void {
  ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/mesocycles')) {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { mesocycles: [mockSnapshot.activeMesocycle] },
          error: null,
        }),
      })
    }
    return Promise.resolve({
      ok: true,
      json: jest.fn().mockResolvedValue({ data, error: null }),
    })
  })
}

function mockFetchError(message = 'Server error'): void {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: false,
    json: jest.fn().mockResolvedValue({ data: null, error: message }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

// =============================================================================
// TESTS
// =============================================================================

describe('ProgrammePage', () => {
  it('renders page heading', () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))
    render(<ProgrammePage />)
    expect(screen.getByText('Training Plan')).toBeInTheDocument()
  })

  it('renders programme name and goal after loading', async () => {
    mockFetchOk()
    render(<ProgrammePage />)
    await waitFor(() => {
      expect(screen.getByText('16-Week Peak 2026')).toBeInTheDocument()
    })
    expect(screen.getByText('Redpoint 8a outdoors before September')).toBeInTheDocument()
  })

  it('renders active mesocycle section', async () => {
    mockFetchOk()
    render(<ProgrammePage />)
    await waitFor(() => {
      expect(screen.getByText('Power & Finger Strength')).toBeInTheDocument()
    })
    expect(screen.getByText('Max finger recruitment and contact strength')).toBeInTheDocument()
    expect(screen.getByText('Power')).toBeInTheDocument()
  })

  it('renders active mesocycle card details', async () => {
    mockFetchOk()
    render(<ProgrammePage />)
    await waitFor(() => {
      expect(screen.getByText('Current block')).toBeInTheDocument()
    })
    expect(screen.getByText('Mesocycles')).toBeInTheDocument()
    // Mesocycle dates are rendered
    expect(screen.getByText(/2 Mar/)).toBeInTheDocument()
    expect(screen.getByText(/5 Apr 2026/)).toBeInTheDocument()
  })

  it('renders upcoming planned sessions section', async () => {
    mockFetchOk()
    render(<ProgrammePage />)
    await waitFor(() => {
      expect(screen.getByText('Upcoming Sessions')).toBeInTheDocument()
    })
    expect(screen.getByText('planned')).toBeInTheDocument()
    expect(screen.getByText('fingerboard')).toBeInTheDocument()
  })

  it('renders start session link for an upcoming planned session', async () => {
    mockFetchOk()
    render(<ProgrammePage />)

    const link = await screen.findByRole('link', { name: /start session/i })
    expect(link).toHaveAttribute('href', '/session/log?planned_session_id=ps-1')
  })

  it('shows empty state when no programme is active', async () => {
    mockFetchOk({ ...mockSnapshot, currentProgramme: null })
    render(<ProgrammePage />)
    await waitFor(() => {
      expect(screen.getByText('Programme Builder')).toBeInTheDocument()
    })
  })

  it('does not render programme cards in empty state', async () => {
    mockFetchOk({ ...mockSnapshot, currentProgramme: null })
    render(<ProgrammePage />)
    await waitFor(() => {
      expect(screen.getByText('Programme Builder')).toBeInTheDocument()
    })
    expect(screen.queryByText('16-Week Peak 2026')).not.toBeInTheDocument()
  })

  it('shows builder editor instead of obsolete setup CTA in empty state', async () => {
    mockFetchOk({ ...mockSnapshot, currentProgramme: null })
    render(<ProgrammePage />)

    expect(await screen.findByText('Programme Builder')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create programme/i })).toBeInTheDocument()
  })

  it('shows error message when API returns an error', async () => {
    mockFetchError('Failed to load programme data.')
    render(<ProgrammePage />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load programme data.')
    })
  })

  it('shows generic error message when fetch throws', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
    render(<ProgrammePage />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load programme.')
    })
  })

  it('fetches from /api/programme', async () => {
    mockFetchOk()
    render(<ProgrammePage />)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/programme')
    })
  })
})
