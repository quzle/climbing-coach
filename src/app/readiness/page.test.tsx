import React from 'react'
import { render, screen, waitFor } from '@/lib/test-utils'
import ReadinessPage from './page'

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

// Mock the entire ReadinessForm so we can control onSuccess
jest.mock('@/components/forms/ReadinessForm', () => ({
  ReadinessForm: ({ onSuccess }: { onSuccess?: () => void }) => (
    <div>
      <p>ReadinessForm</p>
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

describe('ReadinessPage', () => {
  it('renders page heading', () => {
    render(<ReadinessPage />)
    expect(screen.getByText('Daily Check-in')).toBeInTheDocument()
  })

  it('renders the ReadinessForm', () => {
    render(<ReadinessPage />)
    expect(screen.getByText('ReadinessForm')).toBeInTheDocument()
  })

  it('shows success toast and redirects to / on form success', async () => {
    const { toast } = await import('sonner')
    render(<ReadinessPage />)

    screen.getByRole('button', { name: /submit mock/i }).click()

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Check-in saved!')
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})
