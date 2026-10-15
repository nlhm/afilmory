import './styles/index.css'
import './lib/viewer-diagnostics'

import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import { AppSkeleton } from './components/ui/app-skeleton'
import { purgeLegacyPhotoCaches } from './lib/gallery-access'
import { router } from './router'

if ('caches' in globalThis) {
  void purgeLegacyPhotoCaches().catch((error) => {
    console.warn('Failed to clear legacy photo caches:', error)
  })
}

createRoot(document.querySelector('#root')!).render(
  <Suspense fallback={<AppSkeleton />}>
    <RouterProvider router={router} />
  </Suspense>,
)
