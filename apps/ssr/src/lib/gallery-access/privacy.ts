import type { HtmlDocument } from '../html-document'

export const PRIVATE_GALLERY_ROBOTS_CONTENT = 'noindex, nofollow, noarchive'
export const PRIVATE_GALLERY_ROBOTS_TXT = 'User-agent: *\nDisallow: /\n'

const upsertMeta = (document: HtmlDocument, selector: string, attributes: Record<string, string>) => {
  const existing = document.head.querySelector(selector)
  const element = existing ?? document.createElement('meta', {})

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value)
  }

  if (!existing) {
    document.head.append(element)
  }
}

export const injectPrivateGalleryRobotsMeta = (document: HtmlDocument) => {
  upsertMeta(document, 'meta[name="robots"]', {
    content: PRIVATE_GALLERY_ROBOTS_CONTENT,
    name: 'robots',
  })
  upsertMeta(document, 'meta[name="googlebot"]', {
    content: PRIVATE_GALLERY_ROBOTS_CONTENT,
    name: 'googlebot',
  })

  return document
}
