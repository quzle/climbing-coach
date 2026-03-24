'use client'

import { notFound } from 'next/navigation'
import { ReadinessForm } from '@/components/forms/ReadinessForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function DevReadinessFormPage(): React.ReactElement {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">📋 Readiness Form Testing</h1>

        <Tabs defaultValue="no-warnings" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="no-warnings">No warnings</TabsTrigger>
            <TabsTrigger value="advisory">Advisory warnings</TabsTrigger>
            <TabsTrigger value="critical">Critical / illness</TabsTrigger>
          </TabsList>

          <TabsContent value="no-warnings">
            <ReadinessForm
              mockMode
              mockWarnings={[]}
              onSuccess={(warnings) => {
                console.log('Submitted, warnings:', warnings)
              }}
            />
          </TabsContent>

          <TabsContent value="advisory">
            <ReadinessForm
              mockMode
              mockWarnings={[
                '🟡 Finger health low (3/5) — no fingerboard, reduce climbing volume by 50%',
                '🟡 Weekly readiness average low (2.8/5) — consider modified session',
              ]}
              onSuccess={(warnings) => {
                console.log('Submitted, warnings:', warnings)
              }}
            />
          </TabsContent>

          <TabsContent value="critical">
            <ReadinessForm
              mockMode
              mockWarnings={[
                '🔴 ILLNESS FLAG ACTIVE — no climbing or fingerboard training. Light mobility only.',
                '🔴 Finger health critical (2/5) — no fingerboard, no bouldering, consider rest day.',
              ]}
              onSuccess={(warnings) => {
                console.log('Submitted, warnings:', warnings)
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}