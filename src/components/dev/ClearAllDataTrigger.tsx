'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { ApiResponse } from '@/types'
import type { ClearAllResult } from '@/app/api/dev/clear-all/route'

type ClearState =
  | { status: 'idle' }
  | { status: 'confirming' }
  | { status: 'clearing' }
  | { status: 'success'; tablesCleared: Record<string, number> }
  | { status: 'error'; message: string }

/**
 * @description Dev-only trigger that deletes all rows from all application tables.
 * Requires a confirmation step before executing.
 */
export function ClearAllDataTrigger(): React.JSX.Element {
  const [state, setState] = useState<ClearState>({ status: 'idle' })

  async function handleClearAll(): Promise<void> {
    setState({ status: 'clearing' })

    try {
      const response = await fetch('/api/dev/clear-all', { method: 'POST' })
      const json = (await response.json()) as ApiResponse<ClearAllResult>

      if (!response.ok || json.error !== null || json.data === null) {
        setState({ status: 'error', message: json.error ?? 'Failed to clear database.' })
        return
      }

      setState({ status: 'success', tablesCleared: json.data.tablesCleared })
    } catch {
      setState({ status: 'error', message: 'Failed to clear database.' })
    }
  }

  const totalRows =
    state.status === 'success'
      ? Object.values(state.tablesCleared).reduce((sum, n) => sum + n, 0)
      : 0

  return (
    <section className="space-y-3 rounded-2xl border-2 border-red-200 bg-red-50/70 p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Clear All Data</h2>
        <p className="text-sm text-slate-600">
          Delete every row from every table. Use this to reset the database to a blank
          state before re-seeding. This cannot be undone.
        </p>
      </div>

      {state.status === 'idle' && (
        <Button
          type="button"
          variant="destructive"
          className="min-h-[44px]"
          onClick={() => setState({ status: 'confirming' })}
        >
          Clear All Data
        </Button>
      )}

      {state.status === 'confirming' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-red-700">
            Are you sure? All data will be permanently deleted.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              className="min-h-[44px]"
              onClick={() => void handleClearAll()}
            >
              Yes, delete everything
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setState({ status: 'idle' })}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {state.status === 'clearing' && (
        <Button type="button" variant="destructive" className="min-h-[44px]" disabled>
          Clearing...
        </Button>
      )}

      {state.status === 'success' && (
        <div className="space-y-2">
          <p className="text-sm text-red-700" role="status">
            {totalRows} rows deleted across {Object.keys(state.tablesCleared).length} tables.
          </p>
          <ul className="text-xs text-slate-600 space-y-0.5">
            {Object.entries(state.tablesCleared).map(([table, count]) => (
              <li key={table}>
                {table}: {count} row{count !== 1 ? 's' : ''}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => setState({ status: 'idle' })}
          >
            Done
          </Button>
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-red-600" role="status">
            {state.message}
          </p>
          <Button
            type="button"
            variant="destructive"
            className="min-h-[44px]"
            onClick={() => setState({ status: 'idle' })}
          >
            Try again
          </Button>
        </div>
      )}
    </section>
  )
}
