import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { handleLogout } from '../../app/api/gallery-access/logout/route'
import { handleUnlock } from '../../app/api/gallery-access/unlock/route'
import { hashGalleryPassword } from './password'
import { GALLERY_ACCESS_COOKIE_NAME, verifyGallerySessionToken } from './session'

const PASSWORD = 'gallery test password'
const SESSION_SECRET = 'test-session-secret-with-at-least-thirty-two-characters'

const createUnlockRequest = (password: string, next?: string) => {
  const body = new URLSearchParams({ password })
  if (next) {
    body.set('next', next)
  }

  return new Request('https://gallery.test/api/gallery-access/unlock', {
    body,
    method: 'POST',
  })
}

test('unlock rejects an incorrect password without setting a cookie', async () => {
  const passwordHash = await hashGalleryPassword(PASSWORD)
  const response = await handleUnlock(createUnlockRequest('wrong password'), {
    passwordHash,
    secureCookie: true,
    sessionSecret: SESSION_SECRET,
  })

  assert.equal(response.status, 401)
  assert.equal(response.headers.get('set-cookie'), null)
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('unlock sets a secure session and redirects to a validated relative path', async () => {
  const passwordHash = await hashGalleryPassword(PASSWORD)
  const before = Date.now()
  const response = await handleUnlock(createUnlockRequest(PASSWORD, '/photos/example'), {
    passwordHash,
    secureCookie: true,
    sessionSecret: SESSION_SECRET,
  })
  const after = Date.now()
  const cookie = response.headers.get('set-cookie') || ''
  const token = cookie.slice(`${GALLERY_ACCESS_COOKIE_NAME}=`.length).split(';')[0]

  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), '/photos/example')
  assert.equal(verifyGallerySessionToken(token, SESSION_SECRET, before), true)
  assert.equal(verifyGallerySessionToken(token, SESSION_SECRET, after), true)
  assert.match(cookie, /Max-Age=2592000/)
  assert.match(cookie, /Path=\//)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Lax/)
})

test('unlock cannot redirect to an external URL', async () => {
  const passwordHash = await hashGalleryPassword(PASSWORD)
  const response = await handleUnlock(createUnlockRequest(PASSWORD, 'https://example.com'), {
    passwordHash,
    secureCookie: true,
    sessionSecret: SESSION_SECRET,
  })

  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), '/')
})

test('logout clears the access cookie and returns to the access page', () => {
  const response = handleLogout(true)
  const cookie = response.headers.get('set-cookie') || ''

  assert.equal(response.status, 303)
  assert.equal(response.headers.get('location'), '/access')
  assert.match(cookie, new RegExp(`^${GALLERY_ACCESS_COOKIE_NAME}=;`))
  assert.match(cookie, /Max-Age=0/)
})
