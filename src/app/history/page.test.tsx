import React from 'react'
import { render, screen, waitFor } from '@/lib/test-utils'
import HistoryPage from './page'

// =============================================================================
// MOCKS
// =============================================================================

jest.mock('next/link', () => {
  const MockLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  )
  MockLink.displayName = 'Link'
  return MockLink
})

// =============================================================================
// HELPERS
// =============================================================================

const mockSessions = [
  {
    id: 'sess-1',
    session_type: 'bouldering',
    date: '2026-03-25',
    duration_mins: 90,
    quality_rating: 4,
    notes: 'Felt strong',
  },
  {
    id: 'sess-2',
    session_type: 'fingerboard',
    date: '2026-03-23',
    duration_mins: 45,
    quality_rating: null,
    notes: null,
  },
]

function mockFetchOk(sessions: unknown[] = mockSessions) {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ data: { sessions }, error: null }),
  })
}

function mockFetchError(message = 'Server error') {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: false,
    json: jest.fn().mockResolvedValue({ data: null, error: message }),
  })
}

// =============================================================================
// TESTS
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

describe('HistoryPage', () => {
  it('renders page heading', async () => {
    mockFetchOk()
    render(<HistoryPage />)
    expect(screen.getByText('Session History')).toBeInTheDocument()
  })

  it('shows skeleton loading state initially', () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))
    render(<HistoryPage />)

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders a card for each session after loading', async () => {
    mockFetchOk()
    render(<HistoryPage />)

    await waitFor(() => expect(screen.getByText('Bouldering')).toBeInTheDocument())
    expect(screen.getByText('Fingerboard')).toBeInTheDocument()
  })

  it('shows session date formatted correctly', async () => {
    mockFetchOk()
    render(<HistoryPage />)

    await waitFor(() => expect(screen.getByText(/25 Mar 2026/)).toBeInTheDocument())
  })

  it('shows duration when present', async () => {
    mockFetchOk()
    render(<HistoryPage />)

    await waitFor(() => expect(screen.getByText(/90 min/)).toBeInTheDocument())
  })

  it('shows notes preview when present', async () => {
    mockFetchOk()
    render(<HistoryPage />)

    await waitFor(() => expect(screen.getByText('Felt strong')).toBeInTheDocument())
  })

  it('shows empty state when no sessions exist', async () => {
    mockFetchOk([])
    render(<HistoryPage />)

    await waitFor(() => expect(screen.getByText('No sessions logged yet')).toBeInTheDocument())
  })

  it('shows "Log your first session" link in empty state', async () => {
    mockFetchOk([])
    render(<HistoryPage />)

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /log your first session/i })).toBeInTheDocument(),
    )
  })

  it('shows error message when API returns an error', async () => {
    mockFetchError('Failed to load sessions.')
    render(<HistoryPage />)

    await waitFor(() => expect(screen.getByText('Failed to load sessions.')).toBeInTheDocument())
  })

  it('shows generic error message when fetch throws', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
    render(<HistoryPage />)

    await waitFor(() => expect(screen.getByText('Failed to load sessions.')).toBeInTheDocument())
  })

  it('fetches sessions for the last 365 days', async () => {
    mockFetchOk()
    render(<HistoryPage />)

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/sessions?days=365'),
    )
  })
})
