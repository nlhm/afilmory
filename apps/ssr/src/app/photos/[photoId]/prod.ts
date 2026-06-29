import type { PhotoManifestItem } from '@afilmory/builder'
import siteConfig from '@config'
import type { NextRequest } from 'next/server'

import indexHtml from '~/index.html'
import { renderGalleryHtml } from '~/lib/gallery-access/gallery-html'
import type { HtmlDocument } from '~/lib/html-document'
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
        // Remove all twitter meta tags and open graph meta tags
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
        createAndInsertOpenGraphMeta(document, photo, request)
      },
    })
  }
  catch (error) {
    console.error('Error generating SSR page:', error)

    return renderGalleryHtml(indexHtml, { status: 500 })
  }
}

const createAndInsertOpenGraphMeta = (document: HtmlDocument, photo: PhotoManifestItem, request: NextRequest) => {
  // Open Graph meta tags

  // X forward host
  const xForwardedHeaders = {
    'x-forwarded-host': request.headers.get('x-forwarded-host'),
    'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
    'x-forwarded-for': request.headers.get('x-forwarded-for'),
  }

  let realOrigin = request.nextUrl.origin
  if (xForwardedHeaders['x-forwarded-host']) {
    realOrigin = `${xForwardedHeaders['x-forwarded-proto'] || 'https'}://${xForwardedHeaders['x-forwarded-host']}`
  }

  const ogTags = {
    'og:type': 'website',
    'og:title': `${photo.id} on ${siteConfig.title}`,
    'og:description': photo.description || '',
    'og:image': `${realOrigin}/og/${photo.id}`,
    'og:url': `${realOrigin}/${photo.id}`,
  }

  for (const [property, content] of Object.entries(ogTags)) {
    const ogMeta = document.createElement('meta', {})
    ogMeta.setAttribute('property', property)
    ogMeta.setAttribute('content', content)
    document.head.append(ogMeta as unknown as Node)
  }

  // Twitter Card meta tags
  const twitterTags = {
    'twitter:card': 'summary_large_image',
    'twitter:title': `${photo.id} on ${siteConfig.title}`,
    'twitter:description': photo.description || '',
    'twitter:image': `${realOrigin}/og/${photo.id}`,
  }

  for (const [name, content] of Object.entries(twitterTags)) {
    const twitterMeta = document.createElement('meta', {})
    twitterMeta.setAttribute('name', name)
    twitterMeta.setAttribute('content', content)
    document.head.append(twitterMeta as unknown as Node)
  }

  return document
}
