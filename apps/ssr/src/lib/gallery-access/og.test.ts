import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { getGalleryThumbnailUrl } from './manifest'
import { handleGalleryOgRequest } from './og'
import { createGallerySessionToken, GALLERY_ACCESS_COOKIE_NAME } from './session'

const secret = 'test-session-secret-with-at-least-thirty-two-characters'
process.env.GALLERY_PASSWORD_HASH ??= 'scrypt$16384$8$1$bbbbbbbbbbbbbbbbbbbbbb$ccccccccccccccccccccccccccccccccccccccccccc'
process.env.GALLERY_SESSION_SECRET ??= secret

const request = (authenticated = true) => new Request('https://gallery.test/og/photo', {
  headers: authenticated ? { cookie: `${GALLERY_ACCESS_COOKIE_NAME}=${createGallerySessionToken(secret)}` } : {},
})
const unavailable: typeof fetch = async () => {
  throw new Error('Backend unavailable')
}
const dependencies = {
  backendUrl: 'http://localhost:3000/og/photo',
  forwardHeaders: new Headers(),
  fetch: unavailable,
  resolveThumbnail: () => getGalleryThumbnailUrl({
    id: 'photo',
    thumbnailUrl: 'https://public-storage.test/thumbnails/photo.jpg',
    thumbnailDigest: 'digest',
  }),
}

test('unauthorized OG requests do not fetch the backend or look up private thumbnails', async () => {
  const unexpected = () => {
    throw new Error('Must not be called')
  }
  const response = await handleGalleryOgRequest(request(false), 'photo', {
    ...dependencies,
    fetch: unexpected,
    resolveThumbnail: unexpected,
  })
  assert.equal(response.status, 401)
  assert.equal(response.headers.get('location'), null)
})

test('unreachable or failing OG backends fall back to the protected versioned thumbnail', async () => {
  for (const fetcher of [unavailable, async () => new Response('failed', { status: 503 })]) {
    const response = await handleGalleryOgRequest(request(), 'photo', { ...dependencies, fetch: fetcher })
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('location'), 'https://gallery.test/thumbnails/photo.jpg?v=digest')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.match(response.headers.get('x-robots-tag') || '', /noindex/)
  }
})

test('fallback rejects missing photos and redirects outside protected thumbnails', async () => {
  for (const thumbnail of [undefined, 'https://public-storage.test/photo.jpg', '/api/media/photo', '//other.test/thumbnails/photo.jpg']) {
    const response = await handleGalleryOgRequest(request(), 'photo', {
      ...dependencies,
      resolveThumbnail: () => thumbnail,
    })
    assert.equal(response.status, 404)
    assert.equal(response.headers.get('location'), null)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
})

test('OG backend success and authorization errors retain their status without fallback', async () => {
  for (const status of [200, 401, 404]) {
    const response = await handleGalleryOgRequest(request(), 'photo', {
      ...dependencies,
      fetch: async (_url, init) => {
        assert.ok(init?.signal)
        return new Response('upstream', { status, headers: { 'Content-Type': 'image/png' } })
      },
      resolveThumbnail: () => { throw new Error('Must not fall back') },
    })
    assert.equal(response.status, status)
    assert.equal(await response.text(), 'upstream')
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
})
