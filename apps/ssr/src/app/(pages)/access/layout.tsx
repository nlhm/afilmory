import type { Metadata } from 'next'

// Next.js consumes metadata exports from route layouts.
// eslint-disable-next-line react-refresh/only-export-components
export const metadata: Metadata = {
  description: 'Private gallery access',
  robots: {
    follow: false,
    index: false,
  },
  title: 'Private gallery · Afilmory',
}

export const dynamic = 'force-dynamic'

export default function AccessLayout({ children }: { children: React.ReactNode }) {
  return children
}
