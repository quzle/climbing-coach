'use client'

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
import type { ClimbingAttempt } from '@/types'

// =============================================================================
// SCHEMA
// =============================================================================

const attemptSchema = z.object({
  grade: z.string().min(1, 'Grade is required').max(10, 'Grade too long'),
  style: z.enum(['vertical', 'slab', 'overhang', 'roof']),
  hold_type: z.enum(['crimp', 'sloper', 'pinch', 'pocket', 'jug']),
  result: z.enum(['flash', 'send', 'multiple_attempts', 'project']),
  attempt_number: z.number().int().positive().optional(),
  notes: z.string().max(200).optional(),
})

type AttemptFormData = z.infer<typeof attemptSchema>

// =============================================================================
// COMPONENT
// =============================================================================

export type AttemptFormProps = {
  onAdd: (attempt: ClimbingAttempt) => void
  onCancel: () => void
}

/**
 * @description Compact inline form for recording a single climbing attempt.
 * Validates with Zod, calls `onAdd` on valid submit, then resets.
 *
 * @param onAdd Callback invoked with the validated attempt data
 * @param onCancel Callback invoked when the user dismisses the form
 */
export function AttemptForm({ onAdd, onCancel }: AttemptFormProps): React.ReactElement {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AttemptFormData>({
    resolver: zodResolver(attemptSchema),
    defaultValues: {
      style: 'vertical',
      hold_type: 'crimp',
      result: 'send',
    },
  })

  function onSubmit(data: AttemptFormData): void {
    onAdd(data as ClimbingAttempt)
    reset()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border rounded-lg p-3 bg-slate-50 space-y-3"
    >
      {/* Row 1: Grade + Result */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="attempt-grade" className="text-xs">
            Grade
          </Label>
          <Input
            id="attempt-grade"
            placeholder="e.g. 7a, 6c+"
            className="h-9 text-sm"
            {...register('grade')}
          />
          {errors.grade && (
            <p className="text-xs text-red-500">{errors.grade.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="attempt-result" className="text-xs">
            Result
          </Label>
          <Select
            defaultValue="send"
            onValueChange={(val) =>
              setValue('result', val as AttemptFormData['result'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id="attempt-result" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flash">⚡ Flash</SelectItem>
              <SelectItem value="send">✅ Send</SelectItem>
              <SelectItem value="multiple_attempts">🔄 Multiple attempts</SelectItem>
              <SelectItem value="project">📌 Project (no send)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Style + Hold type */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="attempt-style" className="text-xs">
            Style
          </Label>
          <Select
            defaultValue="vertical"
            onValueChange={(val) =>
              setValue('style', val as AttemptFormData['style'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id="attempt-style" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vertical">Vertical</SelectItem>
              <SelectItem value="slab">Slab</SelectItem>
              <SelectItem value="overhang">Overhang</SelectItem>
              <SelectItem value="roof">Roof</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="attempt-hold-type" className="text-xs">
            Hold type
          </Label>
          <Select
            defaultValue="crimp"
            onValueChange={(val) =>
              setValue('hold_type', val as AttemptFormData['hold_type'], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger id="attempt-hold-type" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="crimp">Crimp</SelectItem>
              <SelectItem value="sloper">Sloper</SelectItem>
              <SelectItem value="pinch">Pinch</SelectItem>
              <SelectItem value="pocket">Pocket</SelectItem>
              <SelectItem value="jug">Jug</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 3: Notes */}
      <div className="space-y-1">
        <Label htmlFor="attempt-notes" className="text-xs">
          Notes <span className="text-slate-400">(optional)</span>
        </Label>
        <Input
          id="attempt-notes"
          placeholder="Crux move, beta notes..."
          className="h-9 text-sm"
          {...register('notes')}
        />
        {errors.notes && (
          <p className="text-xs text-red-500">{errors.notes.message}</p>
        )}
      </div>

      {/* Row 4: Actions */}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1">
          Add attempt
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex-1"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
