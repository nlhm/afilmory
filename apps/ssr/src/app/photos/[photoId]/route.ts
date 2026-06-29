import process from 'node:process'

import type { NextRequest } from 'next/server'

import { requireGalleryHtmlSession } from '~/lib/gallery-access/request'

type PhotoRouteContext = { params: Promise<{ photoId: string }> }

export const GET = async (request: NextRequest, context: PhotoRouteContext) => {
  const unauthorized = requireGalleryHtmlSession(request)
  if (unauthorized) {
    return unauthorized
  }

  if (process.env.NODE_ENV === 'development') {
    return import('./dev').then(m => m.handler(request))
  }

  return import('./prod').then(m => m.handler(request, context))
}
