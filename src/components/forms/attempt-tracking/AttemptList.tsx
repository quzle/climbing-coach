'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AttemptForm } from './AttemptForm'
import type { ClimbingAttempt } from '@/types'

// =============================================================================
// HELPERS
// =============================================================================

const RESULT_LABELS: Record<ClimbingAttempt['result'], string> = {
  flash: '⚡ Flash',
  send: '✅ Send',
  multiple_attempts: '🔄 Multiple attempts',
  project: '📌 Project',
}

const STYLE_LABELS: Record<ClimbingAttempt['style'], string> = {
  vertical: 'Vertical',
  slab: 'Slab',
  overhang: 'Overhang',
  roof: 'Roof',
}

const HOLD_LABELS: Record<ClimbingAttempt['hold_type'], string> = {
  crimp: 'Crimp',
  sloper: 'Sloper',
  pinch: 'Pinch',
  pocket: 'Pocket',
  jug: 'Jug',
}

// =============================================================================
// COMPONENT
// =============================================================================

export type AttemptListProps = {
  attempts: ClimbingAttempt[]
  onAdd: (attempt: ClimbingAttempt) => void
  onRemove: (index: number) => void
  /** Maximum number of attempts allowed. Defaults to 20. */
  maxAttempts?: number
}

/**
 * @description Displays the running list of climbing attempts and the inline
 * add-attempt form. The form is shown/hidden via local state — the parent
 * remains the source of truth for the attempts array.
 *
 * @param attempts Current list of attempts
 * @param onAdd Callback invoked when a new attempt is submitted
 * @param onRemove Callback invoked with the index of the attempt to remove
 * @param maxAttempts Upper limit on attempts (default 20). Disables the add
 *   button once reached.
 */
export function AttemptList({
  attempts,
  onAdd,
  onRemove,
  maxAttempts = 20,
}: AttemptListProps): React.ReactElement {
  const [showForm, setShowForm] = useState(false)

  const atMax = attempts.length >= maxAttempts

  function handleAdd(attempt: ClimbingAttempt): void {
    onAdd(attempt)
    setShowForm(false)
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-700">Attempts</span>
        <span className="text-xs bg-slate-100 rounded-full px-2 py-0.5 text-slate-600">
          {attempts.length} logged
        </span>
      </div>

      {/* Attempts list */}
      {attempts.length > 0 && (
        <div>
          {attempts.map((attempt, index) => (
            <div
              key={index}
              className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0"
            >
              {/* Left: grade + result */}
              <div className="flex flex-col gap-0.5">
                <span className="text-slate-900 font-semibold text-sm">
                  {attempt.grade}
                </span>
                <span className="text-sm text-slate-600">
                  {RESULT_LABELS[attempt.result]}
                </span>
              </div>

              {/* Right: style · hold type + remove */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {STYLE_LABELS[attempt.style]} · {HOLD_LABELS[attempt.hold_type]}
                </span>
                <button
                  type="button"
                  aria-label={`Remove attempt ${index + 1}`}
                  onClick={() => onRemove(index)}
                  className="text-slate-400 hover:text-red-500 transition-colors text-base leading-none"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add attempt section */}
      {showForm ? (
        <AttemptForm
          onAdd={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={atMax}
          onClick={() => setShowForm(true)}
        >
          {atMax ? `Maximum ${maxAttempts} attempts` : '＋ Add attempt'}
        </Button>
      )}
    </div>
  )
}
