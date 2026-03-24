/**
 * Props for the WarningBanner component.
 *
 * @property warnings   Array of warning strings returned from the AI coach API.
 *                      Strings are expected to be prefixed with 🔴, 🟡, or ⚪
 *                      to indicate severity.
 * @property onDismiss  Optional callback to dismiss the banner. When provided,
 *                      an × button is rendered in the top-right corner.
 * @property className  Optional extra Tailwind classes applied to the container.
 */
type WarningBannerProps = {
  warnings: string[]
  onDismiss?: () => void
  className?: string
}

/**
 * WarningBanner displays coach warnings returned from the readiness or chat
 * API. The banner colour and title adapt to the highest severity warning
 * present:
 *
 * - Any 🔴 (critical) warning → red banner with "⚠️ Coach Alert"
 * - Only 🟡 / ⚪ warnings     → amber banner with "📋 Coach Notes"
 *
 * Returns null when the warnings array is empty so callers can render it
 * unconditionally without wrapping it in a conditional.
 *
 * @example
 * <WarningBanner
 *   warnings={context.warnings}
 *   onDismiss={() => setWarnings([])}
 * />
 */
export function WarningBanner({ warnings, onDismiss, className = '' }: WarningBannerProps) {
  if (warnings.length === 0) {
    return null
  }

  const hasCritical = warnings.some((w) => w.startsWith('🔴'))

  const containerClasses = hasCritical
    ? 'bg-red-50 border border-red-200 rounded-lg p-4'
    : 'bg-amber-50 border border-amber-200 rounded-lg p-4'

  const titleClasses = hasCritical
    ? 'text-red-800 font-semibold text-sm'
    : 'text-amber-800 font-semibold text-sm'

  const title = hasCritical ? '⚠️ Coach Alert' : '📋 Coach Notes'

  return (
    <div className={`${containerClasses} ${className}`.trim()}>
      <div className="flex items-start justify-between gap-2">
        <p className={titleClasses}>{title}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss warnings"
            className="text-slate-400 hover:text-slate-600 transition-colors leading-none"
          >
            ×
          </button>
        )}
      </div>
      <div className="mt-2 space-y-0.5">
        {warnings.map((warning, index) => (
          <p key={index} className="text-sm text-slate-700 py-1">
            {warning}
          </p>
        ))}
      </div>
    </div>
  )
}
