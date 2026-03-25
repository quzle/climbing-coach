'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ClipboardCheck, Dumbbell, MessageCircle, History } from 'lucide-react'

const TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/readiness', label: 'Check-in', icon: ClipboardCheck },
  { href: '/session/log', label: 'Log', icon: Dumbbell },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/history', label: 'History', icon: History },
] as const

/**
 * @description Fixed bottom navigation bar with 5 tabs. Uses the current
 * pathname to highlight the active tab. Rendered inside the root layout so
 * it appears on every page.
 */
export function BottomNav(): React.JSX.Element {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white safe-area-inset-bottom">
      <div className="flex h-16 items-stretch">
        {TABS.map(({ href, label, icon: Icon }) => {
          // Exact match for home; prefix match for all other tabs.
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 min-h-[44px] text-xs transition-colors ${
                isActive
                  ? 'text-blue-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="size-5" aria-hidden />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
