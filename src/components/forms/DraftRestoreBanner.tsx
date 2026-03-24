import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import type { SessionDraft } from '@/hooks/useDraftSession'

// =============================================================================
// HELPERS
// =============================================================================

/**
 * @description Formats a draft's `lastSaved` ISO timestamp into a
 * human-readable string relative to today.
 *
 * @param isoTimestamp ISO 8601 timestamp string
 * @returns e.g. "today at 14:32" or "yesterday at 09:05"
 */
function formatLastSaved(isoTimestamp: string): string {
  const date = parseISO(isoTimestamp)
  const time = format(date, 'HH:mm')

  if (isToday(date)) return `today at ${time}`
  if (isYesterday(date)) return `yesterday at ${time}`
  return `${format(date, 'd MMM')} at ${time}`
}

const SESSION_TYPE_LABELS: Partial<Record<NonNullable<SessionDraft['sessionType']>, string>> = {
  bouldering: 'Bouldering',
  kilterboard: 'Kilterboard',
  lead: 'Lead / Multipitch',
  fingerboard: 'Fingerboard',
  strength: 'Strength',
  aerobic: 'Aerobic',
  rest: 'Rest',
  mobility: 'Mobility',
}

// =============================================================================
// PROPS
// =============================================================================

export type DraftRestoreBannerProps = {
  draft: SessionDraft
  onRestore: () => void
  onDiscard: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * @description Displayed at the top of the session log form when a saved
 * draft is detected. Presents the draft's age and a brief summary, then
 * lets the user choose to restore or discard it.
 *
 * Presentational — all interaction is delegated to `onRestore`/`onDiscard`.
 *
 * @param draft The detected draft from useDraftSession
 * @param onRestore Called when the user taps "Restore session"
 * @param onDiscard Called when the user taps "Start fresh"
 */
export function DraftRestoreBanner({
  draft,
  onRestore,
  onDiscard,
}: DraftRestoreBannerProps): React.ReactElement {
  const typeLabel =
    draft.sessionType !== null
      ? SESSION_TYPE_LABELS[draft.sessionType]
      : null

  const attemptCount = draft.attempts.length

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex items-start justify-between gap-4">
      {/* Left side */}
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-xl shrink-0" aria-hidden="true">📋</span>

        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            Unsaved session found
          </p>
          <p className="text-xs text-amber-600">
            From {formatLastSaved(draft.lastSaved)}
          </p>

          {typeLabel !== null && (
            <span className="inline-block text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
              {typeLabel} session
            </span>
          )}

          {attemptCount > 0 && (
            <p className="text-xs text-amber-600">
              {attemptCount} attempt{attemptCount !== 1 ? 's' : ''} logged
            </p>
          )}
        </div>
      </div>

      {/* Right side: actions */}
      <div className="flex flex-col gap-2 shrink-0">
        <Button size="sm" onClick={onRestore}>
          Restore session
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-amber-700 hover:text-amber-800 hover:bg-amber-100"
          onClick={onDiscard}
        >
          Start fresh
        </Button>
      </div>
    </div>
  )
}
