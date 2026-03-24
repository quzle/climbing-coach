'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { type Control, type FieldErrors } from 'react-hook-form'
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
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { SessionLogFormData } from '@/components/forms/session-log-schema'
import type { StrengthExercise } from '@/types'

// =============================================================================
// INLINE EXERCISE FORM
// =============================================================================

const exerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name required').max(100),
  sets: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(50),
  weight_kg: z.number().min(0).max(200),
  notes: z.string().max(200).optional(),
})

type ExerciseFormData = z.infer<typeof exerciseSchema>

type ExerciseFormProps = {
  onAdd: (exercise: StrengthExercise) => void
  onCancel: () => void
}

function ExerciseForm({ onAdd, onCancel }: ExerciseFormProps): React.ReactElement {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExerciseFormData>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: { weight_kg: 0 },
  })

  function onSubmit(data: ExerciseFormData): void {
    onAdd(data as StrengthExercise)
    reset()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="border rounded-lg p-3 bg-slate-50 space-y-3"
    >
      {/* Exercise name */}
      <div className="space-y-1">
        <Label className="text-xs">Exercise name</Label>
        <Input
          placeholder="Face pulls, reverse wrist curls..."
          className="h-9 text-sm"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Sets */}
        <div className="space-y-1">
          <Label className="text-xs">Sets</Label>
          <Input
            type="number"
            placeholder="3"
            min={1}
            max={10}
            className="h-9 text-sm"
            {...register('sets', { valueAsNumber: true })}
          />
          {errors.sets && (
            <p className="text-xs text-red-500">{errors.sets.message}</p>
          )}
        </div>

        {/* Reps */}
        <div className="space-y-1">
          <Label className="text-xs">Reps</Label>
          <Input
            type="number"
            placeholder="12"
            min={1}
            max={50}
            className="h-9 text-sm"
            {...register('reps', { valueAsNumber: true })}
          />
          {errors.reps && (
            <p className="text-xs text-red-500">{errors.reps.message}</p>
          )}
        </div>

        {/* Weight */}
        <div className="space-y-1">
          <Label className="text-xs">Weight (kg)</Label>
          <Input
            type="number"
            placeholder="0"
            min={0}
            max={200}
            className="h-9 text-sm"
            {...register('weight_kg', { valueAsNumber: true })}
          />
          {errors.weight_kg && (
            <p className="text-xs text-red-500">{errors.weight_kg.message}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label className="text-xs">Notes <span className="text-slate-400">(optional)</span></Label>
        <Input
          placeholder="Tempo, form cues..."
          className="h-9 text-sm"
          {...register('notes')}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1">
          Add exercise
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

export type StrengthFieldsProps = {
  exercises: StrengthExercise[]
  onAddExercise: (exercise: StrengthExercise) => void
  onRemoveExercise: (index: number) => void
  control: Control<SessionLogFormData>
  errors: FieldErrors<SessionLogFormData>
}

/**
 * @description Fields for strength and conditioning sessions. Focus area is
 * managed via RHF (control prop). The exercises list is managed in parent
 * state and passed as a prop.
 *
 * @param exercises Current list of exercises from parent state
 * @param onAddExercise Callback to add an exercise to parent state
 * @param onRemoveExercise Callback to remove an exercise by index from parent state
 * @param control RHF control from the parent useForm instance
 * @param errors RHF fieldErrors from the parent form state
 */
export function StrengthFields({
  exercises,
  onAddExercise,
  onRemoveExercise,
  control,
}: StrengthFieldsProps): React.ReactElement {
  const [showExerciseForm, setShowExerciseForm] = useState(false)

  function handleAddExercise(exercise: StrengthExercise): void {
    onAddExercise(exercise)
    setShowExerciseForm(false)
  }

  return (
    <div className="space-y-4">
      {/* Focus area */}
      <FormField
        control={control}
        name="focus_area"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Focus area</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select focus area" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="shoulder_stability">Shoulder stability</SelectItem>
                <SelectItem value="pushing">Pushing (chest/triceps)</SelectItem>
                <SelectItem value="pulling">Pulling (back/biceps)</SelectItem>
                <SelectItem value="core">Core</SelectItem>
                <SelectItem value="full_body">Full body</SelectItem>
                <SelectItem value="legs">Legs / posterior chain</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Exercises section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-700">Exercises</span>
          <span className="text-xs bg-slate-100 rounded-full px-2 py-0.5 text-slate-600">
            {exercises.length} logged
          </span>
        </div>

        {exercises.length > 0 && (
          <div>
            {exercises.map((exercise, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0"
              >
                <span className="text-sm text-slate-800">
                  <span className="font-medium">{exercise.name}</span>:{' '}
                  {exercise.sets}×{exercise.reps} @ {exercise.weight_kg}kg
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${exercise.name}`}
                  onClick={() => onRemoveExercise(index)}
                  className="text-slate-400 hover:text-red-500 transition-colors text-base leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {showExerciseForm ? (
          <ExerciseForm
            onAdd={handleAddExercise}
            onCancel={() => setShowExerciseForm(false)}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setShowExerciseForm(true)}
          >
            ＋ Add exercise
          </Button>
        )}
      </div>
    </div>
  )
}
