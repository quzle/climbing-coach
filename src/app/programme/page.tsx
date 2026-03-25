'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO, differenceInWeeks } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ApiResponse, ProgrammeBuilderSnapshot, WeeklyTemplate } from '@/types'

const DAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
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

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const res = await fetch('/api/programme')
        const json = (await res.json()) as ApiResponse<ProgrammeBuilderSnapshot>
        if (!res.ok || json.error) {
          setError(json.error ?? 'Failed to load programme.')
          return
        }
        setSnapshot(json.data)
      } catch {
        setError('Failed to load programme.')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-6 pb-24">
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

        {!isLoading && !error && !snapshot?.currentProgramme && (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-sm font-medium text-slate-600">No active programme found</p>
            <p className="mt-1 text-xs text-slate-400">
              Set one up to see your training plan here.
            </p>
            <Button asChild className="mt-5 min-h-[44px]">
              <Link href="/programme/setup">Set Up Training Plan</Link>
            </Button>
          </div>
        )}

        {!isLoading && !error && snapshot?.currentProgramme && (
          <div className="space-y-4">
            {/* Programme overview */}
            <Card>
              <CardHeader>
                <CardTitle>{snapshot.currentProgramme.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-slate-600">
                <p>{snapshot.currentProgramme.goal}</p>
                <p className="text-xs text-slate-400">
                  {format(parseISO(snapshot.currentProgramme.start_date), 'd MMM yyyy')}
                  {' → '}
                  {format(parseISO(snapshot.currentProgramme.target_date), 'd MMM yyyy')}
                </p>
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
                    {snapshot.upcomingPlannedSessions.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                      >
                        <span className="w-24 shrink-0 text-sm text-slate-500">
                          {format(parseISO(s.planned_date), 'EEE d MMM')}
                        </span>
                        <span className="flex-1 text-sm font-medium capitalize text-slate-800">
                          {s.session_type}
                        </span>
                        <Badge variant="outline" className="capitalize text-xs">
                          {s.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
