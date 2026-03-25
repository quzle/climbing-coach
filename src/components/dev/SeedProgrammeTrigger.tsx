'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ApiResponse } from '@/types'
import type { SeedProgrammeResult } from '@/services/training/programmeSeed'

type SeedState =
  | { status: 'idle'; message: string | null }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

function buildSuccessMessage(result: SeedProgrammeResult): string {
  if (!result.seeded) {
    return `${result.programmeName} already exists. No new rows were created.`
  }

  return [
    `${result.programmeName} seeded successfully.`,
    `${result.createdMesocycleCount} mesocycles, ${result.createdWeeklyTemplateCount} weekly templates, and ${result.createdPlannedSessionCount} planned sessions created.`,
  ].join(' ')
}

/**
 * @description Small dev-only trigger for creating the Phase 2F starter programme without using a manual API call.
 * @returns Button and inline result state for the dev dashboard.
 */
export function SeedProgrammeTrigger(): React.JSX.Element {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [seedState, setSeedState] = useState<SeedState>({ status: 'idle', message: null })

  async function handleSeedProgramme(): Promise<void> {
    setIsSubmitting(true)
    setSeedState({ status: 'idle', message: null })

    try {
      const response = await fetch('/api/dev/seed-programme', {
        method: 'POST',
      })
      const json = (await response.json()) as ApiResponse<SeedProgrammeResult>

      if (!response.ok || json.error !== null || json.data === null) {
        setSeedState({
          status: 'error',
          message: json.error ?? 'Failed to seed the starter programme.',
        })
        return
      }

      setSeedState({
        status: 'success',
        message: buildSuccessMessage(json.data),
      })
    } catch {
      setSeedState({
        status: 'error',
        message: 'Failed to seed the starter programme.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Phase 2F Seed Data</h2>
        <p className="text-sm text-slate-600">
          Create the starter Summer Multipitch Season dataset so the planner has
          real programme, mesocycle, template, and planned-session rows to work with.
        </p>
      </div>

      <Button
        type="button"
        className="min-h-[44px]"
        disabled={isSubmitting}
        onClick={() => {
          void handleSeedProgramme()
        }}
      >
        {isSubmitting ? 'Seeding Programme...' : 'Seed Summer Multipitch Programme'}
      </Button>

      {seedState.message !== null ? (
        <p
          className={
            seedState.status === 'error'
              ? 'text-sm text-red-600'
              : 'text-sm text-emerald-700'
          }
          role="status"
        >
          {seedState.message}
        </p>
      ) : null}
    </section>
  )
}