'use client'

import { createContext, useContext, useState } from 'react'
import type { InviteStatus, UserRole } from '@/types'

export type ClientAuthUser = {
  id: string
  email: string | null
  displayName: string | null
  role: UserRole | null
  inviteStatus: InviteStatus | null
}

type AuthContextValue = {
  user: ClientAuthUser | null
  isAuthenticated: boolean
  setUser: (user: ClientAuthUser | null) => void
  updateProfile: (userPatch: Partial<ClientAuthUser>) => void
  clearUser: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

type AuthProviderProps = {
  children: React.ReactNode
  initialUser: ClientAuthUser | null
}

/**
 * @description Provides authenticated user and profile metadata to client
 * components so UI state can react to the current signed-in user.
 * @param children Rendered application subtree
 * @param initialUser Authenticated user snapshot resolved server-side
 * @returns Context provider wrapping the application subtree
 */
export function AuthProvider({
  children,
  initialUser,
}: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<ClientAuthUser | null>(initialUser)

  function updateProfile(userPatch: Partial<ClientAuthUser>): void {
    setUser((currentUser) => {
      if (currentUser === null) {
        return currentUser
      }

      return {
        ...currentUser,
        ...userPatch,
      }
    })
  }

  function clearUser(): void {
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        setUser,
        updateProfile,
        clearUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * @description Reads the shared auth/profile context for client components.
 * @returns Current auth context value
 * @throws {Error} When used outside an AuthProvider
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}