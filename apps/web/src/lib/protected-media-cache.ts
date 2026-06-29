const CACHE_NAME = 'protected-media-cache-v1'
const CACHE_TIMESTAMP_HEADER = 'x-afilmory-cached-at'
const CACHE_SIZE_HEADER = 'x-afilmory-content-length'
const CACHE_METADATA_PATH = '/__afilmory/protected-media-cache-metadata-v1'

const MAX_CACHE_BYTES = 256 * 1024 * 1024

let cacheWriteQueue = Promise.resolve()

interface CacheMetadata {
  entries: Record<
    string,
    {
      lastAccessedAt: number
      size: number
    }
  >
  version: 1
}

const canUseCacheStorage = () => typeof globalThis.caches !== 'undefined' && typeof globalThis.location !== 'undefined'

const isProtectedMediaUrl = (src: string) => {
  if (!canUseCacheStorage()) {
    return false
  }

  try {
    const url = new URL(src, globalThis.location.origin)
    return url.origin === globalThis.location.origin && url.pathname.startsWith('/api/media/')
  }
  catch {
    return false
  }
}

const readCachedAt = (response: Response) => Number(response.headers.get(CACHE_TIMESTAMP_HEADER)) || 0

const readCachedSize = (response: Response) => Number(response.headers.get(CACHE_SIZE_HEADER)) || 0

const queueCacheMutation = (mutation: () => Promise<void>) => {
  cacheWriteQueue = cacheWriteQueue.then(mutation, mutation)
  return cacheWriteQueue
}

const createEmptyMetadata = (): CacheMetadata => ({ entries: {}, version: 1 })

const getMetadataUrl = () => new URL(CACHE_METADATA_PATH, globalThis.location.origin).toString()

async function readMetadata(cache: Cache): Promise<CacheMetadata> {
  const response = await cache.match(getMetadataUrl())
  if (!response) {
    return createEmptyMetadata()
  }

  try {
    const metadata = (await response.json()) as CacheMetadata
    return metadata.version === 1 && metadata.entries ? metadata : createEmptyMetadata()
  }
  catch {
    return createEmptyMetadata()
  }
}

async function writeMetadata(cache: Cache, metadata: CacheMetadata) {
  await cache.put(
    getMetadataUrl(),
    new Response(JSON.stringify(metadata), {
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

async function pruneCache(cache: Cache, incomingKey: string, incomingBytes: number) {
  const metadata = await readMetadata(cache)
  const entries = await Promise.all(
    (await cache.keys())
      .filter(request => request.url !== getMetadataUrl() && request.url !== incomingKey)
      .map(async request => ({
        request,
        response: await cache.match(request),
      })),
  )

  const retained = entries
    .filter((entry): entry is { request: Request, response: Response } => Boolean(entry.response))
    .map(entry => ({
      ...entry,
      lastAccessedAt: metadata.entries[entry.request.url]?.lastAccessedAt || readCachedAt(entry.response),
      size: metadata.entries[entry.request.url]?.size || readCachedSize(entry.response),
    }))
    .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

  const retainedUrls = new Set(retained.map(entry => entry.request.url))
  for (const url of Object.keys(metadata.entries)) {
    if (url !== incomingKey && !retainedUrls.has(url)) {
      delete metadata.entries[url]
    }
  }

  let retainedBytes = retained.reduce((total, entry) => total + entry.size, 0)

  while (retainedBytes + incomingBytes > MAX_CACHE_BYTES && retained.length > 0) {
    const entry = retained.shift()!

    if (await cache.delete(entry.request)) {
      retainedBytes -= entry.size
      delete metadata.entries[entry.request.url]
    }
  }

  delete metadata.entries[incomingKey]
  await writeMetadata(cache, metadata)
}

export async function getProtectedMediaBlob(src: string): Promise<Blob | null> {
  if (!isProtectedMediaUrl(src)) {
    return null
  }

  try {
    const cache = await caches.open(CACHE_NAME)
    const response = await cache.match(src)
    if (!response) {
      return null
    }

    const blob = await response.blob()
    await queueCacheMutation(async () => {
      const metadata = await readMetadata(cache)
      metadata.entries[src] = {
        lastAccessedAt: Date.now(),
        size: readCachedSize(response) || blob.size,
      }
      await writeMetadata(cache, metadata)
    })

    return blob
  }
  catch (error) {
    console.warn('Failed to read protected media cache:', error)
    return null
  }
}

export function cacheProtectedMediaBlob(src: string, blob: Blob): Promise<void> {
  if (!isProtectedMediaUrl(src) || blob.size > MAX_CACHE_BYTES) {
    return Promise.resolve()
  }

  return queueCacheMutation(async () => {
    try {
      const cache = await caches.open(CACHE_NAME)
      await pruneCache(cache, src, blob.size)
      await cache.put(
        src,
        new Response(blob, {
          headers: {
            'Content-Type': blob.type || 'application/octet-stream',
            [CACHE_SIZE_HEADER]: String(blob.size),
            [CACHE_TIMESTAMP_HEADER]: String(Date.now()),
          },
        }),
      )
      const metadata = await readMetadata(cache)
      metadata.entries[src] = {
        lastAccessedAt: Date.now(),
        size: blob.size,
      }
      await writeMetadata(cache, metadata)
    }
    catch (error) {
      console.warn('Failed to write protected media cache:', error)
    }
  })
}

export { CACHE_NAME as PROTECTED_MEDIA_CACHE_NAME }
