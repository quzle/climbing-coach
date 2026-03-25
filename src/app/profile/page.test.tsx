import React from 'react'
import { render, screen, waitFor, fireEvent } from '@/lib/test-utils'
import ProfilePage from './page'

// =============================================================================
// MOCKS
// =============================================================================

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

import { toast } from 'sonner'
const mockToastSuccess = toast.success as jest.Mock
const mockToastError = toast.error as jest.Mock

// =============================================================================
// HELPERS
// =============================================================================

type FakeRow = {
  id: string
  area: string
  is_active: boolean
  added_at: string
  archived_at: string | null
}

function makeRow(area: string): FakeRow {
  return {
    id: `id-${area}`,
    area,
    is_active: true,
    added_at: '2024-01-01T00:00:00Z',
    archived_at: null,
  }
}

function mockGetOk(areas: FakeRow[]) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: jest.fn().mockResolvedValue({ data: areas, error: null }),
  })
}

function mockGetError(message = 'Server error') {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: jest.fn().mockResolvedValue({ data: null, error: message }),
  })
}

function mockMutationOk(row: FakeRow) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: jest.fn().mockResolvedValue({ data: row, error: null }),
  })
}

function mockMutationError(message: string) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
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

describe('ProfilePage', () => {
  it('renders the page heading', async () => {
    mockGetOk([])
    render(<ProfilePage />)
    expect(screen.getByRole('heading', { name: /^profile$/i })).toBeInTheDocument()
  })

  it('shows skeleton loading state while fetching', () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))
    render(<ProfilePage />)
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders tracked areas after successful fetch', async () => {
    mockGetOk([makeRow('shoulder_left'), makeRow('finger_a2_right')])
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Shoulder (left)')).toBeInTheDocument()
      expect(screen.getByText('A2 pulley (right)')).toBeInTheDocument()
    })
  })

  it('shows empty state when no areas are tracked', async () => {
    mockGetOk([])
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText(/no areas tracked yet/i)).toBeInTheDocument()
    })
  })

  it('shows error message when initial fetch fails', async () => {
    mockGetError('Database unavailable')
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Database unavailable')
    })
  })

  it('removes an area from the list after successful archive', async () => {
    mockGetOk([makeRow('shoulder_left'), makeRow('finger_a2_right')])
    render(<ProfilePage />)

    await waitFor(() => expect(screen.getByText('Shoulder (left)')).toBeInTheDocument())

    mockMutationOk({ ...makeRow('shoulder_left'), is_active: false, archived_at: '2024-06-01T00:00:00Z' })

    await waitFor(() => {
      const archiveButtons = screen.getAllByRole('button', { name: /archive/i })
      expect(archiveButtons.length).toBeGreaterThan(0)
      const firstButton = archiveButtons[0]
      if (!firstButton) {
        throw new Error('Expected at least one archive button')
      }
      fireEvent.click(firstButton)
    })

    // shoulder_left should be removed from the tracked list but will reappear
    // in the "Track new area" dropdown — scope the check to <span> elements.
    await waitFor(() => {
      const spans = document.querySelectorAll('li span')
      const areaNames = Array.from(spans).map((s) => s.textContent)
      expect(areaNames).not.toContain('Shoulder (left)')
      expect(areaNames).toContain('A2 pulley (right)')
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Shoulder (left) archived.')
  })

  it('shows error toast when archive fails', async () => {
    mockGetOk([makeRow('shoulder_left')])
    render(<ProfilePage />)

    await waitFor(() => expect(screen.getByText('Shoulder (left)')).toBeInTheDocument())

    mockMutationError('Archive failed')

    await waitFor(() => {
      const archiveButtons = screen.getAllByRole('button', { name: /archive/i })
      const firstButton = archiveButtons[0]
      if (!firstButton) {
        throw new Error('Expected at least one archive button')
      }
      fireEvent.click(firstButton)
    })

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Archive failed')
    })
  })

  it('adds a new area to the list after successful POST', async () => {
    mockGetOk([])
    render(<ProfilePage />)

    await waitFor(() => expect(screen.getByText(/no areas tracked yet/i)).toBeInTheDocument())

    const select = screen.getByLabelText(/select area to track/i)
    fireEvent.change(select, { target: { value: 'shoulder_left' } })

    mockMutationOk(makeRow('shoulder_left'))

    fireEvent.click(screen.getByRole('button', { name: /^track$/i }))

    await waitFor(() => {
      expect(screen.getByText('Shoulder (left)')).toBeInTheDocument()
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Shoulder (left) is now tracked.')
  })

  it('shows error toast when add fails', async () => {
    mockGetOk([])
    render(<ProfilePage />)

    await waitFor(() => expect(screen.getByText(/no areas tracked yet/i)).toBeInTheDocument())

    const select = screen.getByLabelText(/select area to track/i)
    fireEvent.change(select, { target: { value: 'shoulder_left' } })

    mockMutationError('Failed to add')

    fireEvent.click(screen.getByRole('button', { name: /^track$/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to add')
    })
  })
})
