'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { WarningBanner } from '@/components/ui/WarningBanner'
import { useDraftSession } from '@/hooks/useDraftSession'
import { DraftRestoreBanner } from '@/components/forms/DraftRestoreBanner'
import { SessionTypeSelector } from '@/components/forms/SessionTypeSelector'
import { CommonFields } from '@/components/forms/session-fields/CommonFields'
import { ClimbingFields } from '@/components/forms/session-fields/ClimbingFields'
import { FingerboardFields } from '@/components/forms/session-fields/FingerboardFields'
import { StrengthFields } from '@/components/forms/session-fields/StrengthFields'
import { AerobicFields } from '@/components/forms/session-fields/AerobicFields'
import type {
  SessionType,
  ClimbingAttempt,
  FingerboardSet,
  StrengthExercise,
} from '@/types'
import {
  sessionLogFormSchema,
  type SessionLogFormData,
} from '@/components/forms/session-log-schema'

export type { SessionLogFormData }

// =============================================================================
// CONSTANTS
// =============================================================================

type Protocol = 'max_hangs' | 'repeaters' | 'density' | 'other'

const SESSION_TYPE_LABELS: Partial<Record<SessionType, string>> = {
  bouldering: 'Bouldering',
  kilterboard: 'Kilterboard',
  lead: 'Lead / Multipitch',
  fingerboard: 'Fingerboard',
  strength: 'Strength',
  aerobic: 'Aerobic',
}

const CLIMBING_TYPES = new Set<SessionType>(['bouldering', 'kilterboard', 'lead'])

// =============================================================================
// PROPS
// =============================================================================

export type SessionLogFormProps = {
  defaultSessionType?: SessionType
  plannedSessionId?: string
  onSuccess?: () => void
  mockMode?: boolean
  /**
   * Exposes the RHF form instance for testing — lets tests set values
   * programmatically without navigating through the UI.
   */
  onFormReady?: (form: UseFormReturn<SessionLogFormData>) => void
}

// =============================================================================
// HELPER — build chat message
// =============================================================================

/**
 * @description Generates a natural language summary of the logged session to
 * pre-fill the coach chat input, prompting meaningful AI feedback.
 *
 * @param data Validated form data
 * @param attempts Climbing attempts (bouldering / kilterboard / lead)
 * @param sets Fingerboard sets
 * @param exercises Strength exercises
 * @returns A plain English coach prompt string
 */
function buildChatMessage(
  data: SessionLogFormData,
  attempts: ClimbingAttempt[],
  sets: FingerboardSet[],
  exercises: StrengthExercise[],
): string {
  const duration = data.duration_mins ? `${data.duration_mins}-minute ` : ''
  const rpe = data.rpe ? ` (RPE ${data.rpe}/10)` : ''

  if (CLIMBING_TYPES.has(data.session_type as SessionType)) {
    const sends = attempts.filter(
      (a) => a.result === 'flash' || a.result === 'send',
    )
    const sendSummary =
      sends.length > 0
        ? ` I sent: ${sends.map((a) => a.grade).join(', ')}.`
        : ''
    const totalAttempts = attempts.length
    return (
      `I just logged a ${duration}${SESSION_TYPE_LABELS[data.session_type as SessionType] ?? data.session_type} session${rpe}.` +
      ` ${totalAttempts} attempt${totalAttempts !== 1 ? 's' : ''} recorded.${sendSummary}` +
      ' How did I do relative to my programme?'
    )
  }

  if (data.session_type === 'fingerboard') {
    const setCount = sets.length
    const firstSet = sets[0]
    const setDetail = firstSet
      ? ` — ${setCount} set${setCount !== 1 ? 's' : ''}, ${firstSet.hang_duration_s}s hang on ${firstSet.edge_mm}mm`
      : ''
    return (
      `I just completed a ${duration}fingerboard session${rpe}${setDetail}.` +
      ' Is this appropriate for my current training phase?'
    )
  }

  if (data.session_type === 'strength') {
    const area = data.focus_area
      ? ` focused on ${data.focus_area.replace('_', ' ')}`
      : ''
    const exCount = exercises.length
    return (
      `I just completed a ${duration}antagonist strength session${area}${rpe}.` +
      ` ${exCount} exercise${exCount !== 1 ? 's' : ''} logged.` +
      ' What should I know for my next climbing session?'
    )
  }

  if (data.session_type === 'aerobic') {
    const activity = data.activity ?? 'cross-training'
    return (
      `I just completed a ${duration}aerobic session — ${activity}${rpe}.` +
      ' How does this fit into my current programme?'
    )
  }

  return `I just logged a ${duration}${data.session_type} session${rpe}. Any coaching notes?`
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * @description Orchestrates the full session logging flow. Stage 1 is a
 * session type picker; stage 2 renders CommonFields plus the type-specific
 * field group. On successful submit navigates to the chat page with a
 * pre-filled coach message.
 *
 * @param defaultSessionType When provided, skips stage 1 and pre-selects this type
 * @param plannedSessionId Optional linked planned session UUID
 * @param onSuccess Called after a successful submission
 * @param onFormReady Exposes the RHF form instance (used in tests)
 */
export function SessionLogForm({
  defaultSessionType,
  plannedSessionId,
  onSuccess,
  mockMode = false,
  onFormReady,
}: SessionLogFormProps): React.ReactElement {
  const router = useRouter()

  // ── Draft persistence ────────────────────────────────────────────────────
  const { draft, hasDraft, saveDraft, clearDraft } = useDraftSession()

  // ── Stage + type state ──────────────────────────────────────────────────
  const [stage, setStage] = useState<1 | 2>(defaultSessionType ? 2 : 1)
  const [selectedType, setSelectedType] = useState<SessionType | null>(
    defaultSessionType ?? null,
  )

  // ── Array state (managed outside RHF) ───────────────────────────────────
  const [attempts, setAttempts] = useState<ClimbingAttempt[]>([])
  const [fingerboardSets, setFingerboardSets] = useState<FingerboardSet[]>([])
  const [exercises, setExercises] = useState<StrengthExercise[]>([])
  const [fingerboardProtocol, setFingerboardProtocol] = useState<Protocol>('max_hangs')

  // ── Draft UI state ───────────────────────────────────────────────────────
  const [draftRestored, setDraftRestored] = useState(false)
  const [showDraftBanner, setShowDraftBanner] = useState(hasDraft)

  // ── Async state ──────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [coachMessage, setCoachMessage] = useState<string | null>(null)

  // ── Form ─────────────────────────────────────────────────────────────────
  const form = useForm<SessionLogFormData>({
    resolver: zodResolver(sessionLogFormSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      session_type: defaultSessionType,
      shoulder_flag: false,
      planned_session_id: plannedSessionId,
    },
  })

  useEffect(() => {
    onFormReady?.(form)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-save draft on state changes ────────────────────────────────────
  const watchedValues = form.watch()
  useEffect(() => {
    if (stage === 1) return
    const values = form.getValues()
    saveDraft({
      sessionType: selectedType,
      stage,
      date: values.date,
      location: values.location ?? null,
      duration_mins: values.duration_mins ?? null,
      quality_rating: values.quality_rating ?? null,
      rpe: values.rpe ?? null,
      shoulder_flag: values.shoulder_flag,
      notes: values.notes ?? null,
      attempts,
      fingerboardSets,
      exercises,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, attempts, fingerboardSets, exercises, watchedValues])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function buildLogData(data: SessionLogFormData): unknown {
    if (!selectedType) return null

    if (CLIMBING_TYPES.has(selectedType)) {
      if (selectedType === 'lead') {
        return {
          attempts,
          location_type: data.location_type,
          rock_type: data.rock_type,
          pitch_count: data.pitch_count,
        }
      }
      // bouldering / kilterboard
      return {
        attempts,
        location_type: data.location_type,
        ...(selectedType === 'kilterboard' ? { angle: data.angle } : {}),
      }
    }

    if (selectedType === 'fingerboard') {
      return { protocol: fingerboardProtocol, sets: fingerboardSets }
    }

    if (selectedType === 'strength') {
      return { focus_area: data.focus_area, exercises }
    }

    if (selectedType === 'aerobic') {
      return { activity: data.activity, elevation_gain_m: data.elevation_gain_m }
    }

    return null
  }

  function handleRestoreDraft(): void {
    if (!draft) return
    setSelectedType(draft.sessionType)
    if (draft.sessionType) form.setValue('session_type', draft.sessionType)
    form.setValue('date', draft.date)
    if (draft.location) form.setValue('location', draft.location)
    if (draft.duration_mins) form.setValue('duration_mins', draft.duration_mins)
    if (draft.quality_rating) form.setValue('quality_rating', draft.quality_rating)
    if (draft.rpe) form.setValue('rpe', draft.rpe)
    form.setValue('shoulder_flag', draft.shoulder_flag)
    if (draft.notes) form.setValue('notes', draft.notes)
    setAttempts(draft.attempts)
    setFingerboardSets(draft.fingerboardSets)
    setExercises(draft.exercises)
    setStage(draft.stage)
    setShowDraftBanner(false)
    setDraftRestored(true)
  }

  function resetFlow(): void {
    setIsComplete(false)
    setStage(1)
    setSelectedType(null)
    setAttempts([])
    setFingerboardSets([])
    setExercises([])
    setFingerboardProtocol('max_hangs')
    setSubmitError(null)
    form.reset()
  }

  // ── Submit handler ────────────────────────────────────────────────────────

  async function onSubmit(data: SessionLogFormData): Promise<void> {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      if (mockMode) {
        const message = buildChatMessage(data, attempts, fingerboardSets, exercises)
        setCoachMessage(message)
        setIsComplete(true)
        clearDraft()
        onSuccess?.()
        return
      }

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, log_data: buildLogData(data) }),
      })

      const result = (await response.json()) as { error?: string }

      if (!response.ok) {
        setSubmitError(result.error ?? 'Failed to log session')
        return
      }

      const message = buildChatMessage(data, attempts, fingerboardSets, exercises)
      setCoachMessage(message)
      setIsComplete(true)
      clearDraft()
      onSuccess?.()
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (isComplete) {
    const arrayCount =
      selectedType && CLIMBING_TYPES.has(selectedType)
        ? attempts.length
        : selectedType === 'fingerboard'
          ? fingerboardSets.length
          : selectedType === 'strength'
            ? exercises.length
            : null

    const arrayLabel =
      selectedType && CLIMBING_TYPES.has(selectedType)
        ? 'attempts logged'
        : selectedType === 'fingerboard'
          ? 'sets completed'
          : selectedType === 'strength'
            ? 'exercises logged'
            : null

    return (
      <div className="space-y-6 text-center py-8">
        <p className="text-5xl text-emerald-600">✓</p>
        <h2 className="text-xl font-semibold text-slate-800">Session logged!</h2>

        {arrayCount !== null && arrayLabel !== null && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-slate-700">
                <span className="font-semibold text-slate-900">{arrayCount}</span>{' '}
                {arrayLabel}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={() =>
              router.push(`/chat?message=${encodeURIComponent(coachMessage ?? '')}`)
            }
          >
            Ask your coach about this session
          </Button>
          <Button variant="outline" onClick={resetFlow}>
            Log another session
          </Button>
        </div>
      </div>
    )
  }

  // ── Stage 1: type picker ──────────────────────────────────────────────────

  if (stage === 1) {
    return (
      <div>
        {showDraftBanner && draft && (
          <DraftRestoreBanner
            draft={draft}
            onRestore={handleRestoreDraft}
            onDiscard={() => {
              clearDraft()
              setShowDraftBanner(false)
            }}
          />
        )}
        <SessionTypeSelector
          defaultType={selectedType ?? undefined}
          onSelect={(type) => {
            setSelectedType(type)
            form.setValue('session_type', type)
            setStage(2)
          }}
        />
      </div>
    )
  }

  // ── Stage 2: form fields ──────────────────────────────────────────────────

  const isClimbing =
    selectedType !== null && CLIMBING_TYPES.has(selectedType)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStage(1)}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Change type
          </button>
        </div>
        <CardTitle>
          Log {SESSION_TYPE_LABELS[selectedType as SessionType] ?? selectedType} Session
        </CardTitle>
        {draftRestored && (
          <p className="text-xs text-amber-600">📋 Restored from draft</p>
        )}
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <CommonFields
              control={form.control}
              errors={form.formState.errors}
            />

            <hr className="border-slate-100 my-4" />

            {/* Type-specific fields */}
            {isClimbing && (
              <ClimbingFields
                control={form.control}
                sessionType={selectedType as 'bouldering' | 'kilterboard' | 'lead'}
                attempts={attempts}
                onAddAttempt={(a) => setAttempts((prev) => [...prev, a])}
                onRemoveAttempt={(i) =>
                  setAttempts((prev) => prev.filter((_, idx) => idx !== i))
                }
                errors={form.formState.errors}
              />
            )}

            {selectedType === 'fingerboard' && (
              <FingerboardFields
                sets={fingerboardSets}
                onAddSet={(s) => setFingerboardSets((prev) => [...prev, s])}
                onRemoveSet={(i) =>
                  setFingerboardSets((prev) => prev.filter((_, idx) => idx !== i))
                }
                onProtocolChange={setFingerboardProtocol}
              />
            )}

            {selectedType === 'strength' && (
              <StrengthFields
                exercises={exercises}
                onAddExercise={(e) => setExercises((prev) => [...prev, e])}
                onRemoveExercise={(i) =>
                  setExercises((prev) => prev.filter((_, idx) => idx !== i))
                }
                control={form.control}
                errors={form.formState.errors}
              />
            )}

            {selectedType === 'aerobic' && (
              <AerobicFields
                control={form.control}
                errors={form.formState.errors}
              />
            )}

            {submitError && (
              <p className="text-sm text-red-600 mt-2">{submitError}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Log session'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
