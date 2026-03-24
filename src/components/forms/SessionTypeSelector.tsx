'use client'

import type { SessionType } from '@/types'

/**
 * Configuration for a single session type card.
 */
type SessionTypeCard = {
  type: SessionType
  icon: string
  label: string
  subLabel: string
}

const SESSION_TYPE_CARDS: SessionTypeCard[] = [
  { type: 'bouldering',  icon: '🧗', label: 'Bouldering',      subLabel: 'Gym or outdoor'      },
  { type: 'kilterboard', icon: '🏔', label: 'Kilterboard',     subLabel: 'Board session'        },
  { type: 'lead',        icon: '🪨', label: 'Lead / Multipitch', subLabel: 'Routes'             },
  { type: 'fingerboard', icon: '🤲', label: 'Fingerboard',     subLabel: 'Hangboard'            },
  { type: 'strength',    icon: '💪', label: 'Strength',        subLabel: 'Antagonist training'  },
  { type: 'aerobic',     icon: '🥾', label: 'Aerobic',         subLabel: 'Hiking / ski touring' },
]

export type SessionTypeSelectorProps = {
  onSelect: (type: SessionType) => void
  defaultType?: SessionType
}

/**
 * @description Stage 1 of the session log flow. Renders a 2-column grid of
 * card-style buttons — one per loggable session type. Calls `onSelect`
 * immediately on tap/click; no confirmation step.
 *
 * @param onSelect Callback invoked with the chosen SessionType
 * @param defaultType When provided, that card is rendered in the selected
 *   style on initial mount
 */
export function SessionTypeSelector({ onSelect, defaultType }: SessionTypeSelectorProps): React.ReactElement {
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-6 text-center">
        What type of session?
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {SESSION_TYPE_CARDS.map(({ type, icon, label, subLabel }) => {
          const isSelected = defaultType === type

          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className={[
                'min-h-[100px] rounded-xl border-2 p-4',
                'flex flex-col items-center justify-center gap-2',
                'cursor-pointer transition-all duration-150',
                'hover:border-slate-400 hover:bg-slate-50',
                'active:scale-95',
                isSelected
                  ? 'border-slate-800 bg-slate-50'
                  : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              <span className="text-3xl" aria-hidden="true">{icon}</span>
              <span className="font-medium text-sm text-slate-800">{label}</span>
              <span className="text-xs text-slate-500">{subLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
