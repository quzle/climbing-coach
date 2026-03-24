'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { RatingSelector } from '@/components/forms/RatingSelector'
import { IllnessToggle } from '@/components/forms/IllnessToggle'
import { WarningBanner } from '@/components/ui/WarningBanner'

// =============================================================================
// SCHEMA
// =============================================================================

const readinessFormSchema = z.object({
  sleep_quality: z.number().min(1).max(5),
  fatigue: z.number().min(1).max(5),
  finger_health: z.number().min(1).max(5),
  shoulder_health: z.number().min(1).max(5),
  illness_flag: z.boolean(),
  life_stress: z.number().min(1).max(5),
  notes: z.string().max(500).optional(),
})

export type ReadinessFormData = z.infer<typeof readinessFormSchema>

// =============================================================================
// STEP CONFIGURATION
// =============================================================================

type RatingField = 'sleep_quality' | 'fatigue' | 'finger_health' | 'shoulder_health' | 'life_stress'

type RatingStep = {
  step: number
  field: RatingField
  question: string
  labels: [string, string, string, string, string]
  type: 'rating'
}

type IllnessStep = {
  step: number
  field: 'illness_flag'
  question: string
  type: 'illness'
}

type NotesStep = {
  step: number
  field: 'notes'
  question: string
  type: 'notes'
}

type StepConfig = RatingStep | IllnessStep | NotesStep

const STEPS: StepConfig[] = [
  {
    step: 1,
    field: 'sleep_quality',
    question: 'How did you sleep?',
    labels: ['Terrible', 'Poor', 'OK', 'Good', 'Great'],
    type: 'rating',
  },
  {
    step: 2,
    field: 'fatigue',
    question: 'How is your body feeling?',
    labels: ['Exhausted', 'Tired', 'OK', 'Fresh', 'Very fresh'],
    type: 'rating',
  },
  {
    step: 3,
    field: 'finger_health',
    question: 'How are your fingers and tendons?',
    labels: ['Painful', 'Sore', 'OK', 'Good', 'Perfect'],
    type: 'rating',
  },
  // TODO Phase 2: Replace fixed shoulder_health step
  // with dynamic injury area tracking step that shows
  // only the athlete's currently tracked injury areas.
  // See ADR 004.
  {
    step: 4,
    field: 'shoulder_health',
    question: 'How is your shoulder?',
    labels: ['Painful', 'Uncomfortable', 'OK', 'Good', 'Perfect'],
    type: 'rating',
  },
  {
    step: 5,
    field: 'life_stress',
    question: 'How is life stress today?',
    labels: ['Very high', 'High', 'Moderate', 'Low', 'Very low'],
    type: 'rating',
  },
  {
    step: 6,
    field: 'illness_flag',
    question: 'Any illness symptoms?',
    type: 'illness',
  },
  {
    step: 7,
    field: 'notes',
    question: 'Anything to tell your coach?',
    type: 'notes',
  },
]

const TOTAL_STEPS = STEPS.length

// =============================================================================
// PROPS
// =============================================================================

/**
 * Props for the ReadinessForm component.
 *
 * @property onSuccess Optional callback invoked after a successful submission,
 *                     receiving the array of warnings returned by the API.
 */
type ReadinessFormProps = {
  onSuccess?: (warnings: string[]) => void
  onFormReady?: (form: UseFormReturn<ReadinessFormData>) => void
  initialStep?: number
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * ReadinessForm is the primary daily check-in form. It walks the athlete
 * through 7 steps (sleep, fatigue, finger health, shoulder health, life stress,
 * illness flag, and optional notes) using a card-based wizard UI optimised for
 * mobile. Rating and illness steps auto-advance after 300 ms so the flow feels
 * fast — the athlete never needs to tap a "Next" button for those steps.
 *
 * On successful submission the form transitions to a success view that shows
 * any coach warnings and offers quick navigation to the chat or home page.
 *
 * @example
 * <ReadinessForm onSuccess={(warnings) => console.log(warnings)} />
 */
export function ReadinessForm({ onSuccess, onFormReady, initialStep }: ReadinessFormProps) {
  const router = useRouter()
  const [step, setStep] = useState(initialStep ?? 1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)

  const form = useForm<ReadinessFormData>({
    resolver: zodResolver(readinessFormSchema),
    defaultValues: {
      sleep_quality: 0 as unknown as number,
      fatigue: 0 as unknown as number,
      finger_health: 0 as unknown as number,
      shoulder_health: 0 as unknown as number,
      illness_flag: false,
      life_stress: 0 as unknown as number,
      notes: '',
    },
  })

  useEffect(() => {
    onFormReady?.(form)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentStepConfig = STEPS[step - 1] as StepConfig

  // ---------------------------------------------------------------------------
  // AUTO-ADVANCE
  // ---------------------------------------------------------------------------

  function handleRatingChange(field: RatingField, value: number, rhfOnChange: (v: number) => void) {
    rhfOnChange(value)
    setTimeout(() => setStep((prev) => prev + 1), 300)
  }

  function handleIllnessChange(value: boolean, rhfOnChange: (v: boolean) => void) {
    rhfOnChange(value)
    setTimeout(() => setStep((prev) => prev + 1), 300)
  }

  // ---------------------------------------------------------------------------
  // SUBMISSION
  // ---------------------------------------------------------------------------

  async function onSubmit(data: ReadinessFormData) {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          notes: data.notes || null,
        }),
      })

      const result = (await response.json()) as {
        data: { checkin: unknown; warnings: string[] } | null
        error: string | null
      }

      if (!response.ok) {
        if (response.status === 409) {
          setSubmitError('You have already checked in today.')
        } else {
          setSubmitError(result.error ?? 'Something went wrong.')
        }
        return
      }

      const received = result.data?.warnings ?? []
      setWarnings(received)
      setIsComplete(true)
      onSuccess?.(received)
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSkipNotes() {
    void form.handleSubmit(onSubmit)()
  }

  // ---------------------------------------------------------------------------
  // SUCCESS VIEW
  // ---------------------------------------------------------------------------

  if (isComplete) {
    const chatMessage = encodeURIComponent(
      "I've just completed my readiness check-in. What do you recommend for today's session?",
    )

    return (
      <Card>
        <CardContent className="pt-6 flex flex-col items-center text-center gap-4">
          <span className="text-5xl text-emerald-600 leading-none">✓</span>
          <h2 className="text-xl font-semibold text-slate-800">Check-in complete</h2>

          {warnings.length > 0 ? (
            <div className="w-full text-left">
              <WarningBanner warnings={warnings} />
              <p className="mt-2 text-sm text-slate-600 text-center">
                Your coach is aware of these flags.
              </p>
            </div>
          ) : (
            <p className="text-slate-600">All looking good today 💪</p>
          )}

          <div className="w-full flex flex-col gap-2 mt-2">
            <Button
              className="w-full"
              onClick={() => router.push(`/chat?message=${chatMessage}`)}
            >
              Ask your coach
            </Button>
            <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
              View today&apos;s plan
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------------------------------------------------
  // PROGRESS BAR
  // ---------------------------------------------------------------------------

  const progressPct = (step / TOTAL_STEPS) * 100

  // ---------------------------------------------------------------------------
  // FORM VIEW
  // ---------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Daily Check-in</CardTitle>
          <span className="text-sm text-slate-500">
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1 w-full rounded-full bg-slate-200">
          <div
            className="h-1 rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Question */}
          <p className="mb-6 text-center text-xl font-semibold text-slate-800">
            {currentStepConfig.question}
          </p>

          {/* Step input */}
          {currentStepConfig.type === 'rating' && (
            <Controller
              control={form.control}
              name={currentStepConfig.field}
              render={({ field }) => (
                <RatingSelector
                  name={currentStepConfig.field}
                  value={field.value > 0 ? field.value : null}
                  labels={currentStepConfig.labels}
                  disabled={isSubmitting}
                  onChange={(val) =>
                    handleRatingChange(
                      currentStepConfig.field as RatingField,
                      val,
                      field.onChange,
                    )
                  }
                />
              )}
            />
          )}

          {currentStepConfig.type === 'illness' && (
            <Controller
              control={form.control}
              name="illness_flag"
              render={({ field }) => (
                <IllnessToggle
                  value={field.value}
                  disabled={isSubmitting}
                  onChange={(val) => handleIllnessChange(val, field.onChange)}
                />
              )}
            />
          )}

          {currentStepConfig.type === 'notes' && (
            <Controller
              control={form.control}
              name="notes"
              render={({ field }) => (
                <Textarea
                  {...field}
                  placeholder="Tired from travel, shoulder felt stiff yesterday, big week at work..."
                  className="min-h-[120px]"
                  disabled={isSubmitting}
                />
              )}
            />
          )}

          {/* Error message */}
          {submitError && (
            <p className="mt-4 text-sm text-red-600">{submitError}</p>
          )}

          {/* Navigation */}
          <div className="mt-6 flex flex-col gap-2">
            {currentStepConfig.type === 'notes' && (
              <>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting…' : 'Submit check-in'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={isSubmitting}
                  onClick={handleSkipNotes}
                >
                  Skip notes
                </Button>
              </>
            )}

            {step > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                disabled={isSubmitting}
                onClick={() => setStep((prev) => prev - 1)}
              >
                ← Back
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
