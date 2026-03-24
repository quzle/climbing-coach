import { type Control, type FieldErrors } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { AttemptList } from '@/components/forms/attempt-tracking/AttemptList'
import type { SessionLogFormData } from '@/components/forms/session-log-schema'
import type { ClimbingAttempt } from '@/types'

export type ClimbingFieldsProps = {
  control: Control<SessionLogFormData>
  sessionType: 'bouldering' | 'kilterboard' | 'lead'
  attempts: ClimbingAttempt[]
  onAddAttempt: (attempt: ClimbingAttempt) => void
  onRemoveAttempt: (index: number) => void
  errors: FieldErrors<SessionLogFormData>
}

/**
 * @description Additional fields for climbing session types (bouldering,
 * kilterboard, lead). Renders conditional fields based on `sessionType`:
 * rock type and pitch count for lead; board angle for kilterboard.
 * Includes the AttemptList for recording individual climbs.
 *
 * @param control RHF control from the parent useForm instance
 * @param sessionType Determines which optional fields are visible
 * @param attempts Current list of recorded attempts
 * @param onAddAttempt Callback to add a new attempt to parent state
 * @param onRemoveAttempt Callback to remove an attempt by index from parent state
 * @param errors RHF fieldErrors from the parent form state
 */
export function ClimbingFields({
  control,
  sessionType,
  attempts,
  onAddAttempt,
  onRemoveAttempt,
}: ClimbingFieldsProps): React.ReactElement {
  const isLead = sessionType === 'lead'
  const isKilterboard = sessionType === 'kilterboard'

  return (
    <div className="space-y-4">
      {/* Location */}
      <FormField
        control={control}
        name="location"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Location</FormLabel>
            <FormControl>
              <Input placeholder="Boulder World Geneva" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Location type */}
      <FormField
        control={control}
        name="location_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Setting</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select setting" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="gym">Gym</SelectItem>
                <SelectItem value="outdoor_single">Outdoor — single pitch</SelectItem>
                <SelectItem value="outdoor_multipitch">Outdoor — multipitch</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Rock type — lead only */}
      {isLead && (
        <FormField
          control={control}
          name="rock_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rock type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rock type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="limestone">Limestone</SelectItem>
                  <SelectItem value="granite">Granite</SelectItem>
                  <SelectItem value="sandstone">Sandstone</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Board angle — kilterboard only */}
      {isKilterboard && (
        <FormField
          control={control}
          name="angle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Board angle (degrees)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="40"
                  min={0}
                  max={70}
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

      {/* Pitch count — lead only */}
      {isLead && (
        <FormField
          control={control}
          name="pitch_count"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Number of pitches</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="3"
                  min={1}
                  max={20}
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

      {/* Attempts */}
      <AttemptList
        attempts={attempts}
        onAdd={onAddAttempt}
        onRemove={onRemoveAttempt}
      />
    </div>
  )
}
