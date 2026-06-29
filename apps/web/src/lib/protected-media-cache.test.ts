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
    globalThis.fetch = originalFetch
    Object.defineProperty(globalThis, 'caches', { configurable: true, value: originalCaches })
    Object.defineProperty(globalThis, 'location', { configurable: true, value: originalLocation })
  }
})
