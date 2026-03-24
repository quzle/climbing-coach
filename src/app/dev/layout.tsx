import { notFound } from 'next/navigation'

export default function DevLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <div>
      <div className="bg-yellow-400 text-yellow-900 text-xs text-center py-1 fixed top-0 left-0 right-0 z-50">
        ⚠️ Development testing pages — not visible in production
      </div>
      <main className="pt-6">{children}</main>
    </div>
  )
}