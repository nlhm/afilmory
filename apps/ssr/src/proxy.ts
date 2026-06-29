import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getGalleryAccessConfig } from '~/lib/gallery-access/config'
import { hasValidGallerySession } from '~/lib/gallery-access/request'

const PUBLIC_EXACT_PATHS = new Set([
  '/access',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/api/gallery-access/logout',
  '/api/gallery-access/unlock',
  '/apple-touch-icon.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-48x48.png',
  '/favicon.ico',
  '/site.webmanifest',
])

const PUBLIC_BUNDLE_PATTERN = /^\/assets\/[^/]+\.(?:css|js|map)$/

export const isPublicGalleryPath = (pathname: string) =>
  PUBLIC_EXACT_PATHS.has(pathname) || pathname.startsWith('/_next/static/') || PUBLIC_BUNDLE_PATTERN.test(pathname)

const isHtmlNavigation = (request: NextRequest) => {
  const accept = request.headers.get('accept') || ''
  const destination = request.headers.get('sec-fetch-dest')
  return destination === 'document' || accept.split(',').some(value => value.trim().startsWith('text/html'))
}

export const handleGalleryAccessProxy = (request: NextRequest, sessionSecret: string) => {
  if (isPublicGalleryPath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  if (hasValidGallerySession(request, sessionSecret)) {
    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  }

  if ((request.method === 'GET' || request.method === 'HEAD') && isHtmlNavigation(request)) {
    const accessUrl = new URL('/access', request.url)
    accessUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(accessUrl, 307)
  }

  return new NextResponse('Unauthorized', {
    headers: {
      'Cache-Control': 'private, no-store',
    },
    status: 401,
  })
}

export function proxy(request: NextRequest) {
  const { sessionSecret } = getGalleryAccessConfig()
  return handleGalleryAccessProxy(request, sessionSecret)
}

export const config = {
  matcher: '/:path*',
}
