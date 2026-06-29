import type { PhotoManifestItem } from '@afilmory/builder'
import siteConfig from '@config'
import type { NextRequest } from 'next/server'

import indexHtml from '~/index.html'
import { renderGalleryHtml } from '~/lib/gallery-access/gallery-html'
import { photoLoader } from '~/lib/photo-loader'

export const handler = async (request: NextRequest, { params }: { params: Promise<{ photoId: string }> }) => {
  const { photoId } = await params

  const photo = photoLoader.getPhoto(photoId)
  if (!photo) {
    return renderGalleryHtml(indexHtml, { status: 404 })
  }

  try {
    return renderGalleryHtml(indexHtml, {
      mutateDocument(document) {
        document.head.childNodes.forEach((node) => {
          if (node.nodeName === 'META') {
            const $meta = node as HTMLMetaElement
            if ($meta.getAttribute('name')?.startsWith('twitter:')) {
              $meta.remove()
            }
            if ($meta.getAttribute('property')?.startsWith('og:')) {
              $meta.remove()
            }
          }
        })
        document.head.title = `${photo.id} | ${siteConfig.title}`
      },
    })
  }
  catch (error) {
    console.error('Error generating SSR page:', error)

    return renderGalleryHtml(indexHtml, { status: 500 })
  }
}
