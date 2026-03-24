'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { FingerboardSet } from '@/types'

// =============================================================================
// TYPES
// =============================================================================

type Protocol = 'max_hangs' | 'repeaters' | 'density' | 'other'

const PROTOCOLS: { value: Protocol; label: string }[] = [
  { value: 'max_hangs', label: 'Max hangs' },
  { value: 'repeaters', label: 'Repeaters' },
  { value: 'density', label: 'Density' },
  { value: 'other', label: 'Other' },
]

// =============================================================================
// INLINE SET FORM SCHEMA
// =============================================================================

const setSchema = z.object({
  edge_mm: z.number().int().positive('Edge size required'),
  grip: z.enum(['half_crimp', 'open_hand', 'full_crimp', 'pinch']),
  hang_duration_s: z.number().int().positive('Hang duration required'),
  rest_s: z.number().int().positive('Rest required'),
  reps: z.number().int().positive('Reps required'),
  added_weight_kg: z.number(),
})

type SetFormData = z.infer<typeof setSchema>

// =============================================================================
// INLINE SET FORM
// =============================================================================

type SetFormProps = {
  onAdd: (set: FingerboardSet) => void
  onCancel: () => void
}

function SetForm({ onAdd, onCancel }: SetFormProps): React.ReactElement {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SetFormData>({
    resolver: zodResolver(setSchema),
    defaultValues: {
      grip: 'half_crimp',
      added_weight_kg: 0,
    },
  })

  function onSubmit(data: SetFormData): void {
    onAdd(data as FingerboardSet)
    reset()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border rounded-lg p-3 bg-slate-50 space-y-3"
    >
      <div className="grid grid-cols-2 gap-2">
        {/* Edge size */}
        <div className="space-y-1">
          <Label className="text-xs">Edge size (mm)</Label>
          <Input
            type="number"
            placeholder="20"
            className="h-9 text-sm"
            {...register('edge_mm', { valueAsNumber: true })}
          />
          {errors.edge_mm && (
            <p className="text-xs text-red-500">{errors.edge_mm.message}</p>
          )}
        </div>

        {/* Grip */}
        <div className="space-y-1">
          <Label className="text-xs">Grip</Label>
          <Select
            defaultValue="half_crimp"
            onValueChange={(val) =>
              setValue('grip', val as SetFormData['grip'], { shouldValidate: true })
            }
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="half_crimp">Half crimp</SelectItem>
              <SelectItem value="open_hand">Open hand</SelectItem>
              <SelectItem value="full_crimp">Full crimp</SelectItem>
              <SelectItem value="pinch">Pinch</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Hang duration */}
        <div className="space-y-1">
          <Label className="text-xs">Hang (s)</Label>
          <Input
            type="number"
            placeholder="7"
            className="h-9 text-sm"
            {...register('hang_duration_s', { valueAsNumber: true })}
          />
          {errors.hang_duration_s && (
            <p className="text-xs text-red-500">{errors.hang_duration_s.message}</p>
          )}
        </div>

        {/* Rest */}
        <div className="space-y-1">
          <Label className="text-xs">Rest (s)</Label>
          <Input
            type="number"
            placeholder="180"
            className="h-9 text-sm"
            {...register('rest_s', { valueAsNumber: true })}
          />
          {errors.rest_s && (
            <p className="text-xs text-red-500">{errors.rest_s.message}</p>
          )}
        </div>

        {/* Reps */}
        <div className="space-y-1">
          <Label className="text-xs">Reps</Label>
          <Input
            type="number"
            placeholder="6"
            className="h-9 text-sm"
            {...register('reps', { valueAsNumber: true })}
          />
          {errors.reps && (
            <p className="text-xs text-red-500">{errors.reps.message}</p>
          )}
        </div>
      </div>

      {/* Added weight */}
      <div className="space-y-1">
        <Label className="text-xs">Added weight (kg)</Label>
        <Input
          type="number"
          placeholder="0"
          className="h-9 text-sm"
          {...register('added_weight_kg', { valueAsNumber: true })}
        />
        <p className="text-xs text-slate-500">
          Use negative for assisted (e.g. -5)
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1">
          Add set
        </Button>
        <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export type FingerboardFieldsProps = {
  sets: FingerboardSet[]
  onAddSet: (set: FingerboardSet) => void
  onRemoveSet: (index: number) => void
  /** Called immediately when the user changes the protocol selection. */
  onProtocolChange?: (protocol: Protocol) => void
}

const GRIP_LABELS: Record<FingerboardSet['grip'], string> = {
  half_crimp: 'Half crimp',
  open_hand: 'Open hand',
  full_crimp: 'Full crimp',
  pinch: 'Pinch',
}

/**
 * @description Fields for fingerboard sessions. Protocol selection is managed
 * in local state (not RHF) since sets are tracked outside the main form.
 * Note: the selected protocol must be surfaced to the parent on submission.
 *
 * @param sets Current list of sets from parent state
 * @param onAddSet Callback to add a set to parent state
 * @param onRemoveSet Callback to remove a set by index from parent state
 */
export function FingerboardFields({
  sets,
  onAddSet,
  onRemoveSet,
  onProtocolChange,
}: FingerboardFieldsProps): React.ReactElement {
  const [protocol, setProtocol] = useState<Protocol>('max_hangs')
  const [showSetForm, setShowSetForm] = useState(false)

  function handleAddSet(set: FingerboardSet): void {
    onAddSet(set)
    setShowSetForm(false)
  }

  return (
    <div className="space-y-4">
      {/* Protocol selector */}
      <div className="space-y-2">
        <Label className="font-medium text-slate-700">Protocol</Label>
        <div className="flex gap-2">
          {PROTOCOLS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setProtocol(value); onProtocolChange?.(value) }}
              className={cn(
                'flex-1 min-h-[44px] rounded-lg border text-sm font-medium transition-colors',
                protocol === value
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sets section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-700">Sets</span>
          <span className="text-xs bg-slate-100 rounded-full px-2 py-0.5 text-slate-600">
            {sets.length} logged
          </span>
        </div>

        {sets.length > 0 && (
          <div>
            {sets.map((set, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0"
              >
                <div className="space-y-0.5">
                  <span className="text-sm font-medium text-slate-900">
                    Edge: {set.edge_mm}mm &nbsp;·&nbsp; Grip: {GRIP_LABELS[set.grip]}
                  </span>
                  <p className="text-xs text-slate-500">
                    {set.hang_duration_s}s hang · {set.rest_s}s rest · {set.reps} reps
                    &nbsp;·&nbsp;
                    {set.added_weight_kg === 0
                      ? 'BW'
                      : set.added_weight_kg > 0
                        ? `+${set.added_weight_kg}kg`
                        : `${set.added_weight_kg}kg`}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove set ${index + 1}`}
                  onClick={() => onRemoveSet(index)}
                  className="text-slate-400 hover:text-red-500 transition-colors text-base leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {showSetForm ? (
          <SetForm onAdd={handleAddSet} onCancel={() => setShowSetForm(false)} />
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setShowSetForm(true)}
          >
            ＋ Add set
          </Button>
        )}
      </div>
    </div>
  )
}
