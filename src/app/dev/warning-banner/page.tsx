import { notFound } from 'next/navigation'
import { WarningBanner } from '@/components/ui/WarningBanner'

type BannerSectionProps = {
  title: string
  children: React.ReactNode
}

function BannerSection({ title, children }: BannerSectionProps): React.ReactElement {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  )
}

export default function DevWarningBannerPage(): React.ReactElement {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">⚠️ Warning Banner States</h1>

        <BannerSection title="Empty (renders nothing)">
          <WarningBanner warnings={[]} />
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-500">
            No banner rendered — empty array
          </div>
        </BannerSection>

        <BannerSection title="Single advisory">
          <WarningBanner warnings={['🟡 Finger health low (3/5) — no fingerboard']} />
        </BannerSection>

        <BannerSection title="Multiple advisory">
          <WarningBanner
            warnings={[
              '🟡 Finger health low (3/5) — no fingerboard',
              '🟡 Weekly readiness average low (2.8/5)',
            ]}
          />
        </BannerSection>

        <BannerSection title="Single critical">
          <WarningBanner
            warnings={['🔴 ILLNESS FLAG ACTIVE — no climbing or fingerboard']}
            onDismiss={() => {
              console.log('Banner dismissed')
            }}
          />
        </BannerSection>

        <BannerSection title="Mixed critical and advisory">
          <WarningBanner
            warnings={[
              '🔴 Shoulder health critical (2/5) — remove all pressing movements',
              '🟡 Finger health low (3/5) — no fingerboard',
              '🟡 Weekly readiness average low (2.4/5)',
            ]}
            onDismiss={() => {
              console.log('Banner dismissed')
            }}
          />
        </BannerSection>
      </div>
    </div>
  )
}