const LEGACY_PHOTO_CACHE_NAMES = ['images-cache']

const isLegacyPhotoCacheName = (cacheName: string) =>
  LEGACY_PHOTO_CACHE_NAMES.some(name => cacheName === name || cacheName.startsWith(`${name}-`))

export async function purgeLegacyPhotoCaches(cacheStorage: Pick<CacheStorage, 'delete' | 'keys'> = caches) {
  const cacheNames = await cacheStorage.keys()
  const deleted = await Promise.all(
    cacheNames
      .filter(isLegacyPhotoCacheName)
      .map(async cacheName => await cacheStorage.delete(cacheName)),
  )

  return deleted.some(Boolean)
}

export async function logoutGalleryAccess() {
  await fetch('/api/gallery-access/logout', {
    method: 'POST',
  })
  await purgeLegacyPhotoCaches()
}
