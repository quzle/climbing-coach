'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO, differenceInWeeks } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ProseMarkdown } from '@/components/ui/prose-markdown'
import type { ApiResponse, Mesocycle, PlannedSession, ProgrammeBuilderSnapshot } from '@/types'

// =============================================================================
// CONSTANTS
// =============================================================================

const PHASE_TYPE_LABELS: Record<string, string> = {
  base: 'Base',
  power: 'Power',
  power_endurance: 'Power Endurance',
  climbing_specific: 'Climbing Specific',
  performance: 'Performance',
  deload: 'Deload',
}

const PHASE_PILL_CLASSES: Record<string, string> = {
  base: 'bg-blue-100 text-blue-700',
  power: 'bg-orange-100 text-orange-800',
  power_endurance: 'bg-purple-100 text-purple-700',
  climbing_specific: 'bg-emerald-100 text-emerald-700',
  performance: 'bg-amber-100 text-amber-700',
  deload: 'bg-slate-100 text-slate-500',
}

// =============================================================================
// HELPERS
// =============================================================================

function getMesocycleWeekLabel(plannedStart: string, plannedEnd: string): string {
  const today = new Date()
  const start = parseISO(plannedStart)
  const end = parseISO(plannedEnd)
  const weeksIn = differenceInWeeks(today, start) + 1
  const totalWeeks = differenceInWeeks(end, start) + 1
  const clampedWeek = Math.max(1, Math.min(weeksIn, totalWeeks))
  return `Week ${clampedWeek} of ${totalWeeks}`
}

function PhasePill({ phaseType, muted = false }: { phaseType: string; muted?: boolean }) {
  const label = PHASE_TYPE_LABELS[phaseType] ?? phaseType
  const classes = muted
    ? 'bg-slate-100 text-slate-400'
    : (PHASE_PILL_CLASSES[phaseType] ?? 'bg-slate-100 text-slate-600')
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}

// =============================================================================
// PAGE
// =============================================================================

/**
 * @description Training plan overview page. Single-column layout showing the
 * active programme, all mesocycles in chronological order (active expanded and
 * highlighted, completed/future collapsed), and upcoming planned sessions.
 */
export default function ProgrammePage(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<ProgrammeBuilderSnapshot | null>(null)
  const [allMesocycles, setAllMesocycles] = useState<Mesocycle[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [isSkipping, setIsSkipping] = useState<string | null>(null)
  const [extraSessions, setExtraSessions] = useState<PlannedSession[] | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [generatingPlanId, setGeneratingPlanId] = useState<string | null>(null)
  const [planCache, setPlanCache] = useState<Record<string, string>>({})

  async function loadSnapshot(): Promise<void> {
    try {
      const res = await fetch('/api/programme')
      const json = (await res.json()) as ApiResponse<ProgrammeBuilderSnapshot>
      if (!res.ok || json.error) {
        setError(json.error ?? 'Failed to load programme.')
        return
      }
      setError(null)
      setSnapshot(json.data)

      // Fetch all mesocycles once we have the programme ID.
      if (json.data?.currentProgramme) {
        const mesoRes = await fetch(
          `/api/mesocycles?programme_id=${json.data.currentProgramme.id}`,
        )
        const mesoJson = (await mesoRes.json()) as ApiResponse<{ mesocycles: Mesocycle[] }>
        if (mesoRes.ok && !mesoJson.error && mesoJson.data) {
          setAllMesocycles(mesoJson.data.mesocycles)
        }
      }
    } catch {
      setError('Failed to load programme.')
    } finally {
      setIsLoading(false)
    }
  }

  async function generatePlan(sessionId: string): Promise<void> {
    setGeneratingPlanId(sessionId)
    try {
      const res = await fetch(`/api/planned-sessions/${sessionId}/generate-plan`, {
        method: 'POST',
      })
      const json = (await res.json()) as ApiResponse<{ ai_plan_text: string }>
      if (res.ok && json.data) {
        setPlanCache((prev) => ({ ...prev, [sessionId]: json.data!.ai_plan_text }))
        setExpandedSessionId(sessionId)
      }
    } catch {
      // Silently fail — user can retry by tapping again
    } finally {
      setGeneratingPlanId(null)
    }
  }

  async function loadMoreSessions(): Promise<void> {
    setIsLoadingMore(true)
    try {
      const today = new Date().toISOString().split('T')[0]!
      const res = await fetch(`/api/planned-sessions?start_date=${today}&end_date=2099-12-31`)
      const json = (await res.json()) as ApiResponse<{ plannedSessions: PlannedSession[] }>
      if (!res.ok || json.error || !json.data) return
      setExtraSessions(json.data.plannedSessions)
    } catch {
      // Silently fail — snapshot sessions remain visible
    } finally {
      setIsLoadingMore(false)
    }
  }

  async function skipSession(id: string): Promise<void> {
    setIsSkipping(id)
    try {
      const res = await fetch(`/api/planned-sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'skipped' }),
      })
      const json = (await res.json()) as ApiResponse<unknown>
      if (!res.ok || json.error) {
        setError(json.error ?? 'Failed to skip session.')
        return
      }
      await loadSnapshot()
    } catch {
      setError('Failed to skip session.')
    } finally {
      setIsSkipping(null)
    }
  }

  useEffect(() => {
    void loadSnapshot()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Training Plan</h1>

        {/* ------------------------------------------------------------------ */}
        {/* Loading                                                             */}
        {/* ------------------------------------------------------------------ */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Error                                                               */}
        {/* ------------------------------------------------------------------ */}
        {!isLoading && error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* No programme                                                        */}
        {/* ------------------------------------------------------------------ */}
        {!isLoading && !error && snapshot !== null && !snapshot.currentProgramme && (
          <Card>
            <CardHeader>
              <CardTitle>Start Your Programme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p>
                The AI wizard will design a full periodised training plan based on your goals,
                current level, and availability — typically 12–24 weeks split into structured
                mesocycle blocks.
              </p>
              <p>
                You&apos;ll review and adjust the plan before anything is saved. Once confirmed,
                you&apos;ll set up your weekly schedule for the first training block, and the AI
                will generate session plans on demand from there.
              </p>
              <p className="text-xs text-slate-400">Takes about 2 minutes to complete.</p>
              <Button asChild className="min-h-[44px] w-full">
                <Link href="/programme/new">Create with AI wizard →</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Has programme                                                       */}
        {/* ------------------------------------------------------------------ */}
        {!isLoading && !error && snapshot?.currentProgramme && (
          <div className="space-y-6">

            {/* Active plan */}
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Active plan</h2>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-lg font-bold text-slate-900">
                    {snapshot.currentProgramme.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {snapshot.currentProgramme.goal}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {format(parseISO(snapshot.currentProgramme.start_date), 'd MMM yyyy')}
                    {' → '}
                    {format(parseISO(snapshot.currentProgramme.target_date), 'd MMM yyyy')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Setup-week CTA */}
            {snapshot.activeMesocycle && snapshot.currentWeeklyTemplate.length === 0 && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-4 pb-4 space-y-3 text-sm text-blue-800">
                  <p className="font-semibold text-blue-900">Set up your training week</p>
                  <p>
                    Your training block is ready. Define your weekly schedule so the AI coach
                    can generate personalised session plans.
                  </p>
                  <Button asChild className="min-h-[44px] w-full">
                    <Link href={`/programme/${snapshot.currentProgramme.id}/setup-week`}>
                      Set up weekly plan →
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Mesocycles — all blocks in chronological order */}
            {allMesocycles && allMesocycles.length > 0 && (
              <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Mesocycles</h2>
              <div className="space-y-2">
                {allMesocycles.map((meso) => {
                  const isActive = meso.id === snapshot.activeMesocycle?.id
                  const isCompleted = meso.status === 'completed'

                  if (isActive) {
                    return (
                      <Card key={meso.id} className="border-2 border-blue-500 shadow-sm">
                        <CardContent className="pt-4 pb-4">
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-blue-500">
                                Current block
                              </p>
                              <p className="font-semibold text-slate-900 leading-snug">
                                {meso.name}
                              </p>
                            </div>
                            <PhasePill phaseType={meso.phase_type} />
                          </div>
                          <p className="text-sm font-medium text-slate-700">
                            {getMesocycleWeekLabel(meso.planned_start, meso.planned_end)}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">{meso.focus}</p>
                          <p className="mt-2 text-xs text-slate-400">
                            {format(parseISO(meso.planned_start), 'd MMM')}
                            {' – '}
                            {format(parseISO(meso.planned_end), 'd MMM yyyy')}
                          </p>
                        </CardContent>
                      </Card>
                    )
                  }

                  return (
                    <Card
                      key={meso.id}
                      className={isCompleted ? 'border-slate-100 bg-slate-50' : 'border-slate-200'}
                    >
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          {isCompleted && (
                            <span className="shrink-0 text-sm text-emerald-500">✓</span>
                          )}
                          <span
                            className={`min-w-0 flex-1 truncate text-sm font-medium ${
                              isCompleted ? 'text-slate-400' : 'text-slate-600'
                            }`}
                          >
                            {meso.name}
                          </span>
                          <PhasePill phaseType={meso.phase_type} muted={isCompleted} />
                          <span className="shrink-0 text-xs text-slate-400">
                            {format(parseISO(meso.planned_start), 'd MMM')}
                            {' – '}
                            {format(parseISO(meso.planned_end), 'd MMM')}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              </div>
            )}

            {/* Upcoming sessions */}
            {snapshot.upcomingPlannedSessions.length > 0 && (
              <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Upcoming Sessions</h2>
              <Card>
                <CardContent className="pt-4">
                  <div className="max-h-[480px] overflow-y-auto">
                    <ul className="divide-y divide-slate-100">
                      {(extraSessions ?? snapshot.upcomingPlannedSessions).map((s) => {
                        const storedPlanText = (
                          s.generated_plan as { ai_plan_text?: string } | null
                        )?.ai_plan_text
                        const planText = planCache[s.id] ?? storedPlanText
                        const isExpanded = expandedSessionId === s.id
                        const isGenerating = generatingPlanId === s.id

                        function handlePlanClick() {
                          if (isExpanded) {
                            setExpandedSessionId(null)
                            return
                          }
                          if (planText) {
                            setExpandedSessionId(s.id)
                          } else {
                            void generatePlan(s.id)
                          }
                        }

                        return (
                          <li key={s.id} className="py-2 first:pt-0 last:pb-0">
                            <div className="flex items-center gap-3">
                              <span className="w-24 shrink-0 text-sm text-slate-500">
                                {format(parseISO(s.planned_date), 'EEE d MMM')}
                              </span>
                              <span className="flex-1 text-sm font-medium capitalize text-slate-800">
                                {s.session_type}
                              </span>
                              <Badge variant="outline" className="capitalize text-xs">
                                {s.status}
                              </Badge>
                              {s.mesocycle_id !== null && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-[44px]"
                                  disabled={isGenerating}
                                  onClick={handlePlanClick}
                                >
                                  {isGenerating ? '…' : isExpanded ? '▾ Plan' : '▸ Plan'}
                                </Button>
                              )}
                              {s.status === 'planned' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-[44px] text-slate-500"
                                  disabled={isSkipping === s.id}
                                  onClick={() => void skipSession(s.id)}
                                >
                                  Skip
                                </Button>
                              )}
                              <Button asChild size="sm" className="min-h-[44px]">
                                <Link href={`/session/log?planned_session_id=${s.id}`}>
                                  Start session
                                </Link>
                              </Button>
                            </div>
                            {isExpanded && (
                              <div className="pb-2 text-xs text-slate-600">
                                {planText ? (
                                  <ProseMarkdown>{planText}</ProseMarkdown>
                                ) : (
                                  'No plan content available.'
                                )}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {extraSessions !== null ? (
                      <p className="text-center text-xs text-slate-400">All sessions loaded</p>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-slate-500"
                        disabled={isLoadingMore}
                        onClick={() => void loadMoreSessions()}
                      >
                        {isLoadingMore ? 'Loading…' : 'Load all sessions'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
