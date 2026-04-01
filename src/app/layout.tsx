import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider, type ClientAuthUser } from '@/components/providers/auth-provider'
import { BottomNav } from '@/components/layout/BottomNav'
import { Toaster } from '@/components/ui/sonner'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { getProfile } from '@/services/data/profilesRepository'
import type { InviteStatus, UserRole } from '@/types'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Climbing Coach',
  description: 'AI-powered climbing training assistant',
}

function toUserRole(value: string | null | undefined): UserRole | null {
  return value === 'user' || value === 'superuser' ? value : null
}

function toInviteStatus(value: string | null | undefined): InviteStatus | null {
  return value === 'invited' || value === 'active' ? value : null
}

async function resolveInitialUser(): Promise<ClientAuthUser | null> {
  try {
    const user = await getCurrentUser()
    const profileResult = await getProfile(user.id)

    return {
      id: user.id,
      email: user.email ?? null,
      displayName: profileResult.data?.display_name ?? null,
      role: toUserRole(profileResult.data?.role),
      inviteStatus: toInviteStatus(profileResult.data?.invite_status),
    }
  } catch {
    return null
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): Promise<React.JSX.Element> {
  return renderLayout(children)
}

async function renderLayout(children: React.ReactNode): Promise<React.JSX.Element> {
  const initialUser = await resolveInitialUser()

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-16">
        <AuthProvider initialUser={initialUser}>
          {children}
          <BottomNav />
          <Toaster position="top-center" />
        </AuthProvider>
      </body>
    </html>
  )
}
