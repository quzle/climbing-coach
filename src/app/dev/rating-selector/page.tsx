'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import { RatingSelector } from '@/components/forms/RatingSelector'
import { IllnessToggle } from '@/components/forms/IllnessToggle'

export default function DevRatingSelectorPage(): React.ReactElement {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  const [sleep, setSleep] = useState<number | null>(null)
  const [fatigue, setFatigue] = useState<number | null>(null)
  const [finger, setFinger] = useState<number | null>(null)
  const [shoulder, setShoulder] = useState<number | null>(null)
  const [illness, setIllness] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <h1 className="text-3xl font-bold text-slate-900">⭐ Rating Components</h1>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-semibold text-slate-900">Sleep quality</p>
          <RatingSelector
            name="sleep-quality"
            value={sleep}
            onChange={setSleep}
            labels={['Terrible', 'Poor', 'OK', 'Good', 'Great']}
          />
          <p className="text-sm text-slate-500">Selected: {sleep ?? 'none'}</p>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-semibold text-slate-900">Body fatigue</p>
          <RatingSelector
            name="body-fatigue"
            value={fatigue}
            onChange={setFatigue}
            labels={['Exhausted', 'Tired', 'OK', 'Fresh', 'Very fresh']}
          />
          <p className="text-sm text-slate-500">Selected: {fatigue ?? 'none'}</p>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-semibold text-slate-900">Finger health</p>
          <RatingSelector
            name="finger-health"
            value={finger}
            onChange={setFinger}
            labels={['Painful', 'Sore', 'OK', 'Good', 'Perfect']}
          />
          <p className="text-sm text-slate-500">Selected: {finger ?? 'none'}</p>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-semibold text-slate-900">Shoulder health</p>
          <RatingSelector
            name="shoulder-health"
            value={shoulder}
            onChange={setShoulder}
            labels={['Painful', 'Uncomfortable', 'OK', 'Good', 'Perfect']}
          />
          <p className="text-sm text-slate-500">Selected: {shoulder ?? 'none'}</p>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-semibold text-slate-900">Illness toggle</p>
          <IllnessToggle value={illness} onChange={setIllness} />
          <p className="text-sm text-slate-500">Illness flag: {illness ? 'Yes' : 'No'}</p>
        </section>
      </div>
    </div>
  )
}