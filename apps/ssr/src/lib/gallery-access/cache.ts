const THUMBNAIL_CACHE_CONTROL = 'private, max-age=31536000, immutable'
const DEFAULT_PRIVATE_CACHE_CONTROL = 'private, no-store'

export const getGalleryCacheControl = (pathname: string) => {
  if (pathname.startsWith('/thumbnails/')) {
    return THUMBNAIL_CACHE_CONTROL
  }

  return DEFAULT_PRIVATE_CACHE_CONTROL
}

export { DEFAULT_PRIVATE_CACHE_CONTROL, THUMBNAIL_CACHE_CONTROL }
