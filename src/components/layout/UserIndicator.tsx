'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { LogoutButton } from '@/components/layout/LogoutButton'

/**
 * @description Displays the current signed-in user's identity in the app
 * chrome and provides access to account settings and logout.
 * @returns User indicator element, or an empty fragment when unauthenticated
 */
export function UserIndicator(): React.JSX.Element {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated || user === null) {
    return <></>
  }

  const primaryLabel = user.displayName ?? user.email ?? 'Signed in'

  return (
    <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{primaryLabel}</p>
        {user.displayName && user.email && (
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Link
          href="/profile"
          className="inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          Account
        </Link>
        <LogoutButton />
      </div>
    </div>
  )
}