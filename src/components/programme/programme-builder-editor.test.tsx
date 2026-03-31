import React from 'react'
import { fireEvent, render, screen, waitFor } from '@/lib/test-utils'
import type { ProgrammeBuilderSnapshot } from '@/types'
import { ProgrammeBuilderEditor } from './programme-builder-editor'

const snapshot: ProgrammeBuilderSnapshot = {
  currentProgramme: {
    id: '9f9d2ebd-cd7c-4d2d-b1f8-a8fae1f019d1',
    created_at: '2026-03-25T10:00:00Z',
    goal: '7b onsight',
    name: 'Summer Season',
    notes: null,
    start_date: '2026-01-05',
    status: 'active',
    target_date: '2026-04-26',
    athlete_profile: null,
    user_id: 'user-1',
  },
  activeMesocycle: {
    id: '11711946-7ec0-4640-9f03-2be6ac3cd571',
    actual_end: null,
    actual_start: null,
    created_at: '2026-03-25T10:00:00Z',
    focus: 'Power focus',
    interruption_notes: null,
    name: 'Power Block',
    phase_type: 'power',
    planned_end: '2026-03-30',
    planned_start: '2026-03-03',
    programme_id: '9f9d2ebd-cd7c-4d2d-b1f8-a8fae1f019d1',
    status: 'active',
    user_id: 'user-1',
  },
  mesocycles: [],
  currentWeeklyTemplate: [
    {
      id: 'c42df97b-26a8-44f2-b923-2546f0f81116',
      day_of_week: 1,
      duration_mins: 90,
      intensity: 'high',
      mesocycle_id: '11711946-7ec0-4640-9f03-2be6ac3cd571',
      notes: null,
      primary_focus: 'Power',
      session_label: 'Limit Bouldering',
      session_type: 'bouldering',
      user_id: 'user-1',
    },
  ],
  upcomingPlannedSessions: [],
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ data: {}, error: null }),
  }) as jest.Mock
})

describe('ProgrammeBuilderEditor', () => {
  it('renders editor sections', () => {
    render(<ProgrammeBuilderEditor snapshot={snapshot} onSaved={async () => {}} />)

    expect(screen.getByText('Programme Builder')).toBeInTheDocument()
    expect(screen.getByText('Programme Settings')).toBeInTheDocument()
    expect(screen.getByText('Active Mesocycle')).toBeInTheDocument()
    expect(screen.getByText('Weekly Template Slot')).toBeInTheDocument()
  })

  it('submits programme update and triggers refresh callback', async () => {
    const onSaved = jest.fn().mockResolvedValue(undefined)
    render(<ProgrammeBuilderEditor snapshot={snapshot} onSaved={onSaved} />)

    fireEvent.change(screen.getByDisplayValue('Summer Season'), {
      target: { value: 'Updated Summer Season' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Programme' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/programmes/9f9d2ebd-cd7c-4d2d-b1f8-a8fae1f019d1',
        expect.objectContaining({ method: 'PUT' }),
      )
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('creates a programme when no active programme exists', async () => {
    const onSaved = jest.fn().mockResolvedValue(undefined)
    render(
      <ProgrammeBuilderEditor
        snapshot={{ ...snapshot, currentProgramme: null, activeMesocycle: null, currentWeeklyTemplate: [] }}
        onSaved={onSaved}
      />,
    )

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New Season' },
    })
    fireEvent.change(screen.getByLabelText('Goal'), {
      target: { value: 'Build a first programme' },
    })
    fireEvent.change(screen.getByLabelText('Start Date'), {
      target: { value: '2026-01-05' },
    })
    fireEvent.change(screen.getByLabelText('Target Date'), {
      target: { value: '2026-04-26' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create Programme' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/programmes',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })
})
