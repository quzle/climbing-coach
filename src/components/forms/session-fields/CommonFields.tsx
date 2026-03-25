import { type Control, type FieldErrors } from 'react-hook-form'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { RatingSelector } from '@/components/forms/RatingSelector'
import { formatAreaName } from '@/components/forms/InjuryAreaSelector'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { SessionLogFormData } from '@/components/forms/session-log-schema'

export type CommonFieldsProps = {
  control: Control<SessionLogFormData>
  errors: FieldErrors<SessionLogFormData>
  /** Tracked injury area names to show as checkboxes. Pass from parent. */
  trackedAreas?: string[]
}

/**
 * @description Fields shared by every session type — date, duration, RPE,
 * quality rating, shoulder flag, and free-text notes. Renders inside an
 * existing RHF FormProvider context supplied by the parent SessionLogForm.
 *
 * @param control RHF control from the parent useForm instance
 * @param errors RHF fieldErrors from the parent form state
 */
export function CommonFields({ control, trackedAreas = [] }: CommonFieldsProps): React.ReactElement {
  return (
    <div className="space-y-4">
      {/* Date */}
      <FormField
        control={control}
        name="date"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Date</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Duration */}
      <FormField
        control={control}
        name="duration_mins"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Duration (minutes)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="90"
                min={1}
                max={480}
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

      {/* RPE slider */}
      <FormField
        control={control}
        name="rpe"
        render={({ field }) => {
          const current = field.value ?? 6
          return (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Effort (RPE)</FormLabel>
                <span className="text-sm text-slate-600">RPE: {current}/10</span>
              </div>
              <FormControl>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={[current]}
                  onValueChange={(values) => field.onChange(values[0])}
                />
              </FormControl>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Easy</span>
                <span className="text-xs text-slate-500">Maximum</span>
              </div>
              <FormMessage />
            </FormItem>
          )
        }}
      />

      {/* Quality rating */}
      <FormField
        control={control}
        name="quality_rating"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Session quality</FormLabel>
            <RatingSelector
              name="quality_rating"
              value={field.value ?? null}
              onChange={field.onChange}
              labels={['Poor', 'Below avg', 'Average', 'Good', 'Excellent']}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Injury flags */}
      <FormField
        control={control}
        name="injury_flags"
        render={({ field }) => {
          const currentFlags: string[] = field.value ?? []

          function toggleArea(area: string) {
            const next = currentFlags.includes(area)
              ? currentFlags.filter((a) => a !== area)
              : [...currentFlags, area]
            field.onChange(next)
          }

          return (
            <FormItem>
              <FormLabel>Any injury areas affected this session?</FormLabel>
              {trackedAreas.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No areas tracked. Add injury areas via your profile page.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {trackedAreas.map((area) => {
                    const flagged = currentFlags.includes(area)
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleArea(area)}
                        aria-pressed={flagged}
                        className={cn(
                          'min-h-[44px] px-3 rounded-lg border text-sm transition-colors',
                          flagged
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400',
                        )}
                      >
                        {formatAreaName(area)}
                      </button>
                    )
                  })}
                </div>
              )}
              {currentFlags.length > 0 && (
                <p className="text-sm text-amber-700">
                  {currentFlags.length} area{currentFlags.length > 1 ? 's' : ''} flagged — your coach will be notified
                </p>
              )}
              <FormMessage />
            </FormItem>
          )
        }}
      />

      {/* Notes */}
      <FormField
        control={control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Session notes</FormLabel>
            <FormControl>
              <Textarea
                placeholder="How did it feel? Key observations..."
                className="min-h-[80px]"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
