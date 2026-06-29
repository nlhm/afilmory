import { SHARE_EMBED_SCRIPT } from '@afilmory/sdk'

import { requireGallerySession } from '~/lib/gallery-access/request'

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
    },
  })
}
