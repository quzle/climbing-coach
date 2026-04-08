import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in - Climbing Coach',
}

/**
 * @description Layout for auth pages. Omits the global BottomNav so
 * unauthenticated users see a clean, focused screen.
 *
 * @param children Auth page content
 * @returns Auth layout without navigation chrome
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      {children}
    </main>
  )
}
