'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO, differenceInWeeks } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ProgrammeBuilderEditor } from '@/components/programme/programme-builder-editor'
import { ProseMarkdown } from '@/components/ui/prose-markdown'
import type { ApiResponse, ProgrammeBuilderSnapshot, WeeklyTemplate } from '@/types'

const DAY_LABELS: Record<number, string> = {
  0: 'Mon',
  1: 'Tue',
  2: 'Wed',
  3: 'Thu',
  4: 'Fri',
  5: 'Sat',
  6: 'Sun',
}

/**
 * @description Computes a "Week X of Y" label for the active mesocycle based
 * on today's date relative to the planned start and end dates.
 * @param plannedStart ISO date string for the mesocycle start
 * @param plannedEnd ISO date string for the mesocycle end
 * @returns Formatted week label e.g. "Week 3 of 5"
 */
function getMesocycleWeekLabel(plannedStart: string, plannedEnd: string): string {
  const today = new Date()
  const start = parseISO(plannedStart)
  const end = parseISO(plannedEnd)
  const weeksIn = differenceInWeeks(today, start) + 1
  const totalWeeks = differenceInWeeks(end, start) + 1
  const clampedWeek = Math.max(1, Math.min(weeksIn, totalWeeks))
  return `Week ${clampedWeek} of ${totalWeeks}`
}

function sortedTemplates(templates: WeeklyTemplate[]): WeeklyTemplate[] {
  return [...templates].sort((a, b) => a.day_of_week - b.day_of_week)
}

/**
 * @description Training plan overview page. Fetches the programme builder
 * snapshot and renders the active programme, mesocycle, weekly template, and
 * upcoming planned sessions in a read-only summary view.
 * @returns The programme page React element.
 */
export default function ProgrammePage(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<ProgrammeBuilderSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [isSkipping, setIsSkipping] = useState<string | null>(null)

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
    } catch {
      setError('Failed to load programme.')
    } finally {
      setIsLoading(false)
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
      <div className="mx-auto max-w-6xl px-4 py-6 pb-24">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Training Plan</h1>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        )}

        {!isLoading && error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {!isLoading && !error && !snapshot?.currentProgramme && snapshot !== null && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Start Your Programme</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p>
                  Set up your training programme to unlock AI-powered session planning.
                </p>
                <p>
                  Use the AI wizard to generate a full periodised plan in seconds, or build it
                  manually block by block.
                </p>
                <Button asChild className="min-h-[44px] w-full">
                  <Link href="/programme/new">Create with AI wizard →</Link>
                </Button>
              </CardContent>
            </Card>

            <ProgrammeBuilderEditor snapshot={snapshot} onSaved={loadSnapshot} />
          </div>
        )}

        {!isLoading && !error && snapshot?.currentProgramme && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              {/* Setup step indicator — hidden once all 4 steps complete */}
              {snapshot.upcomingPlannedSessions.length === 0 && (() => {
                const steps = [
                  { label: 'Create programme', done: snapshot.currentProgramme !== null },
                  { label: 'Add a training block', done: snapshot.activeMesocycle !== null },
                  { label: 'Define weekly structure', done: snapshot.currentWeeklyTemplate.length > 0 },
                  { label: 'Generate sessions', done: snapshot.upcomingPlannedSessions.length > 0 },
                ]
                const firstIncomplete = steps.findIndex((s) => !s.done)
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Getting started</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        {steps.map((step, i) => {
                          const isActive = i === firstIncomplete
                          const className = step.done
                            ? 'text-emerald-600 font-medium'
                            : isActive
                              ? 'text-slate-900 font-semibold'
                              : 'text-slate-400'
                          const indicator = step.done ? '✓' : String(i + 1)
                          return (
                            <li key={step.label} className={`flex items-center gap-2 ${className}`}>
                              <span className="w-4 shrink-0 text-center">{indicator}</span>
                              <span>{step.label}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Programme overview */}
              <Card>
                <CardHeader>
                  <CardTitle>{snapshot.currentProgramme.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-slate-600">
                  <p className="text-xs text-slate-400">
                    {format(parseISO(snapshot.currentProgramme.start_date), 'd MMM yyyy')}
                    {' → '}
                    {format(parseISO(snapshot.currentProgramme.target_date), 'd MMM yyyy')}
                  </p>
                  <p>{snapshot.currentProgramme.goal}</p>
                </CardContent>
              </Card>

              {/* Active mesocycle */}
              {snapshot.activeMesocycle && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{snapshot.activeMesocycle.name}</CardTitle>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {snapshot.activeMesocycle.phase_type}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-slate-600">
                    <p className="font-medium text-slate-800">
                      {getMesocycleWeekLabel(
                        snapshot.activeMesocycle.planned_start,
                        snapshot.activeMesocycle.planned_end,
                      )}
                    </p>
                    <p>{snapshot.activeMesocycle.focus}</p>
                    <p className="text-xs text-slate-400">
                      {format(parseISO(snapshot.activeMesocycle.planned_start), 'd MMM')}
                      {' – '}
                      {format(parseISO(snapshot.activeMesocycle.planned_end), 'd MMM yyyy')}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Weekly template */}
              {snapshot.currentWeeklyTemplate.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Weekly Structure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y divide-slate-100">
                      {sortedTemplates(snapshot.currentWeeklyTemplate).map((t) => (
                        <li
                          key={t.id}
                          className="flex items-start gap-3 py-2 first:pt-0 last:pb-0"
                        >
                          <span className="w-9 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">
                            {DAY_LABELS[t.day_of_week] ?? `Day ${t.day_of_week}`}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug text-slate-800">
                              {t.session_label}
                            </p>
                            {t.primary_focus && (
                              <p className="text-xs text-slate-500">{t.primary_focus}</p>
                            )}
                          </div>
                          <span className="shrink-0 capitalize text-xs text-slate-400">
                            {t.intensity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Upcoming planned sessions */}
              {snapshot.upcomingPlannedSessions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Upcoming Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y divide-slate-100">
                      {snapshot.upcomingPlannedSessions.map((s) => {
                        const plan = s.generated_plan as { ai_plan_text?: string } | null
                        const isExpanded = expandedSessionId === s.id
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
                              {s.generated_plan !== null && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-[44px]"
                                  onClick={() =>
                                    setExpandedSessionId(isExpanded ? null : s.id)
                                  }
                                >
                                  {isExpanded ? '▾ Plan' : '▸ Plan'}
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
                              <div className="px-0 pb-2 text-xs text-slate-600">
                                {plan?.ai_plan_text
                                  ? <ProseMarkdown>{plan.ai_plan_text}</ProseMarkdown>
                                  : 'No plan content available.'}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <ProgrammeBuilderEditor snapshot={snapshot} onSaved={loadSnapshot} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
