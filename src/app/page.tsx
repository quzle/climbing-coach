'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type {
  ApiResponse,
  PlannedSession,
  ProgrammeBuilderSnapshot,
  ReadinessCheckin,
  SessionLog,
  SessionType,
} from '@/types'

// =============================================================================
// TYPES
// =============================================================================

type ReadinessData = {
  todaysCheckin: ReadinessCheckin | null
  hasCheckedInToday: boolean
  weeklyAvg: number
  warnings: string[]
}

type SessionsData = {
  sessions: SessionLog[]
}

type ProgrammesData = {
  programmes: { id: string }[]
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SESSION_TYPE_LABELS: Partial<Record<SessionType, string>> = {
  bouldering: 'Bouldering',
  kilterboard: 'Kilterboard',
  lead: 'Lead',
  fingerboard: 'Fingerboard',
  strength: 'Strength',
  aerobic: 'Aerobic',
  rest: 'Rest',
  mobility: 'Mobility',
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * @description Home dashboard. Fetches today's readiness check-in and the most
 * recent session in parallel and renders summary cards for each.
 */
export default function Home(): React.JSX.Element {
  const [readiness, setReadiness] = useState<ReadinessData | null>(null)
  const [recentSession, setRecentSession] = useState<SessionLog | null>(null)
  const [todaysPlan, setTodaysPlan] = useState<PlannedSession | null>(null)
  const [programmeSnapshot, setProgrammeSnapshot] = useState<ProgrammeBuilderSnapshot | null>(null)
  const [hasAnyProgrammes, setHasAnyProgrammes] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isResetting, setIsResetting] = useState(false)

  async function loadAll(): Promise<void> {
    const [readinessRes, sessionsRes, plannedRes, programmesRes, programmeRes] = await Promise.allSettled([
      fetch('/api/readiness').then((r) => r.json() as Promise<ApiResponse<ReadinessData>>),
      fetch('/api/sessions?days=7').then((r) => r.json() as Promise<ApiResponse<SessionsData>>),
      fetch('/api/planned-sessions?upcoming_days=1').then(
        (r) => r.json() as Promise<ApiResponse<{ plannedSessions: PlannedSession[] }>>,
      ),
      fetch('/api/programmes').then((r) => r.json() as Promise<ApiResponse<ProgrammesData>>),
      fetch('/api/programme').then(
        (r) => r.json() as Promise<ApiResponse<ProgrammeBuilderSnapshot>>,
      ),
    ])

    if (readinessRes.status === 'fulfilled' && readinessRes.value.data) {
      setReadiness(readinessRes.value.data)
    }
    if (sessionsRes.status === 'fulfilled' && sessionsRes.value.data) {
      const all = sessionsRes.value.data.sessions
      setRecentSession(all.length > 0 ? (all[0] ?? null) : null)
    }
    if (plannedRes.status === 'fulfilled' && plannedRes.value.data) {
      const plans = plannedRes.value.data.plannedSessions
      setTodaysPlan(plans.length > 0 ? (plans[0] ?? null) : null)
    }
    if (programmesRes.status === 'fulfilled' && programmesRes.value.data) {
      const programmes = programmesRes.value.data.programmes
      setHasAnyProgrammes(programmes.length > 0)
    }
    if (programmeRes.status === 'fulfilled' && programmeRes.value.data) {
      setProgrammeSnapshot(programmeRes.value.data)
    }

    setIsLoading(false)
  }

  async function resetCheckin(): Promise<void> {
    setIsResetting(true)
    try {
      await fetch('/api/readiness', { method: 'DELETE' })
      await loadAll()
    } finally {
      setIsResetting(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Climbing Coach</h1>
          <p className="text-sm text-slate-500">AI-powered training assistant</p>
        </div>

        {/* Main CTA: setup weekly plan when an active block has no template yet */}
        {!isLoading &&
          programmeSnapshot?.currentProgramme !== null &&
          programmeSnapshot?.activeMesocycle !== null &&
          programmeSnapshot?.currentWeeklyTemplate.length === 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="space-y-3 pt-4 pb-4 text-sm text-blue-800">
                <p className="font-semibold text-blue-900">Set up your training week</p>
                <p>
                  Your training block is ready. Define your weekly schedule so the AI coach can
                  generate personalised session plans.
                </p>
                <Button asChild className="min-h-[44px] w-full">
                  <Link href={`/programme/${programmeSnapshot.currentProgramme.id}/setup-week`}>
                    Set up weekly plan →
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

        {/* Programme wizard CTA for users with no programmes */}
        {!isLoading &&
          hasAnyProgrammes === false &&
          !(
            programmeSnapshot?.currentProgramme !== null &&
            programmeSnapshot?.activeMesocycle !== null &&
            programmeSnapshot?.currentWeeklyTemplate.length === 0
          ) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Start Your Programme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Build your first plan with the AI wizard. It creates a periodised programme from
                your goals and current level in about 2 minutes.
              </p>
              <Button asChild className="min-h-[44px] w-full">
                <Link href="/programme/new">Create with AI wizard →</Link>
              </Button>
            </CardContent>
          </Card>
          )}

        {/* Readiness card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today&apos;s Readiness</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : readiness?.hasCheckedInToday && readiness.todaysCheckin ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm text-slate-700">
                    Weekly avg: <span className="font-semibold">{readiness.weeklyAvg.toFixed(1)} / 5</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Sleep {readiness.todaysCheckin.sleep_quality} · Fatigue{' '}
                    {readiness.todaysCheckin.fatigue} · Fingers{' '}
                    {readiness.todaysCheckin.finger_health}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  disabled={isResetting}
                  onClick={() => void resetCheckin()}
                >
                  {isResetting ? 'Resetting…' : 'Reset check-in'}
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-500 mb-3">No check-in today</p>
                <Button asChild size="sm" className="min-h-[44px]">
                  <Link href="/readiness">Complete check-in</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Warnings */}
        {readiness?.hasCheckedInToday && (readiness.warnings?.length ?? 0) > 0 && (
          <div className="space-y-1">
            {readiness.warnings.map((warning, i) => (
              <p key={i} className="text-amber-700 bg-amber-50 rounded p-2 text-sm">
                {warning}
              </p>
            ))}
          </div>
        )}

        {/* Today's session card */}
        {todaysPlan !== null && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Today&apos;s Session</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-800">
                  {SESSION_TYPE_LABELS[todaysPlan.session_type as SessionType] ??
                    todaysPlan.session_type.charAt(0).toUpperCase() +
                      todaysPlan.session_type.slice(1)}
                </p>
                <Button asChild size="sm" className="min-h-[44px]">
                  <Link href={`/session/log?planned_session_id=${todaysPlan.id}`}>
                    Start session
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent session card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Last Session</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : recentSession ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-800">
                  {SESSION_TYPE_LABELS[recentSession.session_type as SessionType] ??
                    recentSession.session_type}
                </p>
                <p className="text-xs text-slate-500">
                  {format(parseISO(recentSession.date), 'EEE d MMM')}
                  {recentSession.duration_mins
                    ? ` · ${recentSession.duration_mins} min`
                    : ''}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No sessions in the last 7 days</p>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
