import Link from 'next/link'
import { notFound } from 'next/navigation'
import { InviteManagementControls } from '@/components/dev/InviteManagementControls'
import { SeedDataTools } from '@/components/dev/SeedDataTools'

const DEV_CARDS = [
  {
    href: '/dev/readiness-form',
    icon: '📋',
    title: 'Readiness Form',
    subtitle: 'Test daily check-in',
  },
  {
    href: '/dev/session-log',
    icon: '📝',
    title: 'Session Log',
    subtitle: 'All session types',
  },
  {
    href: '/dev/session-log/bouldering',
    icon: '🧗',
    title: 'Bouldering Log',
    subtitle: 'With attempt tracking',
  },
  {
    href: '/dev/session-log/strength',
    icon: '💪',
    title: 'Strength Log',
    subtitle: 'Exercise tracking',
  },
  {
    href: '/dev/session-log/fingerboard',
    icon: '🤲',
    title: 'Fingerboard Log',
    subtitle: 'Set tracking',
  },
  {
    href: '/dev/session-log/aerobic',
    icon: '🥾',
    title: 'Aerobic Log',
    subtitle: 'Hiking / ski touring',
  },
  {
    href: '/dev/warning-banner',
    icon: '⚠️',
    title: 'Warning Banner',
    subtitle: 'All warning states',
  },
  {
    href: '/dev/rating-selector',
    icon: '⭐',
    title: 'Rating Selector',
    subtitle: 'Rating components',
  },
]

export default function DevPage(): React.ReactElement {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">🛠 Dev Component Testing</h1>
          <p className="mt-1 text-slate-600">Only visible in development mode</p>
        </div>

        <InviteManagementControls />

        <SeedDataTools />

        <div className="grid grid-cols-2 gap-3">
          {DEV_CARDS.map((card) => (
            <Link key={card.href} href={card.href}>
              <div className="rounded-xl border-2 border-slate-200 bg-white p-4 flex flex-col gap-1 hover:border-slate-400 hover:bg-slate-50 transition-all cursor-pointer">
                <span className="text-2xl leading-none">{card.icon}</span>
                <p className="font-semibold text-slate-900">{card.title}</p>
                <p className="text-sm text-slate-500">{card.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}