import './globals.css'

import type { Metadata } from 'next'

import { RootProviders } from '~/providers'

export const metadata: Metadata = {
  robots: {
    googleBot: {
      follow: false,
      index: false,
      noarchive: true,
    },
    follow: false,
    index: false,
    noarchive: true,
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  )
}
