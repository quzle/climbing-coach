'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { SessionLogForm } from '@/components/forms/SessionLogForm'

/**
 * @description Session logging page. On successful submission, shows a success
 * toast and redirects to the home dashboard.
 */
export default function SessionLogPage(): React.JSX.Element {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Log Session</h1>
        <SessionLogForm
          onSuccess={() => {
            toast.success('Session logged!')
            router.push('/')
          }}
        />
      </div>
    </div>
  )
}
