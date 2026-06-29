import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { hasValidGallerySession } from './request'
import { createGallerySessionToken, GALLERY_ACCESS_COOKIE_NAME } from './session'

const SESSION_SECRET = 'test-session-secret-with-at-least-thirty-two-characters'

test('request session validation reads only the signed access cookie', () => {
  const token = createGallerySessionToken(SESSION_SECRET)
  const request = new Request('https://gallery.test/', {
    headers: {
      cookie: `theme=dark; ${GALLERY_ACCESS_COOKIE_NAME}=${token}; another=value=with=equals`,
    },
  })

  assert.equal(hasValidGallerySession(request, SESSION_SECRET), true)
  assert.equal(hasValidGallerySession(request, `${SESSION_SECRET}-wrong`), false)
})
