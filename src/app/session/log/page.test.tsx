import React from 'react'
import { render, screen, waitFor } from '@/lib/test-utils'
import SessionLogPage from './page'

// =============================================================================
// MOCKS
// =============================================================================

// Declare before jest.mock to avoid hoisting reference errors.
const mockPush = jest.fn()
const mockSearchParamsGet = jest.fn()
const mockSessionLogForm = jest.fn(
  ({ onSuccess }: { onSuccess?: () => void }) => (
    <div>
      <p>SessionLogForm</p>
      <button type="button" onClick={() => onSuccess?.()}>
        Submit mock
      </button>
    </div>
  ),
)

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
  },
}))

// Mock SessionLogForm so we can trigger onSuccess without rendering the full form
jest.mock('@/components/forms/SessionLogForm', () => ({
  SessionLogForm: (props: { onSuccess?: () => void }) => mockSessionLogForm(props),
}))

// =============================================================================
// TESTS
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks()
  mockSearchParamsGet.mockReturnValue(null)
  global.fetch = jest.fn()
})

describe('SessionLogPage', () => {
  it('renders page heading', () => {
    render(<SessionLogPage />)
    expect(screen.getByText('Log Session')).toBeInTheDocument()
  })

  it('renders the SessionLogForm', () => {
    render(<SessionLogPage />)
    expect(screen.getByText('SessionLogForm')).toBeInTheDocument()
  })

  it('loads planned session details and passes prefills to SessionLogForm', async () => {
    mockSearchParamsGet.mockReturnValue('planned-1')
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          plannedSession: {
            id: 'planned-1',
            created_at: null,
            generated_plan: {
              session_label: 'Limit Bouldering',
              duration_mins: 90,
              ai_plan_text: 'Do 4 hard problems',
            },
            generation_notes: null,
            mesocycle_id: 'meso-1',
            planned_date: '2026-03-30',
            session_type: 'bouldering',
            status: 'planned',
            template_id: 'wt-1',
          },
        },
        error: null,
      }),
    })

    render(<SessionLogPage />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/planned-sessions/planned-1')
    })

    await waitFor(() => {
      expect(mockSessionLogForm).toHaveBeenLastCalledWith(
        expect.objectContaining({
          defaultSessionType: 'bouldering',
          plannedSessionId: 'planned-1',
          initialValues: expect.objectContaining({
            date: '2026-03-30',
            duration_mins: 90,
            planned_session_id: 'planned-1',
          }),
        }),
      )
    })
  })

  it('shows success toast and redirects to / on form success', async () => {
    const { toast } = await import('sonner')
    render(<SessionLogPage />)

    screen.getByRole('button', { name: /submit mock/i }).click()

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Session logged!')
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})
