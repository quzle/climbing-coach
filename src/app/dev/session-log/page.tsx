'use client'

import { notFound } from 'next/navigation'
import { SessionLogForm } from '@/components/forms/SessionLogForm'

export default function DevSessionLogPage(): React.ReactElement {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">📝 Session Log Testing</h1>
        <p className="text-slate-600">Starting from session type selection</p>
      </div>

      <div className="mx-auto mt-6 max-w-3xl">
        <SessionLogForm
          mockMode
          onSuccess={() => {
            console.log('Session logged')
          }}
        />
      </div>
    </div>
  )
}