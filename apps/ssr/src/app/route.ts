import process from 'node:process'

import type { NextRequest } from 'next/server'

import { renderGalleryHtml } from '~/lib/gallery-access/gallery-html'
import { requireGalleryHtmlSession } from '~/lib/gallery-access/request'

export const GET = async (req: NextRequest) => {
  const unauthorized = requireGalleryHtmlSession(req)
  if (unauthorized) {
    return unauthorized
  }

  if (process.env.NODE_ENV === 'development') {
    return import('./[...all]/dev').then(m => m.handler(req))
  }
  const indexHtml = await import('../index.html').then(m => m.default)
  return renderGalleryHtml(indexHtml)
}
