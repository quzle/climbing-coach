'use client'

import { useEffect, useState } from 'react'
import { ClearAllDataTrigger } from '@/components/dev/ClearAllDataTrigger'
import { SeedProgrammeTrigger } from '@/components/dev/SeedProgrammeTrigger'
import type { ApiResponse } from '@/types'

type SeedTargetUser = {
  id: string
  email: string
  display_name: string | null
  role: 'user' | 'superuser'
  invite_status: 'invited' | 'active'
}

/**
 * @description Loads target users and wires seed/reset triggers to the selected user.
 * @returns User-targeted seed tooling for the dev dashboard.
 */
export function SeedDataTools(): React.JSX.Element {
  const [users, setUsers] = useState<SeedTargetUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadUsers(): Promise<void> {
      try {
        const response = await fetch('/api/dev/seed-targets')
        const json = (await response.json()) as ApiResponse<SeedTargetUser[]>

        if (!response.ok || json.error !== null || json.data === null) {
          if (isActive) {
            setErrorMessage(json.error ?? 'Failed to load target users.')
          }
          return
        }

        if (!isActive) {
          return
        }

        setUsers(json.data)
        setSelectedUserId((current) => current ?? json.data[0]?.id ?? null)
      } catch {
        if (isActive) {
          setErrorMessage('Failed to load target users.')
        }
      }
    }

    void loadUsers()

    return () => {
      isActive = false
    }
  }, [])

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-2xl border-2 border-slate-200 bg-white p-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Seed Target User</h2>
          <p className="text-sm text-slate-600">
            Pick which user receives seeded programme data and reset operations.
          </p>
        </div>

        <label className="text-sm font-medium text-slate-900" htmlFor="seed-target-user">
          Target User
        </label>
        <select
          id="seed-target-user"
          className="min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          value={selectedUserId ?? ''}
          onChange={(event) => setSelectedUserId(event.target.value || null)}
        >
          {users.length === 0 ? (
            <option value="">No users available</option>
          ) : null}
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.display_name ?? user.email} ({user.role})
            </option>
          ))}
        </select>

        {errorMessage !== null ? (
          <p className="text-sm text-red-600" role="status">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <SeedProgrammeTrigger targetUserId={selectedUserId} />
      <ClearAllDataTrigger targetUserId={selectedUserId} />
    </div>
  )
}
