import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { hashGalleryPassword, verifyGalleryPassword } from './password'

test('gallery password hashes are salted and verifiable', async () => {
  const password = 'correct horse battery staple'
  const firstHash = await hashGalleryPassword(password)
  const secondHash = await hashGalleryPassword(password)

  assert.match(firstHash, /^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/)
  assert.notEqual(firstHash, secondHash)
  assert.equal(firstHash.includes(password), false)
  assert.equal(await verifyGalleryPassword(password, firstHash), true)
  assert.equal(await verifyGalleryPassword('incorrect', firstHash), false)
})

test('gallery password verification rejects malformed hashes', async () => {
  assert.equal(await verifyGalleryPassword('password', 'not-a-hash'), false)
  assert.equal(await verifyGalleryPassword('password', 'scrypt$999999$8$1$salt$key'), false)
})
