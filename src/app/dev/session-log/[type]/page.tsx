'use client'

import { notFound } from 'next/navigation'
import { SessionLogForm } from '@/components/forms/SessionLogForm'
import type { SessionType } from '@/types'

type PageProps = {
  params: { type: string }
}

const validTypes = [
  'bouldering',
  'kilterboard',
  'lead',
  'fingerboard',
  'strength',
  'aerobic',
] as const

function formatTypeLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export default function DevSessionTypePage({ params }: PageProps): React.ReactElement {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  if (!validTypes.includes(params.type as (typeof validTypes)[number])) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">
          Testing: {formatTypeLabel(params.type)} session
        </h1>
      </div>

      <div className="mx-auto mt-6 max-w-3xl">
        <SessionLogForm
          defaultSessionType={params.type as SessionType}
          mockMode
          onSuccess={() => {
            console.log('Session logged')
          }}
        />
      </div>
    </div>
  )
}