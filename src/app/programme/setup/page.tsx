import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * @description Temporary setup guidance page for creating a training plan
 * before the full builder UI is implemented.
 * @returns Programme setup guidance page.
 */
export default function ProgrammeSetupPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-6 pb-24 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Set Up Training Plan</h1>

        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>
              The read-only Training Plan view is live, but the in-app plan builder
              editor is not shipped yet.
            </p>
            <p>
              For now, create your plan data directly in Supabase using the tables
              below.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual Setup Steps (Temporary)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>1. Add one row in programmes (name, goal, start_date, target_date).</p>
            <p>2. Add mesocycle rows linked by programme_id.</p>
            <p>3. Add weekly_templates rows linked by mesocycle_id.</p>
            <p>4. Optionally add planned_sessions rows for the next 7 days.</p>
            <p>5. Return to Training Plan and refresh.</p>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link href="/programme">Back to Training Plan</Link>
          </Button>
          <Button asChild className="min-h-[44px]">
            <Link href="/chat">Open Chat</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
