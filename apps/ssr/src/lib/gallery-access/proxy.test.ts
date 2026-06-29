import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { NextRequest } from 'next/server'

import { handleGalleryAccessProxy, isPublicGalleryPath } from '../../proxy'
import { createGallerySessionToken, GALLERY_ACCESS_COOKIE_NAME } from './session'

const SESSION_SECRET = 'test-session-secret-with-at-least-thirty-two-characters'

const createRequest = (path: string, options: { accept?: string, cookie?: string, method?: string } = {}) =>
  new NextRequest(`https://gallery.test${path}`, {
    headers: {
      ...(options.accept ? { accept: options.accept } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    method: options.method,
  })

test('proxy public allowlist contains access dependencies but not protected media', () => {
  assert.equal(isPublicGalleryPath('/access'), true)
  assert.equal(isPublicGalleryPath('/api/gallery-access/unlock'), true)
  assert.equal(isPublicGalleryPath('/robots.txt'), true)
  assert.equal(isPublicGalleryPath('/_next/static/chunks/app.js'), true)
  assert.equal(isPublicGalleryPath('/assets/app.js'), true)
  assert.equal(isPublicGalleryPath('/thumbnails/private.jpg'), false)
  assert.equal(isPublicGalleryPath('/photos/private.jpg'), false)
  assert.equal(isPublicGalleryPath('/_next/image'), false)
  assert.equal(isPublicGalleryPath('/api/media/private'), false)
})

test('proxy redirects unauthorized HTML and preserves the relative destination', () => {
  const response = handleGalleryAccessProxy(
    createRequest('/photos/private?id=1', { accept: 'text/html,application/xhtml+xml' }),
    SESSION_SECRET,
  )

  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), 'https://gallery.test/access?next=%2Fphotos%2Fprivate%3Fid%3D1')
})

test('proxy returns 401 for unauthorized thumbnails and APIs', async () => {
  for (const path of ['/thumbnails/private.jpg', '/api/media/private?kind=original', '/feed.xml']) {
    const response = handleGalleryAccessProxy(createRequest(path, { accept: 'image/avif,*/*' }), SESSION_SECRET)
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('location'), null)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(await response.text(), 'Unauthorized')
  }
})

test('proxy permits a request with a valid signed session', () => {
  const token = createGallerySessionToken(SESSION_SECRET)
  const response = handleGalleryAccessProxy(
    createRequest('/photos/private', {
      accept: 'text/html',
      cookie: `${GALLERY_ACCESS_COOKIE_NAME}=${token}`,
    }),
    SESSION_SECRET,
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-middleware-next'), '1')
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
})
