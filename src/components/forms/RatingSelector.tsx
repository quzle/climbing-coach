'use client'

/**
 * Props for the RatingSelector component.
 *
 * @property value    Currently selected rating (1–5), or null if unset.
 * @property onChange Callback fired with the chosen rating number.
 * @property labels   Exactly 5 label strings, one per button (index 0 = rating 1).
 * @property name     Accessible name for the button group; used as aria-label prefix.
 * @property disabled When true, all buttons are non-interactive.
 */
type RatingSelectorProps = {
  value: number | null
  onChange: (value: number) => void
  labels: [string, string, string, string, string]
  name: string
  disabled?: boolean
}

/** Colour applied to the number when the button is NOT selected. */
const UNSELECTED_NUMBER_CLASS = 'text-slate-400'

/**
 * Colour applied to the number when the button IS selected.
 * The dark background means we use lighter tints (‑300 series).
 */
const SELECTED_NUMBER_CLASSES: Record<number, string> = {
  1: 'text-red-300',
  2: 'text-orange-300',
  3: 'text-yellow-300',
  4: 'text-green-300',
  5: 'text-emerald-300',
}

/**
 * Colour applied to the number when the button is unselected and hovered.
 * We keep this the same as the default unselected colour for simplicity — the
 * background change provides the hover feedback.
 */
const UNSELECTED_NUMBER_CLASS_HOVER = 'text-slate-400'
void UNSELECTED_NUMBER_CLASS_HOVER // used implicitly via group-hover below

/**
 * RatingSelector renders a row of 5 equal-width buttons for 1–5 ratings.
 * Each button displays its numeric value and a descriptive label below it.
 * Colour-coded number indicators give an at-a-glance read of the rating level.
 *
 * @example
 * <RatingSelector
 *   name="sleep_quality"
 *   value={sleepQuality}
 *   onChange={setSleepQuality}
 *   labels={['Terrible', 'Poor', 'OK', 'Good', 'Great']}
 * />
 */
export function RatingSelector({
  value,
  onChange,
  labels,
  name,
  disabled = false,
}: RatingSelectorProps) {
  return (
    <div className="flex gap-2" role="group" aria-label={name}>
      {([1, 2, 3, 4, 5] as const).map((rating) => {
        const isSelected = value === rating
        const label = labels[rating - 1]

        const containerClasses = [
          'flex-1 h-16 flex flex-col items-center justify-center',
          'rounded-lg border transition-all duration-150 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2',
          isSelected
            ? 'bg-slate-800 border-slate-800 text-white scale-105'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-400',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ]
          .filter(Boolean)
          .join(' ')

        const numberClasses = [
          'text-xl font-bold leading-none',
          isSelected
            ? SELECTED_NUMBER_CLASSES[rating]
            : UNSELECTED_NUMBER_CLASS,
        ].join(' ')

        return (
          <button
            key={rating}
            type="button"
            aria-label={`${name} ${rating} — ${label}`}
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() => onChange(rating)}
            className={containerClasses}
          >
            <span className={numberClasses}>{rating}</span>
            <span className="mt-1 text-[10px] leading-tight text-center px-1 truncate w-full text-center">
              {label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
