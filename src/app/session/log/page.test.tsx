import React from 'react'
import { render, screen, waitFor } from '@/lib/test-utils'
import SessionLogPage from './page'

// =============================================================================
// MOCKS
// =============================================================================

// Declare before jest.mock to avoid hoisting reference errors.
const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
  },
}))

// Mock SessionLogForm so we can trigger onSuccess without rendering the full form
jest.mock('@/components/forms/SessionLogForm', () => ({
  SessionLogForm: ({ onSuccess }: { onSuccess?: () => void }) => (
    <div>
      <p>SessionLogForm</p>
      <button type="button" onClick={() => onSuccess?.()}>
        Submit mock
      </button>
    </div>
  ),
}))

// =============================================================================
// TESTS
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks()
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
