import { Suspense } from 'react'
import { SessionLogContent } from './session-log-content'

/**
 * @description Session logging route wrapper. The inner client content reads
 * search params, so it must render under Suspense for static prerender.
 * @returns Session log page shell with suspense boundary.
 */
export default function SessionLogPage(): React.JSX.Element {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <SessionLogContent />
    </Suspense>
  )
}
