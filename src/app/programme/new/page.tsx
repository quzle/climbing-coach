'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  DURATION_WEEK_OPTIONS,
  FOCUS_LABELS,
  FOCUS_OPTIONS,
  PHASE_TYPE_LABELS,
  addDaysToDate,
  computeMesocycleDates,
  wizardInputSchema,
} from '@/lib/programme-wizard'
import type { ApiResponse } from '@/types'
import type { GeneratedPlan, WizardInput } from '@/lib/programme-wizard'

// =============================================================================
// TYPES
// =============================================================================

type WizardState =
  | { step: 'form' }
  | { step: 'generating' }
  | { step: 'review'; plan: GeneratedPlan }
  | { step: 'confirming'; plan: GeneratedPlan }

type FormData = {
  goal: string
  start_date: string
  duration_weeks: number
  peak_event_label: string
  peak_event_date: string
  focus: string
  injuries: string
}

// =============================================================================
// HELPERS
// =============================================================================

function todayIso(): string {
  return new Date().toISOString().split('T')[0]!
}

const PHASE_BADGE_CLASSES: Record<string, string> = {
  base: 'bg-blue-100 text-blue-800',
  power: 'bg-orange-100 text-orange-800',
  power_endurance: 'bg-purple-100 text-purple-800',
  climbing_specific: 'bg-emerald-100 text-emerald-800',
  performance: 'bg-amber-100 text-amber-800',
  deload: 'bg-slate-100 text-slate-600',
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] rounded-md border px-3 py-1.5 text-sm transition-colors ${
        active
          ? 'border-blue-500 bg-blue-50 font-semibold text-blue-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-sm font-medium text-slate-700">{children}</p>
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600">{message}</p>
}

// =============================================================================
// PLAN REVIEW
// =============================================================================

function PlanReview({ plan, startDate }: { plan: GeneratedPlan; startDate: string }) {
  const dates = computeMesocycleDates(plan.mesocycles, startDate)
  const totalWeeks = plan.mesocycles.reduce((sum, m) => sum + m.duration_weeks, 0)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{plan.programme.name}</h2>
        <p className="text-sm text-slate-600">{plan.programme.goal}</p>
        {plan.programme.notes && (
          <p className="mt-1 text-xs text-slate-500">{plan.programme.notes}</p>
        )}
        <p className="mt-1 text-xs text-slate-400">{totalWeeks} weeks total</p>
      </div>

      {plan.mesocycles.map((meso, i) => {
        const d = dates[i]!
        return (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">{meso.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {format(parseISO(d.start), 'd MMM')} → {format(parseISO(d.end), 'd MMM yyyy')}
                    {' · '}
                    {meso.duration_weeks} {meso.duration_weeks === 1 ? 'week' : 'weeks'}
                  </CardDescription>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    PHASE_BADGE_CLASSES[meso.phase_type] ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {PHASE_TYPE_LABELS[meso.phase_type] ?? meso.phase_type}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="mb-2 text-xs text-slate-500">{meso.focus}</p>
              {meso.objectives && (
                <p className="mt-1 text-xs text-slate-600 italic">{meso.objectives}</p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ProgrammeWizardPage(): React.JSX.Element {
  const router = useRouter()

  const [wizardState, setWizardState] = useState<WizardState>({ step: 'form' })
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof WizardInput, string>>>({})
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const [form, setForm] = useState<FormData>({
    goal: '',
    start_date: todayIso(),
    duration_weeks: 12,
    peak_event_label: '',
    peak_event_date: '',
    focus: 'general',
    injuries: '',
  })

  async function handleGenerate() {
    setFieldErrors({})
    setFormError(null)

    const wizardInput: WizardInput = {
      goal: form.goal,
      start_date: form.start_date,
      duration_weeks: form.duration_weeks,
      peak_event_label: form.peak_event_label || undefined,
      peak_event_date: form.peak_event_date || undefined,
      focus: form.focus as WizardInput['focus'],
      injuries: form.injuries || undefined,
    }

    const validation = wizardInputSchema.safeParse(wizardInput)
    if (!validation.success) {
      const errors: Partial<Record<keyof WizardInput, string>> = {}
      for (const issue of validation.error.issues) {
        const key = issue.path[0] as keyof WizardInput
        if (key && !errors[key]) errors[key] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setWizardState({ step: 'generating' })

    try {
      const res = await fetch('/api/programme/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      })
      const json = (await res.json()) as ApiResponse<GeneratedPlan>

      if (!res.ok || (json.error ?? !json.data)) {
        setFormError(json.error ?? 'Plan generation failed. Please try again.')
        setWizardState({ step: 'form' })
        return
      }

      setWizardState({ step: 'review', plan: json.data })
    } catch {
      setFormError('Network error. Please try again.')
      setWizardState({ step: 'form' })
    }
  }

  async function handleConfirm(plan: GeneratedPlan) {
    setConfirmError(null)
    setWizardState({ step: 'confirming', plan })

    const wizardInput: WizardInput = {
      goal: form.goal,
      start_date: form.start_date,
      duration_weeks: form.duration_weeks,
      peak_event_label: form.peak_event_label || undefined,
      peak_event_date: form.peak_event_date || undefined,
      focus: form.focus as WizardInput['focus'],
      injuries: form.injuries || undefined,
    }

    try {
      const res = await fetch('/api/programme/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wizard_input: wizardInput, plan }),
      })
      const json = (await res.json()) as ApiResponse<{ programme_id: string; first_mesocycle_id: string }>

      if (!res.ok || json.error || !json.data) {
        setConfirmError(json.error ?? 'Failed to create plan.')
        setWizardState({ step: 'review', plan })
        return
      }

      router.push(`/programme/${json.data.programme_id}/setup-week`)
    } catch {
      setConfirmError('Network error. Please try again.')
      setWizardState({ step: 'review', plan })
    }
  }

  // ---------------------------------------------------------------------------
  // RENDER: GENERATING
  // ---------------------------------------------------------------------------

  if (wizardState.step === 'generating') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="mb-4 text-4xl">🧠</div>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Planning your programme…</h2>
          <p className="text-sm text-slate-500">
            Designing mesocycles and weekly structure. This takes a few seconds.
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: REVIEW
  // ---------------------------------------------------------------------------

  if (wizardState.step === 'review' || wizardState.step === 'confirming') {
    const plan = wizardState.plan
    const isConfirming = wizardState.step === 'confirming'

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-lg px-4 py-6 pb-24">
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setWizardState({ step: 'form' })}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold text-slate-900">Review your plan</h1>
          </div>

          <p className="mb-4 text-sm text-slate-500">
            Review the AI-generated plan below. Go back to adjust your inputs or create the plan
            as-is.
          </p>

          {confirmError && (
            <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600" role="alert">
              {confirmError}
            </p>
          )}

          <PlanReview plan={plan} startDate={form.start_date} />

          <div className="mt-6 flex flex-col gap-3">
            <Button
              className="min-h-[44px] w-full"
              disabled={isConfirming}
              onClick={() => void handleConfirm(plan)}
            >
              {isConfirming ? 'Creating plan…' : 'Create this plan'}
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px] w-full"
              disabled={isConfirming}
              onClick={() => setWizardState({ step: 'form' })}
            >
              Back to form
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: FORM
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-6 pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Create a programme</h1>
          <p className="text-sm text-slate-500">
            Tell the AI coach about your goals and it will design a periodised plan for you.
          </p>
        </div>

        {formError && (
          <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600" role="alert">
            {formError}
          </p>
        )}

        <div className="space-y-6">

          {/* Goal */}
          <div>
            <Label htmlFor="goal">What&apos;s your main training goal?</Label>
            <Input
              id="goal"
              className="mt-1"
              placeholder="e.g. Onsight 7a sport routes by autumn"
              value={form.goal}
              onChange={(e) => setForm((p) => ({ ...p, goal: e.target.value }))}
            />
            <FieldError message={fieldErrors.goal} />
          </div>

          {/* Start date + duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                type="date"
                className="mt-1"
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              />
              <FieldError message={fieldErrors.start_date} />
            </div>
            <div>
              <SectionLabel>Duration (weeks)</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {DURATION_WEEK_OPTIONS.map((w) => (
                  <ToggleButton
                    key={w}
                    active={form.duration_weeks === w}
                    onClick={() => setForm((p) => ({ ...p, duration_weeks: w }))}
                  >
                    {w}w
                  </ToggleButton>
                ))}
              </div>
            </div>
          </div>

          {/* Peak event (optional) */}
          <div>
            <SectionLabel>Peak event (optional)</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="e.g. Red Rocks trip"
                value={form.peak_event_label}
                onChange={(e) => setForm((p) => ({ ...p, peak_event_label: e.target.value }))}
              />
              <Input
                type="date"
                value={form.peak_event_date}
                onChange={(e) => setForm((p) => ({ ...p, peak_event_date: e.target.value }))}
              />
            </div>
          </div>

          {/* Focus */}
          <div>
            <SectionLabel>Primary focus</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((f) => (
                <ToggleButton
                  key={f}
                  active={form.focus === f}
                  onClick={() => setForm((p) => ({ ...p, focus: f }))}
                >
                  {FOCUS_LABELS[f] ?? f}
                </ToggleButton>
              ))}
            </div>
          </div>

          {/* Injuries */}
          <div>
            <Label htmlFor="injuries">Current injuries or concerns (optional)</Label>
            <Textarea
              id="injuries"
              className="mt-1"
              rows={2}
              placeholder="e.g. Left A2 pulley, mild — avoid crimping"
              value={form.injuries}
              onChange={(e) => setForm((p) => ({ ...p, injuries: e.target.value }))}
            />
          </div>

          <Button className="min-h-[44px] w-full" onClick={() => void handleGenerate()}>
            Generate my plan →
          </Button>
        </div>
      </div>
    </div>
  )
}
