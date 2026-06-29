import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { getSafeGalleryRedirect } from './redirect'

test('gallery redirects allow only normalized same-origin paths', () => {
  assert.equal(getSafeGalleryRedirect('/photos/example?from=access'), '/photos/example?from=access')
  assert.equal(getSafeGalleryRedirect('https://example.com/photos/example'), '/')
  assert.equal(getSafeGalleryRedirect('//example.com/photos/example'), '/')
  assert.equal(getSafeGalleryRedirect('/\\example.com/photos/example'), '/')
  assert.equal(getSafeGalleryRedirect(null), '/')
})
