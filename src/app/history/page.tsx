'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ApiResponse, SessionLog, SessionType } from '@/types'

// =============================================================================
// CONSTANTS
// =============================================================================

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  bouldering: 'Bouldering',
  kilterboard: 'Kilterboard',
  lead: 'Lead',
  fingerboard: 'Fingerboard',
  strength: 'Strength',
  aerobic: 'Aerobic',
  rest: 'Rest',
  mobility: 'Mobility',
}

const SESSION_TYPE_COLOURS: Partial<Record<SessionType, string>> = {
  bouldering: 'bg-blue-100 text-blue-800 border-blue-200',
  kilterboard: 'bg-violet-100 text-violet-800 border-violet-200',
  lead: 'bg-green-100 text-green-800 border-green-200',
  fingerboard: 'bg-orange-100 text-orange-800 border-orange-200',
  strength: 'bg-red-100 text-red-800 border-red-200',
  aerobic: 'bg-teal-100 text-teal-800 border-teal-200',
  rest: 'bg-slate-100 text-slate-600 border-slate-200',
  mobility: 'bg-yellow-100 text-yellow-800 border-yellow-200',
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * @description Displays the full session history fetched from the API. Renders
 * a skeleton loading state while data is being fetched, and an empty state
 * if no sessions have been logged yet.
 */
export default function HistoryPage(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const res = await fetch('/api/sessions?days=365')
        const json = (await res.json()) as ApiResponse<{ sessions: SessionLog[] }>
        if (!res.ok || json.error) {
          setError(json.error ?? 'Failed to load sessions.')
          return
        }
        setSessions(json.data?.sessions ?? [])
      } catch {
        setError('Failed to load sessions.')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Session History</h1>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {!isLoading && !error && sessions.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            <p className="text-3xl mb-3">🧗</p>
            <p className="text-sm font-medium text-slate-600">No sessions logged yet</p>
            <Button asChild className="mt-4 min-h-[44px]">
              <Link href="/session/log">Log your first session</Link>
            </Button>
          </div>
        )}

        {!isLoading && !error && sessions.length > 0 && (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium ${
                          SESSION_TYPE_COLOURS[session.session_type as SessionType] ??
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {SESSION_TYPE_LABELS[session.session_type as SessionType] ??
                          session.session_type}
                      </span>
                      <span className="text-sm text-slate-500">
                        {format(parseISO(session.date), 'EEE d MMM yyyy')}
                      </span>
                    </div>
                    {session.duration_mins && (
                      <p className="mt-1 text-xs text-slate-400">
                        {session.duration_mins} min
                        {session.quality_rating ? ` · ${session.quality_rating}/5` : ''}
                      </p>
                    )}
                    {session.notes && (
                      <p className="mt-1 text-xs text-slate-500 truncate">{session.notes}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
