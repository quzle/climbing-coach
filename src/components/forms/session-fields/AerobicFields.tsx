'use client'

import { useWatch, type Control, type FieldErrors } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { cn } from '@/lib/utils'
import type { SessionLogFormData } from '@/components/forms/session-log-schema'
import type { AerobicLogData } from '@/types'

type Activity = AerobicLogData['activity']

const ACTIVITIES: { value: Activity; label: string }[] = [
  { value: 'hiking', label: '🥾 Hiking' },
  { value: 'ski_touring', label: '⛷ Ski touring' },
  { value: 'running', label: '🏃 Running' },
  { value: 'cycling', label: '🚴 Cycling' },
  { value: 'other', label: '🏃 Other' },
]

/** Activities for which elevation gain is relevant */
const ELEVATION_ACTIVITIES: Activity[] = ['hiking', 'ski_touring']

export type AerobicFieldsProps = {
  control: Control<SessionLogFormData>
  errors: FieldErrors<SessionLogFormData>
}

/**
 * @description Fields for aerobic / cross-training sessions. Activity type
 * is a large button selector managed via RHF. Elevation gain is conditionally
 * shown for hiking and ski touring only, reactively based on the watched
 * activity value.
 *
 * @param control RHF control from the parent useForm instance
 * @param errors RHF fieldErrors from the parent form state
 */
export function AerobicFields({ control }: AerobicFieldsProps): React.ReactElement {
  const activity = useWatch({ control, name: 'activity' })
  const showElevation = activity !== undefined && ELEVATION_ACTIVITIES.includes(activity)

  return (
    <div className="space-y-4">
      {/* Activity type — large button selector */}
      <FormField
        control={control}
        name="activity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Activity</FormLabel>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ACTIVITIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => field.onChange(value)}
                  className={cn(
                    'min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    field.value === value
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Elevation gain — hiking and ski touring only */}
      {showElevation && (
        <FormField
          control={control}
          name="elevation_gain_m"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Elevation gain (metres)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="1200"
                  min={0}
                  value={field.value ?? ''}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber
                    field.onChange(isNaN(v) ? undefined : v)
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  )
}
