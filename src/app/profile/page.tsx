'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAreaName, KNOWN_AREAS } from '@/components/forms/InjuryAreaSelector'
import type { ApiResponse, InjuryAreaRow } from '@/types'

/**
 * @description Profile page for managing tracked injury areas. Allows the
 * athlete to add new areas to track and archive areas that are no longer
 * relevant. Changes are persisted via the /api/injury-areas REST endpoints.
 *
 * @returns The profile page React element.
 */
export default function ProfilePage(): React.JSX.Element {
  const [areas, setAreas] = useState<InjuryAreaRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNewArea, setSelectedNewArea] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const res = await fetch('/api/injury-areas')
        const json = (await res.json()) as ApiResponse<InjuryAreaRow[]>
        if (!res.ok || json.error) {
          setError(json.error ?? 'Failed to load injury areas.')
          return
        }
        setAreas(json.data ?? [])
      } catch {
        setError('Failed to load injury areas.')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  async function handleArchive(area: string): Promise<void> {
    try {
      const res = await fetch(`/api/injury-areas/${encodeURIComponent(area)}`, {
        method: 'DELETE',
      })
      const json = (await res.json()) as ApiResponse<InjuryAreaRow>
      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Failed to archive area.')
        return
      }
      setAreas((prev) => prev.filter((a) => a.area !== area))
      toast.success(`${formatAreaName(area)} archived.`)
    } catch {
      toast.error('Failed to archive area.')
    }
  }

  async function handleAdd(): Promise<void> {
    if (!selectedNewArea) return
    setIsAdding(true)
    try {
      const res = await fetch('/api/injury-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: selectedNewArea }),
      })
      const json = (await res.json()) as ApiResponse<InjuryAreaRow>
      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Failed to add area.')
        return
      }
      if (json.data) {
        setAreas((prev) => {
          // Avoid duplicates if the area is already in the local list
          if (prev.some((a) => a.area === json.data!.area)) return prev
          return [...prev, json.data!]
        })
      }
      toast.success(`${formatAreaName(selectedNewArea)} is now tracked.`)
      setSelectedNewArea('')
    } catch {
      toast.error('Failed to add area.')
    } finally {
      setIsAdding(false)
    }
  }

  const trackedAreaNames = new Set(areas.map((a) => a.area))
  const availableAreas = KNOWN_AREAS.filter((a) => !trackedAreaNames.has(a))

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Profile</h1>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Tracked injury areas</h2>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : areas.length === 0 ? (
            <p className="text-sm text-slate-500">No areas tracked yet. Add one below.</p>
          ) : (
            <ul className="space-y-2">
              {areas.map((row) => (
                <li key={row.area}>
                  <Card>
                    <CardContent className="flex items-center justify-between py-3 px-4">
                      <span className="text-sm font-medium text-slate-800">
                        {formatAreaName(row.area)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] text-slate-500 hover:text-red-600"
                        onClick={() => void handleArchive(row.area)}
                      >
                        Archive
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Track new area</h2>
          {availableAreas.length === 0 ? (
            <p className="text-sm text-slate-500">All known areas are already tracked.</p>
          ) : (
            <div className="flex gap-2">
              {/* Native <select> used here for JSDOM test compatibility — same
                  pattern as InjuryAreaSelector. Radix UI Select does not work
                  reliably in the test environment. */}
              <select
                value={selectedNewArea}
                onChange={(e) => setSelectedNewArea(e.target.value)}
                aria-label="Select area to track"
                className="flex-1 min-h-[44px] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select area…</option>
                {availableAreas.map((a) => (
                  <option key={a} value={a}>
                    {formatAreaName(a)}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => void handleAdd()}
                disabled={!selectedNewArea || isAdding}
                className="min-h-[44px]"
              >
                Track
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
