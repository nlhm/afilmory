import { getGalleryAccessConfig } from '~/lib/gallery-access/config'
import { clearGallerySessionCookie } from '~/lib/gallery-access/session'

export const handleLogout = (secureCookie: boolean) =>
  new Response(null, {
    headers: {
      'Cache-Control': 'no-store',
      'Location': '/access',
      'Set-Cookie': clearGallerySessionCookie(secureCookie),
    },
    status: 303,
  })

export const POST = () => handleLogout(getGalleryAccessConfig().secureCookie)
