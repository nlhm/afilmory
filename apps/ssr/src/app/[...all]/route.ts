import process from 'node:process'

import type { NextRequest } from 'next/server'

import { renderGalleryHtml } from '~/lib/gallery-access/gallery-html'
import { requireGalleryHtmlSession, requireGallerySession } from '~/lib/gallery-access/request'

const renderIndex = async () => {
  const indexHtml = await import('../../index.html').then(m => m.default)
  return renderGalleryHtml(indexHtml)
}

const handler = async (req: NextRequest) => {
  const acceptsHtml = req.headers.get('accept')?.includes('text/html')
  const unauthorized
    = acceptsHtml && (req.method === 'GET' || req.method === 'HEAD')
      ? requireGalleryHtmlSession(req)
      : requireGallerySession(req)
  if (unauthorized) {
    return unauthorized
  }

  if (process.env.NODE_ENV === 'development') {
    return import('./dev').then(m => m.handler(req))
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response(null, { status: 404 })
  }

  if (!acceptsHtml) {
    return new Response(null, { status: 404 })
  }

  return renderIndex()
}

export const GET = handler
export const HEAD = handler
export const OPTIONS = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
