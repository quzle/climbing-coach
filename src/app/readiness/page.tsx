'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ReadinessForm } from '@/components/forms/ReadinessForm'

/**
 * @description Daily readiness check-in page. On successful submission,
 * shows a success toast and redirects to the home dashboard.
 */
export default function ReadinessPage(): React.JSX.Element {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Daily Check-in</h1>
        <ReadinessForm
          onSuccess={() => {
            toast.success('Check-in saved!')
            router.push('/')
          }}
        />
      </div>
    </div>
  )
}
