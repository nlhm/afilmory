import { DOMParser } from 'linkedom'

import type { HtmlDocument } from '../html-document'
import { injectConfigToDocument } from '../injectable'
import type { ServerGalleryManifest } from './manifest'
import { injectManifestToDocument } from './manifest'
import { injectPrivateGalleryRobotsMeta, PRIVATE_GALLERY_ROBOTS_CONTENT } from './privacy'
import { getServerManifest } from './server-manifest'

type GalleryDocument = HtmlDocument

interface RenderGalleryHtmlOptions {
  manifest?: ServerGalleryManifest
  mutateDocument?: (document: GalleryDocument) => void
  status?: number
}

export const injectGalleryDataToDocument = (
  document: GalleryDocument,
  manifest?: ServerGalleryManifest,
) => {
  injectConfigToDocument(document)
  injectManifestToDocument(document, manifest ?? getServerManifest())
  injectPrivateGalleryRobotsMeta(document)
  return document
}

export const renderGalleryHtml = (indexHtml: string, options: RenderGalleryHtmlOptions = {}) => {
  const document = new DOMParser().parseFromString(indexHtml, 'text/html')
  options.mutateDocument?.(document)
  injectGalleryDataToDocument(document, options.manifest)

  return new Response(document.documentElement.outerHTML, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': PRIVATE_GALLERY_ROBOTS_CONTENT,
      'X-SSR': '1',
    },
    status: options.status,
  })
}
