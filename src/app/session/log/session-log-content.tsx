'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { SessionLogForm, type SessionLogFormData } from '@/components/forms/SessionLogForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ApiResponse, PlannedSession, SessionType } from '@/types'
import type { Json } from '@/lib/database.types'

type PlannedSessionPlan = {
  session_label?: string
  primary_focus?: string | null
  duration_mins?: number | null
  ai_plan_text?: string
}

function parsePlannedSessionPlan(raw: Json | null): PlannedSessionPlan | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }

  const plan = raw as Record<string, unknown>
  return {
    session_label:
      typeof plan['session_label'] === 'string' ? (plan['session_label'] as string) : undefined,
    primary_focus:
      typeof plan['primary_focus'] === 'string'
        ? (plan['primary_focus'] as string)
        : null,
    duration_mins:
      typeof plan['duration_mins'] === 'number' ? (plan['duration_mins'] as number) : null,
    ai_plan_text:
      typeof plan['ai_plan_text'] === 'string' ? (plan['ai_plan_text'] as string) : undefined,
  }
}

function buildInitialValuesFromPlannedSession(
  plannedSession: PlannedSession,
): Partial<SessionLogFormData> {
  const plan = parsePlannedSessionPlan(plannedSession.generated_plan)
  const plannedNotes = plan?.ai_plan_text
    ? `Planned session:\n${plan.ai_plan_text}`
    : plan?.primary_focus
      ? `Planned focus: ${plan.primary_focus}`
      : undefined

  return {
    date: plannedSession.planned_date,
    duration_mins: plan?.duration_mins ?? undefined,
    notes: plannedNotes,
    planned_session_id: plannedSession.id,
  }
}

/**
 * @description Session logging UI that reads URL search params for optional
 * planned-session prefill, then submits a completed log and redirects home.
 * @returns The client-rendered session log content.
 */
export function SessionLogContent(): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plannedSessionId = searchParams.get('planned_session_id')
  const [plannedSession, setPlannedSession] = useState<PlannedSession | null>(null)
  const [isLoadingPlan, setIsLoadingPlan] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPlannedSession(): Promise<void> {
      if (plannedSessionId === null) {
        setPlannedSession(null)
        setPlanError(null)
        setIsLoadingPlan(false)
        return
      }

      setIsLoadingPlan(true)
      setPlanError(null)

      try {
        const response = await fetch(`/api/planned-sessions/${plannedSessionId}`)
        const json = (await response.json()) as ApiResponse<{ plannedSession: PlannedSession }>

        if (!response.ok || json.error !== null || json.data === null) {
          setPlanError(json.error ?? 'Failed to load planned session.')
          setPlannedSession(null)
          return
        }

        setPlannedSession(json.data.plannedSession)
      } catch {
        setPlanError('Failed to load planned session.')
        setPlannedSession(null)
      } finally {
        setIsLoadingPlan(false)
      }
    }

    void loadPlannedSession()
  }, [plannedSessionId])

  const plannedPlan = plannedSession !== null
    ? parsePlannedSessionPlan(plannedSession.generated_plan)
    : null
  const initialValues = plannedSession !== null
    ? buildInitialValuesFromPlannedSession(plannedSession)
    : undefined

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Log Session</h1>
        {isLoadingPlan ? (
          <p className="mb-4 text-sm text-slate-500">Loading planned session...</p>
        ) : null}

        {planError !== null ? (
          <p className="mb-4 text-sm text-red-600" role="alert">
            {planError}
          </p>
        ) : null}

        {plannedSession !== null ? (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">Planned Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p className="font-medium text-slate-900">
                {plannedPlan?.session_label ?? plannedSession.session_type}
              </p>
              {plannedPlan?.primary_focus ? <p>{plannedPlan.primary_focus}</p> : null}
              {plannedPlan?.duration_mins ? (
                <p>Planned duration: {plannedPlan.duration_mins} minutes</p>
              ) : null}
              {plannedPlan?.ai_plan_text ? (
                <p className="whitespace-pre-wrap text-xs text-slate-500">
                  {plannedPlan.ai_plan_text}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {plannedSessionId !== null && isLoadingPlan ? null : (
          <SessionLogForm
            defaultSessionType={plannedSession?.session_type as SessionType | undefined}
            plannedSessionId={plannedSession?.id ?? undefined}
            initialValues={initialValues}
            onSuccess={() => {
              toast.success('Session logged!')
              router.push('/')
            }}
          />
        )}
      </div>
    </div>
  )
}