import { getGalleryAccessConfig } from './config'
import { GALLERY_ACCESS_COOKIE_NAME, verifyGallerySessionToken } from './session'

const readCookie = (cookieHeader: string | null, name: string) => {
  if (!cookieHeader) {
    return null
  }

  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=')
    if (separator === -1) {
      continue
    }

    const cookieName = item.slice(0, separator).trim()
    if (cookieName === name) {
      return item.slice(separator + 1).trim()
    }
  }

  return null
}

export const hasValidGallerySession = (request: Request, sessionSecret: string) => {
  const token = readCookie(request.headers.get('cookie'), GALLERY_ACCESS_COOKIE_NAME)
  return token !== null && verifyGallerySessionToken(token, sessionSecret)
}

export const requireGallerySession = (request: Request) => {
  const { sessionSecret } = getGalleryAccessConfig()
  if (hasValidGallerySession(request, sessionSecret)) {
    return null
  }

  return new Response('Unauthorized', {
    headers: {
      'Cache-Control': 'private, no-store',
    },
    status: 401,
  })
}

export const requireGalleryHtmlSession = (request: Request) => {
  const unauthorized = requireGallerySession(request)
  if (!unauthorized) {
    return null
  }

  const requestUrl = new URL(request.url)
  const accessUrl = new URL('/access', requestUrl)
  accessUrl.searchParams.set('next', `${requestUrl.pathname}${requestUrl.search}`)

  return Response.redirect(accessUrl, 307)
}
