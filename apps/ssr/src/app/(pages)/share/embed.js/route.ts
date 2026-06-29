import { SHARE_EMBED_SCRIPT } from '@afilmory/sdk'

import { requireGallerySession } from '~/lib/gallery-access/request'
import { PRIVATE_GALLERY_ROBOTS_CONTENT } from '~/lib/gallery-access/privacy'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const unauthorized = requireGallerySession(request)
  if (unauthorized) {
    return unauthorized
  }

  return new Response(SHARE_EMBED_SCRIPT, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': PRIVATE_GALLERY_ROBOTS_CONTENT,
    },
  })
}
