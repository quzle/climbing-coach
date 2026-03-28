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
  focus: string
  current_grade_bouldering: string
  current_grade_sport: string
  current_grade_onsight: string
  goal_grade: string
  strengths: string
  weaknesses: string
  peak_event_label: string
  injuries: string
  additional_context: string
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
    focus: 'general',
    current_grade_bouldering: '',
    current_grade_sport: '',
    current_grade_onsight: '',
    goal_grade: '',
    strengths: '',
    weaknesses: '',
    peak_event_label: '',
    injuries: '',
    additional_context: '',
  })

  // Derived: plan end date shown live below the duration picker
  const planEndDate =
    form.start_date
      ? addDaysToDate(form.start_date, form.duration_weeks * 7 - 1)
      : null

  async function handleGenerate() {
    setFieldErrors({})
    setFormError(null)

    const wizardInput: WizardInput = {
      goal: form.goal,
      start_date: form.start_date,
      duration_weeks: form.duration_weeks,
      focus: form.focus as WizardInput['focus'],
      current_grade_bouldering: form.current_grade_bouldering || undefined,
      current_grade_sport: form.current_grade_sport || undefined,
      current_grade_onsight: form.current_grade_onsight || undefined,
      goal_grade: form.goal_grade || undefined,
      strengths: form.strengths,
      weaknesses: form.weaknesses,
      peak_event_label: form.peak_event_label || undefined,
      injuries: form.injuries || undefined,
      additional_context: form.additional_context || undefined,
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
      focus: form.focus as WizardInput['focus'],
      current_grade_bouldering: form.current_grade_bouldering || undefined,
      current_grade_sport: form.current_grade_sport || undefined,
      current_grade_onsight: form.current_grade_onsight || undefined,
      goal_grade: form.goal_grade || undefined,
      strengths: form.strengths,
      weaknesses: form.weaknesses,
      peak_event_label: form.peak_event_label || undefined,
      injuries: form.injuries || undefined,
      additional_context: form.additional_context || undefined,
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

          {/* Start date */}
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

          {/* Duration + auto end date */}
          <div>
            <SectionLabel>Duration</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {DURATION_WEEK_OPTIONS.map((w) => (
                <ToggleButton
                  key={w}
                  active={form.duration_weeks === w}
                  onClick={() => setForm((p) => ({ ...p, duration_weeks: w }))}
                >
                  {w} weeks
                </ToggleButton>
              ))}
            </div>
            {planEndDate && (
              <p className="mt-2 text-xs text-slate-500">
                Your plan ends on{' '}
                <span className="font-medium text-slate-700">
                  {format(parseISO(planEndDate), 'd MMM yyyy')}
                </span>
              </p>
            )}
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

          {/* Current grades */}
          <div>
            <SectionLabel>Current grades (optional — helps the AI calibrate the plan)</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="current_grade_bouldering" className="text-xs text-slate-500">Bouldering</Label>
                <Input
                  id="current_grade_bouldering"
                  className="mt-1"
                  placeholder="e.g. 7a Font"
                  value={form.current_grade_bouldering}
                  onChange={(e) => setForm((p) => ({ ...p, current_grade_bouldering: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="current_grade_sport" className="text-xs text-slate-500">Sport / Lead</Label>
                <Input
                  id="current_grade_sport"
                  className="mt-1"
                  placeholder="e.g. 6c+"
                  value={form.current_grade_sport}
                  onChange={(e) => setForm((p) => ({ ...p, current_grade_sport: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="current_grade_onsight" className="text-xs text-slate-500">Onsight</Label>
                <Input
                  id="current_grade_onsight"
                  className="mt-1"
                  placeholder="e.g. 6c"
                  value={form.current_grade_onsight}
                  onChange={(e) => setForm((p) => ({ ...p, current_grade_onsight: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="goal_grade" className="text-xs text-slate-500">Goal grade</Label>
                <Input
                  id="goal_grade"
                  className="mt-1"
                  placeholder="e.g. 7b onsight"
                  value={form.goal_grade}
                  onChange={(e) => setForm((p) => ({ ...p, goal_grade: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Strengths */}
          <div>
            <Label htmlFor="strengths">What are you good at?</Label>
            <Textarea
              id="strengths"
              className="mt-1"
              rows={3}
              placeholder="e.g. I excel at technical, vertical sequences with small footholds and precise footwork. I'm comfortable on sustained slabs and feel confident on crimps up to half-pad."
              value={form.strengths}
              onChange={(e) => setForm((p) => ({ ...p, strengths: e.target.value }))}
            />
            <FieldError message={fieldErrors.strengths} />
          </div>

          {/* Weaknesses */}
          <div>
            <Label htmlFor="weaknesses">What do you need to work on?</Label>
            <Textarea
              id="weaknesses"
              className="mt-1"
              rows={3}
              placeholder="e.g. I struggle on powerful, overhanging movement — especially when I need to move fast between big holds. Compression problems and dynamic moves feel unreliable."
              value={form.weaknesses}
              onChange={(e) => setForm((p) => ({ ...p, weaknesses: e.target.value }))}
            />
            <FieldError message={fieldErrors.weaknesses} />
          </div>

          {/* Target event (optional) */}
          <div>
            <Label htmlFor="peak_event_label">Target event (optional)</Label>
            <Input
              id="peak_event_label"
              className="mt-1"
              placeholder="e.g. Red Rocks trip, summer alpine season"
              value={form.peak_event_label}
              onChange={(e) => setForm((p) => ({ ...p, peak_event_label: e.target.value }))}
            />
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

          {/* Additional context */}
          <div>
            <Label htmlFor="additional_context">Anything else the AI should know? (optional)</Label>
            <Textarea
              id="additional_context"
              className="mt-1"
              rows={3}
              placeholder="e.g. I have access to a circuit board and prefer to use it for power-endurance work instead of lead sessions when I don't have a partner. I can train 4 days a week but Thursdays are never available."
              value={form.additional_context}
              onChange={(e) => setForm((p) => ({ ...p, additional_context: e.target.value }))}
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
