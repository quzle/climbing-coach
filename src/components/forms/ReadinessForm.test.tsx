import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor, act } from '@/lib/test-utils'
import { type UseFormReturn } from 'react-hook-form'
import { ReadinessForm, type ReadinessFormData } from './ReadinessForm'

// =============================================================================
// MOCKS
// =============================================================================

jest.mock('next/navigation', () => ({
  useRouter: jest.fn().mockReturnValue({ push: jest.fn() }),
}))

// =============================================================================
// HELPERS
// =============================================================================

function mockFetchOk(warnings: string[] = []) {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 201,
    json: jest.fn().mockResolvedValue({
      data: {
        checkin: { id: 'test-id', date: '2025-03-24' },
        warnings,
      },
      error: null,
    }),
  })
}

function renderReadinessForm(props: Partial<React.ComponentProps<typeof ReadinessForm>> = {}) {
  return render(<ReadinessForm {...props} />)
}

// Rating buttons have aria-label "fieldname N — Label" (e.g. "sleep_quality 4 — Good").
// Match by the " N — " substring so the query works regardless of which field is active.
async function selectRating(user: ReturnType<typeof userEvent.setup>, rating = '4') {
  const btn = screen.getByRole('button', { name: new RegExp(` ${rating} —`) })
  await user.click(btn)
}

/**
 * Advances through all steps up to (but not including) the notes step (7).
 * Ratings 1-5 each receive a "4", illness step receives "No symptoms".
 * Each step waits for its question heading before clicking.
 */
async function advanceToStep7(user: ReturnType<typeof userEvent.setup>) {
  const ratingQuestions = [
    'How did you sleep?',
    'How is your body feeling?',
    'How are your fingers and tendons?',
    'How is your shoulder?',
    'How is life stress today?',
  ]

  for (const question of ratingQuestions) {
    await waitFor(() => expect(screen.getByText(question)).toBeInTheDocument())
    await selectRating(user)
  }

  // Step 6: illness toggle
  await waitFor(() => expect(screen.getByText('Any illness symptoms?')).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: /No symptoms/i }))

  // Step 7: notes
  await waitFor(() => expect(screen.getByText('Anything to tell your coach?')).toBeInTheDocument())
}




beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
  mockFetchOk()
})

// =============================================================================
// TESTS
// =============================================================================

describe('ReadinessForm — rendering', () => {
  it('renders step 1 on mount', () => {
    renderReadinessForm()

    expect(screen.getByText('How did you sleep?')).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument()
    expect(screen.queryByText('Step 2 of 7')).not.toBeInTheDocument()
  })

  it('renders progress bar', () => {
    renderReadinessForm()

    // The progress track container is always present
    const progressTrack = document.querySelector('.bg-slate-200')
    expect(progressTrack).toBeInTheDocument()
    // The fill div exists inside it
    const progressFill = document.querySelector('.bg-emerald-500')
    expect(progressFill).toBeInTheDocument()
  })

  it('does not show back button on step 1', () => {
    renderReadinessForm()

    expect(screen.queryByRole('button', { name: /Back/i })).not.toBeInTheDocument()
  })
})

describe('ReadinessForm — navigation', () => {
  it('advances to step 2 after selecting a rating on step 1', async () => {
    const user = userEvent.setup()
    renderReadinessForm()

    await selectRating(user, '4')

    await waitFor(
      () => expect(screen.getByText('How is your body feeling?')).toBeInTheDocument(),
      { timeout: 1000 },
    )
  })

  it('shows back button from step 2 onwards', async () => {
    const user = userEvent.setup()
    renderReadinessForm()

    await selectRating(user, '4')

    await waitFor(() => expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument())
  })

  it('goes back to previous step when back is clicked', async () => {
    const user = userEvent.setup()
    renderReadinessForm()

    await selectRating(user, '4')
    await waitFor(() =>
      expect(screen.getByText('How is your body feeling?')).toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: /Back/i }))

    expect(screen.getByText('How did you sleep?')).toBeInTheDocument()
  })

  it('shows submit button on step 7', async () => {
    const user = userEvent.setup()
    renderReadinessForm()

    await advanceToStep7(user)

    expect(
      screen.getByRole('button', { name: /Submit check-in/i }),
    ).toBeInTheDocument()
  })
})

describe('ReadinessForm — submission', () => {
  let capturedForm: UseFormReturn<ReadinessFormData> | null

  beforeEach(() => {
    capturedForm = null
  })

  function renderAtStep7() {
    render(
      <ReadinessForm
        initialStep={7}
        onFormReady={(form) => {
          capturedForm = form
        }}
      />,
    )
  }

  async function setAllFieldValues() {
    await act(async () => {
      capturedForm!.setValue('sleep_quality', 4, { shouldValidate: true })
      capturedForm!.setValue('fatigue', 2, { shouldValidate: true })
      capturedForm!.setValue('finger_health', 5, { shouldValidate: true })
      capturedForm!.setValue('shoulder_health', 5, { shouldValidate: true })
      capturedForm!.setValue('illness_flag', false, { shouldValidate: true })
      capturedForm!.setValue('life_stress', 2, { shouldValidate: true })
    })
  }

  async function submitForm() {
    await setAllFieldValues()
    const submitButton = screen.getByRole('button', { name: /Submit check-in/i })
    await userEvent.click(submitButton)
  }

  it('calls fetch with correct data on submit', async () => {
    renderAtStep7()
    await submitForm()

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/readiness',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      )
    })
  })

  it('shows success state after successful submission', async () => {
    renderAtStep7()
    await submitForm()

    await waitFor(() => expect(screen.getByText('Check-in complete')).toBeInTheDocument())
  })

  it('shows warnings after submission when returned', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: jest.fn().mockResolvedValue({
        data: { checkin: { id: 'test-id' }, warnings: ['🔴 ILLNESS FLAG ACTIVE'] },
        error: null,
      }),
    })

    renderAtStep7()
    await submitForm()

    await waitFor(() => expect(screen.getByText(/ILLNESS FLAG ACTIVE/)).toBeInTheDocument())
  })

  it('shows error message on 409 response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: jest.fn().mockResolvedValue({ data: null, error: 'Already checked in today' }),
    })

    renderAtStep7()
    await submitForm()

    await waitFor(() =>
      expect(screen.getByText(/already checked in today/i)).toBeInTheDocument(),
    )
  })

  it('shows error message on network failure', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    renderAtStep7()
    await submitForm()

    await waitFor(() => expect(screen.getByText(/Network error/i)).toBeInTheDocument())
  })

  it('calls onSuccess callback with warnings', async () => {
    const onSuccess = jest.fn()

    render(
      <ReadinessForm
        initialStep={7}
        onFormReady={(form) => {
          capturedForm = form
        }}
        onSuccess={onSuccess}
      />,
    )

    await submitForm()

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith([]))
  })
})

describe('ReadinessForm — illness flag', () => {
  it('shows illness toggle on step 6', async () => {
    const user = userEvent.setup()
    renderReadinessForm()

    // Advance through rating steps 1–5
    const ratingQuestions = [
      'How did you sleep?',
      'How is your body feeling?',
      'How are your fingers and tendons?',
      'How is your shoulder?',
      'How is life stress today?',
    ]
    for (const question of ratingQuestions) {
      await waitFor(() => expect(screen.getByText(question)).toBeInTheDocument())
      await selectRating(user)
    }

    await waitFor(() =>
      expect(screen.getByText('Any illness symptoms?')).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /No symptoms/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Yes — feeling ill/i })).toBeInTheDocument()
  })

  it('auto-advances after illness selection', async () => {
    const user = userEvent.setup()
    renderReadinessForm()

    // Advance through rating steps 1–5
    const ratingQuestions = [
      'How did you sleep?',
      'How is your body feeling?',
      'How are your fingers and tendons?',
      'How is your shoulder?',
      'How is life stress today?',
    ]
    for (const question of ratingQuestions) {
      await waitFor(() => expect(screen.getByText(question)).toBeInTheDocument())
      await selectRating(user)
    }

    await waitFor(() =>
      expect(screen.getByText('Any illness symptoms?')).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /No symptoms/i }))

    await waitFor(() =>
      expect(screen.getByText('Anything to tell your coach?')).toBeInTheDocument(),
    )
  })
})
