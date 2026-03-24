// TODO SETUP-16: Replace with full dashboard
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const NAV_LINKS = [
  { href: '/readiness', label: 'Daily Check-in' },
  { href: '/session/log', label: 'Log Session' },
  { href: '/chat', label: 'Coach Chat' },
  { href: '/dev', label: 'Component Testing (dev)' },
]

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Climbing Coach</h1>
          <p className="mt-2 text-slate-500">AI-powered training assistant</p>
        </div>

        <div className="flex flex-col gap-3">
          {NAV_LINKS.map(({ href, label }) => (
            <Button key={href} variant="outline" className="h-12 w-full text-base" asChild>
              <Link href={href}>{label}</Link>
            </Button>
          ))}
        </div>

        <p className="text-xs text-slate-400 text-center">
          Home dashboard coming in SETUP-16
        </p>
      </div>
    </div>
  )
}
