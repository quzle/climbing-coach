import React from 'react'
import { render, screen, waitFor } from '@/lib/test-utils'
import Home from './page'

// =============================================================================
// MOCKS
// =============================================================================

jest.mock('next/navigation', () => ({
  useRouter: jest.fn().mockReturnValue({ push: jest.fn() }),
  usePathname: jest.fn().mockReturnValue('/'),
}))

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

function mockReadinessOk(overrides: Partial<{
  hasCheckedInToday: boolean
  weeklyAvg: number
  todaysCheckin: Record<string, unknown> | null
}> = {}) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      data: {
        checkins: [],
        hasCheckedInToday: false,
        weeklyAvg: 0,
        todaysCheckin: null,
        ...overrides,
      },
      error: null,
    }),
  }
}

function mockSessionsOk(sessions: unknown[] = []) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({
      data: { sessions },
      error: null,
    }),
  }
}

function mockFetchResponses(readinessResp: unknown, sessionsResp: unknown) {
  ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
    if ((url as string).includes('/api/readiness')) return Promise.resolve(readinessResp)
    if ((url as string).includes('/api/sessions')) return Promise.resolve(sessionsResp)
    return Promise.reject(new Error(`Unexpected fetch: ${url as string}`))
  })
}

const mockSession = {
  id: 'sess-1',
  session_type: 'bouldering',
  date: '2026-03-25',
  duration_mins: 90,
  quality_rating: 4,
  notes: null,
}

const mockCheckin = {
  id: 'checkin-1',
  sleep_quality: 4,
  fatigue: 3,
  finger_health: 5,
  shoulder_health: 4,
  life_stress: 2,
  illness_flag: false,
  notes: null,
}

// =============================================================================
// TESTS
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
})

describe('Home dashboard', () => {
  it('renders heading and subtext', async () => {
    mockFetchResponses(mockReadinessOk(), mockSessionsOk())
    render(<Home />)

    expect(screen.getByText('Climbing Coach')).toBeInTheDocument()
    expect(screen.getByText('AI-powered training assistant')).toBeInTheDocument()
  })

  it('shows skeleton loading state initially', () => {
    // Never resolves — keeps loading state
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))
    render(<Home />)

    // data-slot="skeleton" elements are present
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows "No check-in today" when hasCheckedInToday is false', async () => {
    mockFetchResponses(mockReadinessOk({ hasCheckedInToday: false }), mockSessionsOk())
    render(<Home />)

    await waitFor(() => expect(screen.getByText('No check-in today')).toBeInTheDocument())
  })

  it('shows "Complete check-in" link when no check-in today', async () => {
    mockFetchResponses(mockReadinessOk({ hasCheckedInToday: false }), mockSessionsOk())
    render(<Home />)

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /complete check-in/i })).toBeInTheDocument(),
    )
  })

  it('shows readiness summary when checked in today', async () => {
    mockFetchResponses(
      mockReadinessOk({
        hasCheckedInToday: true,
        weeklyAvg: 3.8,
        todaysCheckin: mockCheckin,
      }),
      mockSessionsOk(),
    )
    render(<Home />)

    await waitFor(() => expect(screen.getByText(/3\.8 \/ 5/)).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(/Sleep 4/)).toBeInTheDocument())
  })

  it('shows "No sessions in the last 7 days" when sessions array is empty', async () => {
    mockFetchResponses(mockReadinessOk(), mockSessionsOk([]))
    render(<Home />)

    await waitFor(() =>
      expect(screen.getByText('No sessions in the last 7 days')).toBeInTheDocument(),
    )
  })

  it('shows most recent session type and date when sessions exist', async () => {
    mockFetchResponses(mockReadinessOk(), mockSessionsOk([mockSession]))
    render(<Home />)

    await waitFor(() => expect(screen.getByText('Bouldering')).toBeInTheDocument())
    // date-fns formats '2026-03-25' as 'Tue 25 Mar'
    await waitFor(() => expect(screen.getByText(/25 Mar/)).toBeInTheDocument())
  })

  it('shows session duration when present', async () => {
    mockFetchResponses(mockReadinessOk(), mockSessionsOk([mockSession]))
    render(<Home />)

    await waitFor(() => expect(screen.getByText(/90 min/)).toBeInTheDocument())
  })

  it('renders the three quick-action buttons', async () => {
    mockFetchResponses(mockReadinessOk(), mockSessionsOk())
    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Log Session')).toBeInTheDocument()
      expect(screen.getByText('Check-in')).toBeInTheDocument()
      expect(screen.getByText('Ask Coach')).toBeInTheDocument()
    })
  })

  it('still renders when API fetch rejects', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
    render(<Home />)

    // Should not throw — falls back to empty state
    await waitFor(() => expect(screen.getByText('No check-in today')).toBeInTheDocument())
  })
})
