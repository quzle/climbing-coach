import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, fireEvent, act } from '@/lib/test-utils'
import { type UseFormReturn } from 'react-hook-form'
import { SessionLogForm, type SessionLogFormData } from './SessionLogForm'
import type { SessionType } from '@/types'

// =============================================================================
// MOCKS
// =============================================================================

jest.mock('next/navigation', () => ({
  useRouter: jest.fn().mockReturnValue({ push: jest.fn() }),
}))

const mockFetch = jest.fn()
beforeAll(() => {
  global.fetch = mockFetch
})

jest.mock('@/components/forms/SessionTypeSelector', () => ({
  SessionTypeSelector: ({
    onSelect,
  }: {
    onSelect: (type: string) => void
  }) => (
    <div>
      <button onClick={() => onSelect('bouldering')}>Select Bouldering</button>
      <button onClick={() => onSelect('strength')}>Select Strength</button>
      <button onClick={() => onSelect('fingerboard')}>Select Fingerboard</button>
      <button onClick={() => onSelect('aerobic')}>Select Aerobic</button>
    </div>
  ),
}))

jest.mock('@/components/forms/session-fields/CommonFields', () => ({
  CommonFields: () => <div data-testid="common-fields">Common fields</div>,
}))

jest.mock('@/components/forms/session-fields/ClimbingFields', () => ({
  ClimbingFields: () => (
    <div data-testid="climbing-fields">Climbing fields</div>
  ),
}))

jest.mock('@/components/forms/session-fields/FingerboardFields', () => ({
  FingerboardFields: () => (
    <div data-testid="fingerboard-fields">Fingerboard fields</div>
  ),
}))

jest.mock('@/components/forms/session-fields/StrengthFields', () => ({
  StrengthFields: () => (
    <div data-testid="strength-fields">Strength fields</div>
  ),
}))

jest.mock('@/components/forms/session-fields/AerobicFields', () => ({
  AerobicFields: () => (
    <div data-testid="aerobic-fields">Aerobic fields</div>
  ),
}))

// =============================================================================
// SETUP
// =============================================================================

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockResolvedValue({
    ok: true,
    status: 201,
    json: jest.fn().mockResolvedValue({
      data: { session: { id: 'test-session-id' } },
      error: null,
    }),
  })
})

// =============================================================================
// STAGE 1
// =============================================================================

describe('SessionLogForm — stage 1', () => {
  it('renders session type selector on mount', () => {
    render(<SessionLogForm />)
    expect(screen.getByText('Select Bouldering')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Log session/i })).not.toBeInTheDocument()
  })

  it('skips stage 1 when defaultSessionType is provided', () => {
    render(<SessionLogForm defaultSessionType="bouldering" />)
    expect(screen.queryByText('Select Bouldering')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Log session/i })).toBeInTheDocument()
  })

  it('advances to stage 2 when type is selected', () => {
    render(<SessionLogForm />)
    fireEvent.click(screen.getByText('Select Bouldering'))
    expect(screen.getByRole('button', { name: /Log session/i })).toBeInTheDocument()
    expect(screen.queryByText('Select Bouldering')).not.toBeInTheDocument()
  })
})

// =============================================================================
// STAGE 2 — FIELD RENDERING
// =============================================================================

describe('SessionLogForm — stage 2 field rendering', () => {
  it('shows climbing fields for bouldering', () => {
    render(<SessionLogForm defaultSessionType="bouldering" />)
    expect(screen.getByTestId('climbing-fields')).toBeInTheDocument()
  })

  it('shows fingerboard fields for fingerboard', () => {
    render(<SessionLogForm defaultSessionType="fingerboard" />)
    expect(screen.getByTestId('fingerboard-fields')).toBeInTheDocument()
  })

  it('shows strength fields for strength', () => {
    render(<SessionLogForm defaultSessionType="strength" />)
    expect(screen.getByTestId('strength-fields')).toBeInTheDocument()
  })

  it('shows aerobic fields for aerobic', () => {
    render(<SessionLogForm defaultSessionType="aerobic" />)
    expect(screen.getByTestId('aerobic-fields')).toBeInTheDocument()
  })

  it('shows back button to change session type', () => {
    render(<SessionLogForm defaultSessionType="bouldering" />)
    expect(screen.getByRole('button', { name: /Change type/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Change type/i }))
    expect(screen.getByText('Select Bouldering')).toBeInTheDocument()
  })
})

// =============================================================================
// SUBMISSION
// =============================================================================

describe('SessionLogForm — submission', () => {
  let capturedForm: UseFormReturn<SessionLogFormData> | null

  beforeEach(() => {
    capturedForm = null
  })

  function renderAtStage2(type: SessionType = 'strength') {
    render(
      <SessionLogForm
        defaultSessionType={type}
        onFormReady={(form) => {
          capturedForm = form
        }}
      />,
    )
  }

  async function setRequiredFields() {
    await act(async () => {
      capturedForm!.setValue('date', '2025-03-24', { shouldValidate: true })
      capturedForm!.setValue('injury_flags', [], { shouldValidate: true })
    })
  }

  it('calls fetch on valid submission', async () => {
    renderAtStage2('strength')
    await setRequiredFields()

    const submitButton = screen.getByRole('button', { name: /Log session/i })
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('shows success state after submission', async () => {
    renderAtStage2('strength')
    await setRequiredFields()

    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByText('Session logged!')).toBeInTheDocument()
    })
  })

  it('shows error message when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({
        data: null,
        error: 'Database error',
      }),
    })

    renderAtStage2('strength')
    await setRequiredFields()
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByText(/Database error/i)).toBeInTheDocument()
    })
  })

  it('calls onSuccess callback after submission', async () => {
    const onSuccess = jest.fn()
    render(
      <SessionLogForm
        defaultSessionType="strength"
        onFormReady={(form) => {
          capturedForm = form
        }}
        onSuccess={onSuccess}
      />,
    )

    await setRequiredFields()
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })
})

// =============================================================================
// SUCCESS STATE
// =============================================================================

describe('SessionLogForm — success state', () => {
  let capturedForm: UseFormReturn<SessionLogFormData> | null

  beforeEach(() => {
    capturedForm = null
  })

  function renderAtStage2(type: SessionType = 'strength') {
    render(
      <SessionLogForm
        defaultSessionType={type}
        onFormReady={(form) => {
          capturedForm = form
        }}
      />,
    )
  }

  async function setRequiredFields() {
    await act(async () => {
      capturedForm!.setValue('date', '2025-03-24', { shouldValidate: true })
      capturedForm!.setValue('injury_flags', [], { shouldValidate: true })
    })
  }

  it('shows log another session button after success', async () => {
    renderAtStage2('aerobic')
    await setRequiredFields()
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByText(/Log another session/i)).toBeInTheDocument()
    })
  })

  it('resets to stage 1 when log another is clicked', async () => {
    renderAtStage2('aerobic')
    await setRequiredFields()
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      screen.getByText(/Log another session/i)
    })

    fireEvent.click(screen.getByText(/Log another session/i))

    expect(screen.getByText('Select Bouldering')).toBeInTheDocument()
  })
})
