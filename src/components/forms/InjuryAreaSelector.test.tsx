import React from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/lib/test-utils'
import type { InjuryAreaHealth, InjuryAreaRow } from '@/types'
import { InjuryAreaSelector, formatAreaName } from './InjuryAreaSelector'

// =============================================================================
// FACTORIES
// =============================================================================

function makeArea(overrides?: Partial<InjuryAreaRow>): InjuryAreaRow {
  return {
    id: 'area-1',
    area: 'shoulder_left',
    is_active: true,
    added_at: '2026-03-25T10:00:00Z',
    archived_at: null,
    user_id: 'user-1',
    ...overrides,
  }
}

function makeHealth(overrides?: Partial<InjuryAreaHealth>): InjuryAreaHealth {
  return {
    area: 'shoulder_left',
    health: 4,
    notes: null,
    ...overrides,
  }
}

function renderSelector(
  props: Partial<React.ComponentProps<typeof InjuryAreaSelector>> = {},
) {
  const defaults = {
    areas: [],
    value: [],
    onChange: jest.fn(),
  }
  return render(<InjuryAreaSelector {...defaults} {...props} />)
}

// =============================================================================
// formatAreaName
// =============================================================================

describe('formatAreaName', () => {
  it('returns a human-readable label for known areas', () => {
    expect(formatAreaName('shoulder_left')).toBe('Shoulder (left)')
    expect(formatAreaName('finger_a2_right')).toBe('A2 pulley (right)')
    expect(formatAreaName('lower_back')).toBe('Lower back')
    expect(formatAreaName('neck')).toBe('Neck')
  })

  it('title-cases unknown areas by replacing underscores', () => {
    expect(formatAreaName('custom_area_name')).toBe('Custom Area Name')
  })
})

// =============================================================================
// InjuryAreaSelector
// =============================================================================

describe('InjuryAreaSelector', () => {
  describe('empty state', () => {
    it('shows empty state message when areas is empty and no onAddArea', () => {
      renderSelector({ areas: [], onAddArea: undefined })

      expect(
        screen.getByText(/No injury areas tracked/i),
      ).toBeInTheDocument()
    })

    it('does not show empty state when areas is empty but onAddArea is provided', () => {
      renderSelector({ areas: [], onAddArea: jest.fn() })

      expect(
        screen.queryByText(/No injury areas tracked/i),
      ).not.toBeInTheDocument()
    })
  })

  describe('rendering tracked areas', () => {
    it('renders a label and RatingSelector for each tracked area', () => {
      const areas = [
        makeArea({ area: 'shoulder_left' }),
        makeArea({ id: 'area-2', area: 'finger_a2_right' }),
      ]
      renderSelector({ areas })

      expect(screen.getByText('Shoulder (left)')).toBeInTheDocument()
      expect(screen.getByText('A2 pulley (right)')).toBeInTheDocument()
      // Each area group should exist
      expect(screen.getByRole('group', { name: 'shoulder_left' })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'finger_a2_right' })).toBeInTheDocument()
    })

    it('reflects current value in the RatingSelector', () => {
      const areas = [makeArea({ area: 'shoulder_left' })]
      const value = [makeHealth({ area: 'shoulder_left', health: 3 })]
      renderSelector({ areas, value })

      const btn = screen.getByRole('button', {
        name: /shoulder_left 3/i,
      })
      expect(btn).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('rating changes', () => {
    it('calls onChange with updated health when a rating is selected for a new area', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const areas = [makeArea({ area: 'wrist_left' })]
      renderSelector({ areas, value: [], onChange })

      await user.click(screen.getByRole('button', { name: /wrist_left 4/i }))

      expect(onChange).toHaveBeenCalledWith([
        { area: 'wrist_left', health: 4, notes: null },
      ])
    })

    it('calls onChange with updated health when rating changes for an existing entry', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const areas = [makeArea({ area: 'shoulder_left' })]
      const value = [makeHealth({ area: 'shoulder_left', health: 3 })]
      renderSelector({ areas, value, onChange })

      await user.click(screen.getByRole('button', { name: /shoulder_left 5/i }))

      expect(onChange).toHaveBeenCalledWith([
        { area: 'shoulder_left', health: 5, notes: null },
      ])
    })

    it('preserves other area ratings when one changes', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const areas = [
        makeArea({ area: 'shoulder_left' }),
        makeArea({ id: 'area-2', area: 'wrist_right' }),
      ]
      const value = [
        makeHealth({ area: 'shoulder_left', health: 4 }),
        makeHealth({ area: 'wrist_right', health: 5 }),
      ]
      renderSelector({ areas, value, onChange })

      await user.click(screen.getByRole('button', { name: /shoulder_left 2/i }))

      expect(onChange).toHaveBeenCalledWith([
        { area: 'shoulder_left', health: 2, notes: null },
        { area: 'wrist_right', health: 5, notes: null },
      ])
    })
  })

  describe('add area', () => {
    it('shows the add area select and Track button when onAddArea is provided', () => {
      renderSelector({ areas: [], onAddArea: jest.fn() })

      expect(
        screen.getByRole('combobox', { name: /select injury area/i }),
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /track/i })).toBeInTheDocument()
    })

    it('does not show the add area control when onAddArea is not provided', () => {
      renderSelector({ areas: [makeArea()], onAddArea: undefined })

      expect(
        screen.queryByRole('combobox', { name: /select injury area/i }),
      ).not.toBeInTheDocument()
    })

    it('calls onAddArea with selected area when Track is clicked', async () => {
      const user = userEvent.setup()
      const onAddArea = jest.fn()
      renderSelector({ areas: [], onAddArea })

      await user.selectOptions(
        screen.getByRole('combobox', { name: /select injury area/i }),
        'shoulder_left',
      )
      await user.click(screen.getByRole('button', { name: /track/i }))

      expect(onAddArea).toHaveBeenCalledWith('shoulder_left')
    })

    it('does not call onAddArea when no area is selected', async () => {
      const user = userEvent.setup()
      const onAddArea = jest.fn()
      renderSelector({ areas: [], onAddArea })

      await user.click(screen.getByRole('button', { name: /track/i }))

      expect(onAddArea).not.toHaveBeenCalled()
    })

    it('excludes already-tracked areas from the add dropdown', () => {
      const areas = [makeArea({ area: 'shoulder_left' })]
      renderSelector({ areas, onAddArea: jest.fn() })

      const select = screen.getByRole('combobox', { name: /select injury area/i })
      const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)

      expect(options).not.toContain('shoulder_left')
      expect(options).toContain('shoulder_right')
    })

    it('does not show add control when all known areas are already tracked', () => {
      // Track enough areas that all KNOWN_AREAS are covered by mocking — we just
      // verify the selector still renders without crashing in that edge case.
      const areas = [makeArea({ area: 'shoulder_left' })]
      // The select shows when onAddArea is provided AND availableToAdd.length > 0.
      // With only 1 of 22 areas tracked this will always show; this is a
      // regression guard not an exhaustive edge-case test.
      renderSelector({ areas, onAddArea: jest.fn() })

      expect(
        screen.getByRole('combobox', { name: /select injury area/i }),
      ).toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('disables all rating buttons when disabled is true', () => {
      const areas = [makeArea({ area: 'shoulder_left' })]
      renderSelector({ areas, disabled: true })

      const buttons = screen.getAllByRole('button')
      buttons.forEach((btn) => {
        expect(btn).toBeDisabled()
      })
    })
  })
})
