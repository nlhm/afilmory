const MIME_TYPE_BY_FORMAT: Record<string, string> = {
  AVIF: 'image/avif',
  GIF: 'image/gif',
  HEIC: 'image/heic',
  HEIF: 'image/heif',
  JPEG: 'image/jpeg',
  JPG: 'image/jpeg',
  PNG: 'image/png',
  TIF: 'image/tiff',
  TIFF: 'image/tiff',
  WEBP: 'image/webp',
}

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/tiff': 'tiff',
  'image/webp': 'webp',
}

interface CreateImageShareFileOptions {
  fallbackName: string
  format: string
  sourceKey?: string
  signal?: AbortSignal
}

export function isIOSDevice() {
  if (typeof navigator === 'undefined') {
    return false
  }

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function canShareImageFile(file: File) {
  return (
    typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] })
  )
}

export function isShareCancelled(error: unknown) {
  return error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')
}

export async function createImageShareFile(url: string, options: CreateImageShareFileOptions) {
  const response = await fetch(url, { signal: options.signal })
  if (!response.ok) {
    throw new Error('Unable to load image for sharing')
  }

  const blob = await response.blob()
  const mimeType = resolveImageMimeType(blob.type, options.format)
  if (!mimeType) {
    throw new Error('Unsupported image type')
  }

  const fileName = resolveImageFileName(options.sourceKey, options.fallbackName, mimeType)
  return new File([blob], fileName, { type: mimeType })
}

function resolveImageMimeType(blobType: string, format: string) {
  const normalizedBlobType = blobType.split(';')[0]?.trim().toLowerCase()
  if (normalizedBlobType?.startsWith('image/')) {
    return normalizedBlobType
  }

  return MIME_TYPE_BY_FORMAT[format.toUpperCase()]
}

function resolveImageFileName(sourceKey: string | undefined, fallbackName: string, mimeType: string) {
  const sourceName = sourceKey?.split(/[\\/]/).pop()
  const baseName = (sourceName?.replace(/\.[^.]+$/, '') || fallbackName).replace(/[<>:"/\\|?*]/g, '-')
  const extension = EXTENSION_BY_MIME_TYPE[mimeType] || mimeType.slice('image/'.length)

  return `${baseName}.${extension}`
}
