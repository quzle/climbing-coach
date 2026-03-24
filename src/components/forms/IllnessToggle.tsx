'use client'

/**
 * Props for the IllnessToggle component.
 *
 * @property value    Current illness flag state — true means the athlete is
 *                    feeling ill.
 * @property onChange Callback fired with the new boolean value when a button
 *                    is pressed.
 * @property disabled When true, both buttons are non-interactive.
 */
type IllnessToggleProps = {
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

/**
 * IllnessToggle renders a prominent two-button Yes/No control for the illness
 * flag. It is intentionally larger and more visually distinct than the
 * RatingSelector buttons because this is a critical safety input — a flagged
 * illness should pause high-intensity training.
 *
 * @example
 * <IllnessToggle
 *   value={illnessFlag}
 *   onChange={setIllnessFlag}
 * />
 */
export function IllnessToggle({ value, onChange, disabled = false }: IllnessToggleProps) {
  const baseClasses =
    'flex-1 h-16 flex items-center justify-center gap-2 rounded-lg border-2 font-medium text-sm transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

  const noSelected = !value
  const yesSelected = value

  const noClasses = [
    baseClasses,
    noSelected
      ? 'bg-emerald-600 text-white border-emerald-600'
      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-400',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const yesClasses = [
    baseClasses,
    yesSelected
      ? 'bg-red-600 text-white border-red-600'
      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-400',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex gap-2" role="group" aria-label="Illness flag">
      <button
        type="button"
        aria-pressed={noSelected}
        aria-label="No symptoms — not feeling ill"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={noClasses}
      >
        {noSelected && <span aria-hidden="true">✓</span>}
        <span>No symptoms</span>
      </button>

      <button
        type="button"
        aria-pressed={yesSelected}
        aria-label="Yes — feeling ill"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={yesClasses}
      >
        {yesSelected && <span aria-hidden="true">⚠</span>}
        <span>Yes — feeling ill</span>
      </button>
    </div>
  )
}
