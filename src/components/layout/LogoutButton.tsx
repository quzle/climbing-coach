'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { clearUserStorage } from '@/lib/user-storage'
import { Button } from '@/components/ui/button'

/**
 * @description Signs the authenticated user out of Supabase and returns them
 * to the login page.
 * @returns Logout button element
 */
export function LogoutButton(): React.JSX.Element {
  const router = useRouter()
  const { clearUser, user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleLogout(): Promise<void> {
    setIsSubmitting(true)
    const userId = user?.id

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('[LogoutButton] signOut failed:', error.message)
        toast.error('Failed to sign out. Please try again.')
        return
      }

      if (userId) {
        clearUserStorage(userId)
      }
      clearUser()
      router.push('/auth/login')
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="min-h-[44px] gap-2 text-slate-600"
      onClick={() => void handleLogout()}
      disabled={isSubmitting}
    >
      <LogOut className="size-4" aria-hidden />
      {isSubmitting ? 'Signing out...' : 'Log out'}
    </Button>
  )
}