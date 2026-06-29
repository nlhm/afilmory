import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import {
  clearGallerySessionCookie,
  createGallerySessionCookie,
  createGallerySessionToken,
  GALLERY_ACCESS_COOKIE_NAME,
  GALLERY_SESSION_DURATION_SECONDS,
  verifyGallerySessionToken,
} from './session'

const SECRET = 'test-session-secret-with-at-least-thirty-two-characters'
const NOW = Date.UTC(2026, 5, 29, 12, 0, 0)

test('gallery session tokens validate their signature and expiry', () => {
  const token = createGallerySessionToken(SECRET, { now: NOW })

  assert.equal(verifyGallerySessionToken(token, SECRET, NOW), true)
  assert.equal(verifyGallerySessionToken(token, 'a different secret', NOW), false)

  const parts = token.split('.')
  parts[3] = `${parts[3][0] === 'a' ? 'b' : 'a'}${parts[3].slice(1)}`
  assert.equal(verifyGallerySessionToken(parts.join('.'), SECRET, NOW), false)
  assert.equal(verifyGallerySessionToken(token, SECRET, NOW + GALLERY_SESSION_DURATION_SECONDS * 1000), false)
})

test('gallery cookies follow the access-cookie contract', () => {
  const cookie = createGallerySessionCookie(SECRET, { now: NOW, secure: true })
  const token = cookie.slice(`${GALLERY_ACCESS_COOKIE_NAME}=`.length).split(';')[0]

  assert.equal(verifyGallerySessionToken(token, SECRET, NOW), true)
  assert.match(cookie, new RegExp(`Max-Age=${GALLERY_SESSION_DURATION_SECONDS}`))
  assert.match(cookie, /Expires=Wed, 29 Jul 2026 12:00:00 GMT/)
  assert.match(cookie, /Path=\//)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Lax/)
  assert.doesNotMatch(cookie, /Domain=/)
})

test('logout cookie expires the gallery session with the matching path', () => {
  const cookie = clearGallerySessionCookie(true)

  assert.match(cookie, new RegExp(`^${GALLERY_ACCESS_COOKIE_NAME}=;`))
  assert.match(cookie, /Max-Age=0/)
  assert.match(cookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/)
  assert.match(cookie, /Path=\//)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Lax/)
})
