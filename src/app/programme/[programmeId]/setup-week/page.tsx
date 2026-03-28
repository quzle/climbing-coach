'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import WeeklyScheduleEditor from '@/components/programme/weekly-schedule-editor'
import {
  DAY_LABELS,
  SESSION_DURATION_OPTIONS,
  PREFERRED_STYLES,
  PREFERRED_STYLE_LABELS,
  PHASE_TYPE_LABELS,
} from '@/lib/programme-wizard'
import type { GeneratedWeeklyTemplate, DayPin } from '@/lib/programme-wizard'
import type { ApiResponse, Mesocycle } from '@/types'

// =============================================================================
// TYPES
// =============================================================================

type PageState =
  | { step: 'loading' }
  | { step: 'form'; mesocycle: Mesocycle }
  | { step: 'generating'; mesocycle: Mesocycle }
  | { step: 'board'; mesocycle: Mesocycle; generatedSlots: GeneratedWeeklyTemplate[] }
  | { step: 'saving' }

type FormData = {
  available_days: number[]
  preferred_duration_mins: number
  preferred_styles: string[]
  day_pins: Array<{ style: string; day_of_week: number | null; locked: boolean }>
}

// =============================================================================
// CONSTANTS
// =============================================================================

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

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function SetupWeekPage(): React.JSX.Element {
  const router = useRouter()
  const params = useParams()
  const programmeId = params['programmeId'] as string

  const [pageState, setPageState] = useState<PageState>({ step: 'loading' })
  const [form, setForm] = useState<FormData>({
    available_days: [],
    preferred_duration_mins: 90,
    preferred_styles: [],
    day_pins: [],
  })
  const [currentSlots, setCurrentSlots] = useState<GeneratedWeeklyTemplate[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ available_days?: string; preferred_styles?: string }>({})
  const [boardError, setBoardError] = useState<string | null>(null)
  const [alreadySetUp, setAlreadySetUp] = useState(false)

  // ---------------------------------------------------------------------------
  // On mount: fetch the first planned/active mesocycle without weekly templates
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        // 1. Fetch all mesocycles for this programme
        const mesoRes = await fetch(`/api/mesocycles?programme_id=${programmeId}`)
        const mesoJson = (await mesoRes.json()) as ApiResponse<{ mesocycles: Mesocycle[] }>

        if (!mesoRes.ok || mesoJson.error || !mesoJson.data) {
          setPageState({ step: 'loading' })
          return
        }

        const mesocycles = mesoJson.data.mesocycles
        const candidates = mesocycles.filter(
          (m) => m.status === 'planned' || m.status === 'active',
        )

        if (candidates.length === 0) {
          setAlreadySetUp(true)
          setPageState({ step: 'loading' }) // stays in loading but alreadySetUp shown
          return
        }

        // 2. Find first mesocycle with no weekly templates
        let targetMesocycle: Mesocycle | null = null
        for (const meso of candidates) {
          const tplRes = await fetch(`/api/weekly-templates?mesocycle_id=${meso.id}`)
          const tplJson = (await tplRes.json()) as ApiResponse<{ weeklyTemplates: unknown[] }>
          if (tplRes.ok && !tplJson.error && tplJson.data) {
            if (tplJson.data.weeklyTemplates.length === 0) {
              targetMesocycle = meso
              break
            }
          }
        }

        if (!targetMesocycle) {
          setAlreadySetUp(true)
          setPageState({ step: 'loading' })
          return
        }

        setPageState({ step: 'form', mesocycle: targetMesocycle })
      } catch {
        setPageState({ step: 'loading' })
      }
    }

    void load()
  }, [programmeId])

  // ---------------------------------------------------------------------------
  // Sync day_pins when preferred_styles changes
  // ---------------------------------------------------------------------------
  function updatePreferredStyles(newStyles: string[]) {
    setForm((prev) => ({
      ...prev,
      preferred_styles: newStyles,
      day_pins: prev.day_pins.filter((pin) => newStyles.includes(pin.style)),
    }))
  }

  // ---------------------------------------------------------------------------
  // Toggle available day
  // ---------------------------------------------------------------------------
  function toggleDay(day: number) {
    setForm((prev) => {
      const next = prev.available_days.includes(day)
        ? prev.available_days.filter((d) => d !== day)
        : [...prev.available_days, day].sort((a, b) => a - b)
      return { ...prev, available_days: next }
    })
  }

  // ---------------------------------------------------------------------------
  // Toggle preferred style
  // ---------------------------------------------------------------------------
  function toggleStyle(style: string) {
    const current = form.preferred_styles
    const next = current.includes(style)
      ? current.filter((s) => s !== style)
      : [...current, style]
    updatePreferredStyles(next)
  }

  // ---------------------------------------------------------------------------
  // Update day pin for a style
  // ---------------------------------------------------------------------------
  function updateDayPin(style: string, day_of_week: number | null) {
    setForm((prev) => {
      const existing = prev.day_pins.find((p) => p.style === style)
      if (existing) {
        return {
          ...prev,
          day_pins: prev.day_pins.map((p) =>
            p.style === style ? { ...p, day_of_week, locked: day_of_week === null ? false : p.locked } : p,
          ),
        }
      }
      return {
        ...prev,
        day_pins: [...prev.day_pins, { style, day_of_week, locked: false }],
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Toggle lock for a style pin
  // ---------------------------------------------------------------------------
  function togglePinLock(style: string) {
    setForm((prev) => ({
      ...prev,
      day_pins: prev.day_pins.map((p) =>
        p.style === style && p.day_of_week !== null ? { ...p, locked: !p.locked } : p,
      ),
    }))
  }

  // ---------------------------------------------------------------------------
  // Generate weekly plan
  // ---------------------------------------------------------------------------
  async function handleGenerate(mesocycle: Mesocycle) {
    setFieldErrors({})
    setFormError(null)

    const errors: { available_days?: string; preferred_styles?: string } = {}
    if (form.available_days.length === 0) {
      errors.available_days = 'Select at least one training day.'
    }
    if (form.preferred_styles.length === 0) {
      errors.preferred_styles = 'Select at least one training style.'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setPageState({ step: 'generating', mesocycle })

    const weeklyPlanInput = {
      available_days: form.available_days,
      preferred_duration_mins: form.preferred_duration_mins,
      preferred_styles: form.preferred_styles,
      day_pins: form.day_pins
        .filter((p) => p.day_of_week !== null)
        .map((p) => ({ style: p.style, day_of_week: p.day_of_week!, locked: p.locked })),
    }

    try {
      const res = await fetch(`/api/mesocycles/${mesocycle.id}/generate-weekly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weeklyPlanInput),
      })
      const json = (await res.json()) as ApiResponse<GeneratedWeeklyTemplate[]>

      if (!res.ok || json.error || !json.data) {
        setFormError(json.error ?? 'Failed to generate weekly plan. Please try again.')
        setPageState({ step: 'form', mesocycle })
        return
      }

      setCurrentSlots(json.data)
      setPageState({ step: 'board', mesocycle, generatedSlots: json.data })
    } catch {
      setFormError('Network error. Please try again.')
      setPageState({ step: 'form', mesocycle })
    }
  }

  // ---------------------------------------------------------------------------
  // Save weekly plan
  // ---------------------------------------------------------------------------
  async function handleSave(mesocycle: Mesocycle) {
    setBoardError(null)
    setPageState({ step: 'saving' })

    try {
      const res = await fetch(`/api/mesocycles/${mesocycle.id}/confirm-weekly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: currentSlots }),
      })
      const json = (await res.json()) as ApiResponse<{ count: number }>

      if (!res.ok || json.error) {
        setBoardError(json.error ?? 'Failed to save weekly plan. Please try again.')
        setPageState({ step: 'board', mesocycle, generatedSlots: currentSlots })
        return
      }

      // Create planned session records for the full mesocycle (fast — no AI calls).
      try {
        await fetch('/api/planned-sessions/generate', { method: 'POST' })
      } catch {
        // Non-fatal: redirect regardless; sessions can be retried
      }

      router.push('/programme')
    } catch {
      setBoardError('Network error. Please try again.')
      setPageState({ step: 'board', mesocycle, generatedSlots: currentSlots })
    }
  }

  // ---------------------------------------------------------------------------
  // RENDER: LOADING / ALREADY SET UP
  // ---------------------------------------------------------------------------

  if (pageState.step === 'loading') {
    if (alreadySetUp) {
      return (
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-lg px-4 py-16 text-center">
            <div className="mb-4 text-4xl">✅</div>
            <h2 className="mb-2 text-lg font-semibold text-slate-800">Already set up</h2>
            <p className="mb-6 text-sm text-slate-500">
              All mesocycles in this programme already have weekly templates.
            </p>
            <Button onClick={() => router.push('/programme')}>Back to programme</Button>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="mb-4 animate-spin text-4xl">⏳</div>
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: GENERATING
  // ---------------------------------------------------------------------------

  if (pageState.step === 'generating') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="mb-4 text-4xl">🧠</div>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Generating your weekly plan…</h2>
          <p className="text-sm text-slate-500">
            Building your weekly session schedule. This takes a few seconds.
          </p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: SAVING
  // ---------------------------------------------------------------------------

  if (pageState.step === 'saving') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="mb-4 text-4xl">💾</div>
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Saving your plan…</h2>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: BOARD
  // ---------------------------------------------------------------------------

  if (pageState.step === 'board') {
    const { mesocycle, generatedSlots } = pageState
    const lockedDayPins = form.day_pins
      .filter((p) => p.day_of_week !== null && p.locked)
      .map((p) => ({
        style: p.style as DayPin['style'],
        day_of_week: p.day_of_week!,
        locked: true as const,
      }))

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
          {/* Header */}
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPageState({ step: 'form', mesocycle })}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold text-slate-900">Review weekly plan</h1>
          </div>

          {/* Mesocycle info */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">{mesocycle.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {format(parseISO(mesocycle.planned_start), 'd MMM')} →{' '}
                    {format(parseISO(mesocycle.planned_end), 'd MMM yyyy')}
                  </CardDescription>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    PHASE_BADGE_CLASSES[mesocycle.phase_type] ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {PHASE_TYPE_LABELS[mesocycle.phase_type] ?? mesocycle.phase_type}
                </span>
              </div>
            </CardHeader>
          </Card>

          <p className="mb-4 text-sm text-slate-500">
            Tap a session to pick it up, then tap a day to place it. Tap × to remove a session from
            a day.
          </p>

          {boardError && (
            <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600" role="alert">
              {boardError}
            </p>
          )}

          <WeeklyScheduleEditor
            slots={generatedSlots}
            availableDays={form.available_days}
            lockedDayPins={lockedDayPins}
            onChange={(updatedSlots) => setCurrentSlots(updatedSlots)}
          />

          <div className="mt-6 flex flex-col gap-3">
            <Button
              className="min-h-[44px] w-full"
              onClick={() => void handleSave(mesocycle)}
            >
              Save weekly plan
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px] w-full"
              onClick={() => setPageState({ step: 'form', mesocycle })}
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER: FORM (pageState.step === 'form')
  // ---------------------------------------------------------------------------

  const { mesocycle } = pageState

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/programme')}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Set up weekly schedule</h1>
            <p className="text-sm text-slate-500">{mesocycle.name}</p>
          </div>
        </div>

        {formError && (
          <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600" role="alert">
            {formError}
          </p>
        )}

        <div className="space-y-6">

          {/* Section 1: Available training days */}
          <div>
            <SectionLabel>Which days can you train?</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <ToggleButton
                  key={day}
                  active={form.available_days.includes(day)}
                  onClick={() => toggleDay(day)}
                >
                  {DAY_LABELS[day]}
                </ToggleButton>
              ))}
            </div>
            {fieldErrors.available_days && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.available_days}</p>
            )}
          </div>

          {/* Section 2: Session duration */}
          <div>
            <SectionLabel>Preferred session duration</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {SESSION_DURATION_OPTIONS.map((mins) => (
                <ToggleButton
                  key={mins}
                  active={form.preferred_duration_mins === mins}
                  onClick={() => setForm((prev) => ({ ...prev, preferred_duration_mins: mins }))}
                >
                  {mins} min
                </ToggleButton>
              ))}
            </div>
          </div>

          {/* Section 3: Training styles */}
          <div>
            <SectionLabel>Training styles you want to include</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {PREFERRED_STYLES.map((style) => (
                <ToggleButton
                  key={style}
                  active={form.preferred_styles.includes(style)}
                  onClick={() => toggleStyle(style)}
                >
                  {PREFERRED_STYLE_LABELS[style] ?? style}
                </ToggleButton>
              ))}
            </div>
            {fieldErrors.preferred_styles && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.preferred_styles}</p>
            )}
          </div>

          {/* Section 4: Day preferences */}
          {form.preferred_styles.length > 0 && (
            <div>
              <SectionLabel>Day preferences (optional)</SectionLabel>
              <div className="space-y-2">
                {form.preferred_styles.map((style) => {
                  const pin = form.day_pins.find((p) => p.style === style)
                  const selectedDay = pin?.day_of_week ?? null
                  const isLocked = pin?.locked ?? false

                  return (
                    <div key={style} className="flex items-center gap-3">
                      <Label className="w-28 shrink-0 text-sm text-slate-700">
                        {PREFERRED_STYLE_LABELS[style] ?? style}
                      </Label>
                      <span className="text-slate-400">→</span>
                      <select
                        value={selectedDay ?? ''}
                        onChange={(e) => {
                          const val = e.target.value
                          updateDayPin(style, val === '' ? null : Number(val))
                        }}
                        className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">No preference</option>
                        {form.available_days.map((day) => (
                          <option key={day} value={day}>
                            {DAY_LABELS[day]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={selectedDay === null}
                        onClick={() => togglePinLock(style)}
                        className={`min-h-[36px] min-w-[36px] rounded-md border px-2 py-1 text-sm transition-colors ${
                          selectedDay === null
                            ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                            : isLocked
                              ? 'border-blue-400 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                        }`}
                        aria-label={isLocked ? 'Locked' : 'Unlocked'}
                      >
                        {isLocked ? '🔒' : '🔓'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <Button
            className="min-h-[44px] w-full"
            onClick={() => void handleGenerate(mesocycle)}
          >
            Generate weekly plan →
          </Button>
        </div>
      </div>
    </div>
  )
}
