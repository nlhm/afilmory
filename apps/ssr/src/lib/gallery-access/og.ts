import { PRIVATE_GALLERY_ROBOTS_CONTENT } from './privacy'
import { requireGallerySession } from './request'

interface GalleryOgDependencies {
  backendUrl: string
  forwardHeaders: Headers
  fetch: typeof globalThis.fetch
  resolveThumbnail: (photoId: string) => string | undefined
}

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': PRIVATE_GALLERY_ROBOTS_CONTENT,
}

export const handleGalleryOgRequest = async (request: Request, photoId: string, dependencies: GalleryOgDependencies) => {
  const unauthorized = requireGallerySession(request)
  if (unauthorized) {
    return unauthorized
  }

  const fallback = () => {
    const thumbnail = dependencies.resolveThumbnail(photoId)
    const url = thumbnail ? new URL(thumbnail, request.url) : undefined
    if (!url || url.origin !== new URL(request.url).origin || !url.pathname.startsWith('/thumbnails/')) {
      return new Response('Not Found', { status: 404, headers: privateHeaders })
    }
    return new Response(null, {
      status: 302,
      headers: { ...privateHeaders, Location: `${url.pathname}${url.search}` },
    })
  }

  let response: Response
  try {
    response = await dependencies.fetch(dependencies.backendUrl, {
      headers: dependencies.forwardHeaders,
      signal: AbortSignal.timeout(5000),
    })
  }
  catch {
    return fallback()
  }

  if (response.status >= 500) {
    await response.body?.cancel()
    return fallback()
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      ...privateHeaders,
      'Content-Type': response.headers.get('content-type') || (response.ok ? 'image/png' : 'text/plain; charset=utf-8'),
    },
  })
}
