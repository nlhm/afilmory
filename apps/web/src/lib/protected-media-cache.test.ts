import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { logoutGalleryAccess } from './gallery-access'
import { cacheProtectedMediaBlob, getProtectedMediaBlob, PROTECTED_MEDIA_CACHE_NAME } from './protected-media-cache'

const ORIGIN = 'https://gallery.test'

const toUrl = (request: RequestInfo | URL) => {
  if (request instanceof Request) {
    return request.url
  }
  return new URL(request.toString(), ORIGIN).toString()
}

class MemoryCache {
  private readonly responses = new Map<string, Response>()

  async delete(request: RequestInfo | URL) {
    return this.responses.delete(toUrl(request))
  }

  async keys() {
    return Array.from(this.responses.keys(), url => new Request(url))
  }

  async match(request: RequestInfo | URL) {
    return this.responses.get(toUrl(request))?.clone()
  }

  async put(request: RequestInfo | URL, response: Response) {
    this.responses.set(toUrl(request), response.clone())
  }
}

test('a cache hit returns without waiting for a metadata write', async () => {
  const cache = new MemoryCache()
  const originalCaches = globalThis.caches
  const originalLocation = globalThis.location
  Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL(ORIGIN) })
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { async open() {
    return cache
  } } })
  let release!: () => void
  let entered!: () => void
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  const writing = new Promise<void>((resolve) => {
    entered = resolve
  })
  const put = cache.put.bind(cache)
  try {
    const src = '/api/media/photo?kind=original&v=1'
    const blob = new Blob(['photo'], { type: 'image/jpeg' })
    await cacheProtectedMediaBlob(src, blob)
    cache.put = async (request, response) => {
      if (toUrl(request).includes('cache-metadata')) {
        entered()
        await blocked
      }
      await put(request, response)
    }
    const hit = getProtectedMediaBlob(src)
    await writing
    const result = await Promise.race([hit, new Promise<null>(resolve => setTimeout(resolve, 100, null))])
    assert.equal(await result?.text(), 'photo')
    release()
    await cacheProtectedMediaBlob(src, blob)
  }
  finally {
    release()
    cache.put = put
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: originalCaches })
    Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation })
  }
})

test('protected media cache survives a later visit and gallery logout', async () => {
  const cache = new MemoryCache()
  const openedCacheNames: string[] = []
  const originalCaches = globalThis.caches
  const originalFetch = globalThis.fetch
  const originalLocation = globalThis.location

  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL(ORIGIN),
  })
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: {
      async open(name: string) {
        openedCacheNames.push(name)
        return cache
      },
    },
  })
  globalThis.fetch = async () => new Response(null, { status: 204 })

  try {
    const src = `${ORIGIN}/api/media/photo-1?kind=original`
    await cacheProtectedMediaBlob(src, new Blob(['persistent-photo'], { type: 'image/jpeg' }))

    assert.equal(await (await getProtectedMediaBlob(src))?.text(), 'persistent-photo')
    await logoutGalleryAccess()
    assert.equal(await (await getProtectedMediaBlob(src))?.text(), 'persistent-photo')
    assert.ok(openedCacheNames.every(name => name === PROTECTED_MEDIA_CACHE_NAME))
  }
  finally {
    await cacheProtectedMediaBlob('/api/media/flush', new Blob())
    globalThis.fetch = originalFetch
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: originalCaches })
    Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation })
  }
})

test('protected media cache keys different original versions separately', async () => {
  const cache = new MemoryCache()
  const originalCaches = globalThis.caches
  const originalLocation = globalThis.location

  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL(ORIGIN),
  })
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: {
      async open() {
        return cache
      },
    },
  })

  try {
    const firstSrc = `${ORIGIN}/api/media/photo-1?kind=original&v=old`
    const nextSrc = `${ORIGIN}/api/media/photo-1?kind=original&v=new`

    await cacheProtectedMediaBlob(firstSrc, new Blob(['old-photo'], { type: 'image/jpeg' }))
    await cacheProtectedMediaBlob(nextSrc, new Blob(['new-photo'], { type: 'image/jpeg' }))

    assert.equal(await (await getProtectedMediaBlob(firstSrc))?.text(), 'old-photo')
    assert.equal(await (await getProtectedMediaBlob(nextSrc))?.text(), 'new-photo')
  }
  finally {
    await cacheProtectedMediaBlob('/api/media/flush', new Blob())
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: originalCaches })
    Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation })
  }
})

test('protected media cache normalizes relative URLs before storing LRU metadata', async () => {
  const cache = new MemoryCache()
  const originalCaches = globalThis.caches
  const originalLocation = globalThis.location

  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL(ORIGIN),
  })
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: {
      async open() {
        return cache
      },
    },
  })

  try {
    const relativeSrc = '/api/media/photo-1?kind=original&v=current'
    const absoluteSrc = `${ORIGIN}${relativeSrc}`
    await cacheProtectedMediaBlob(relativeSrc, new Blob(['photo'], { type: 'image/jpeg' }))
    assert.equal(await (await getProtectedMediaBlob(relativeSrc))?.text(), 'photo')

    const metadataResponse = await cache.match(`${ORIGIN}/__afilmory/protected-media-cache-metadata-v1`)
    const metadata = (await metadataResponse?.json()) as { entries: Record<string, unknown> }
    assert.deepEqual(Object.keys(metadata.entries), [absoluteSrc])
  }
  finally {
    await cacheProtectedMediaBlob('/api/media/flush', new Blob())
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: originalCaches })
    Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation })
  }
})
