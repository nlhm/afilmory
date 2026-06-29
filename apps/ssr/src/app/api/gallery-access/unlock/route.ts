import { getGalleryAccessConfig } from '~/lib/gallery-access/config'
import { verifyGalleryPassword } from '~/lib/gallery-access/password'
import { getSafeGalleryRedirect } from '~/lib/gallery-access/redirect'
import { createGallerySessionCookie } from '~/lib/gallery-access/session'

interface UnlockConfig {
  passwordHash: string
  secureCookie: boolean
  sessionSecret: string
}

const unauthorizedResponse = () =>
  new Response(
    '<!doctype html><html><body><h1>Unable to unlock gallery</h1><p>The password is incorrect.</p></body></html>',
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
      },
      status: 401,
    },
  )

export const handleUnlock = async (request: Request, config: UnlockConfig) => {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    return unauthorizedResponse()
  }

  const form = new URLSearchParams(await request.text())
  const password = form.get('password') || ''

  if (!password || password.length > 1024 || !(await verifyGalleryPassword(password, config.passwordHash))) {
    return unauthorizedResponse()
  }

  return new Response(null, {
    headers: {
      'Cache-Control': 'no-store',
      'Location': getSafeGalleryRedirect(form.get('next')),
      'Set-Cookie': createGallerySessionCookie(config.sessionSecret, { secure: config.secureCookie }),
    },
    status: 303,
  })
}

export const POST = (request: Request) => handleUnlock(request, getGalleryAccessConfig())
