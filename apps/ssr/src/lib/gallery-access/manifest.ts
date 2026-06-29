import type { HtmlDocument } from '../html-document'
import { serializeForInlineScript } from '../inline-script'

interface LivePhotoSource {
  s3Key: string
  type: 'live-photo'
  videoUrl: string
}

interface MotionPhotoSource {
  offset: number
  presentationTimestamp?: number
  size?: number
  type: 'motion-photo'
}

type ServerVideoSource = LivePhotoSource | MotionPhotoSource
type BrowserVideoSource = Omit<LivePhotoSource, 's3Key'> | MotionPhotoSource

export interface ServerPhotoManifestItem {
  [key: string]: unknown
  id: string
  ogImageUrl?: string | null
  originalUrl: string
  s3Key: string
  thumbnailUrl: string
  video?: ServerVideoSource
}

export interface ServerGalleryManifest {
  [key: string]: unknown
  cameras: Record<string, unknown>[]
  data: ServerPhotoManifestItem[]
  lenses: Record<string, unknown>[]
  version: `v${number}`
}

export type BrowserPhotoManifestItem = Omit<ServerPhotoManifestItem, 's3Key' | 'video'> & {
  video?: BrowserVideoSource
}

export type BrowserGalleryManifest = Omit<ServerGalleryManifest, 'data'> & {
  data: BrowserPhotoManifestItem[]
}

const getMediaUrl = (photoId: string, kind: 'live-video' | 'original') =>
  `/api/media/${encodeURIComponent(photoId)}?kind=${kind}`

const getInternalThumbnailUrl = (url: string, photoId: string) => {
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//')) {
    return url
  }

  try {
    const parsed = new URL(url.startsWith('//') ? `https:${url}` : url)
    return parsed.pathname.startsWith('/thumbnails/')
      ? `${parsed.pathname}${parsed.search}`
      : `/thumbnails/${photoId}.jpg`
  }
  catch {
    return `/thumbnails/${photoId}.jpg`
  }
}

const transformVideo = (photoId: string, video: ServerVideoSource | undefined): BrowserVideoSource | undefined => {
  if (!video) {
    return undefined
  }
  if (video.type === 'motion-photo') {
    return { ...video }
  }

  return {
    type: 'live-photo',
    videoUrl: getMediaUrl(photoId, 'live-video'),
  }
}

const transformPhoto = (photo: ServerPhotoManifestItem): BrowserPhotoManifestItem => {
  const { ogImageUrl: _ogImageUrl, s3Key: _s3Key, video, ...browserPhoto } = photo

  return {
    ...browserPhoto,
    originalUrl: getMediaUrl(photo.id, 'original'),
    thumbnailUrl: getInternalThumbnailUrl(photo.thumbnailUrl, photo.id),
    video: transformVideo(photo.id, video),
  }
}

export const createBrowserGalleryManifest = (manifest: ServerGalleryManifest): BrowserGalleryManifest => {
  const browserManifest = {
    ...manifest,
    cameras: manifest.cameras.map(camera => ({ ...camera })),
    data: manifest.data.map(transformPhoto),
    lenses: manifest.lenses.map(lens => ({ ...lens })),
  }

  const serialized = JSON.stringify(browserManifest)
  if (/assets\.woodbrook\.cn/i.test(serialized)) {
    throw new Error('Public gallery media URL remained in the browser manifest')
  }
  if (serialized.includes('"s3Key"')) {
    throw new Error('An object storage key remained in the browser manifest')
  }

  return browserManifest
}

export const injectManifestToDocument = (document: HtmlDocument, manifest: ServerGalleryManifest) => {
  const manifestElement = document.head.querySelector('#manifest')
  if (!manifestElement) {
    throw new Error('Gallery HTML is missing script#manifest')
  }

  const browserManifest = createBrowserGalleryManifest(manifest)
  manifestElement.textContent = `window.__MANIFEST__ = ${serializeForInlineScript(browserManifest)};`

  return document
}
