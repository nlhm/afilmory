import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { DOMParser } from 'linkedom'

import {
  injectPrivateGalleryRobotsMeta,
  PRIVATE_GALLERY_ROBOTS_CONTENT,
  PRIVATE_GALLERY_ROBOTS_TXT,
} from './privacy'

test('private gallery robots metadata is forced to noindex, nofollow, noarchive', () => {
  const document = new DOMParser().parseFromString('<html><head><meta name="robots" content="index, follow"></head><body></body></html>', 'text/html')

  injectPrivateGalleryRobotsMeta(document)

  assert.equal(document.head.querySelector('meta[name="robots"]')?.getAttribute('content'), PRIVATE_GALLERY_ROBOTS_CONTENT)
  assert.equal(document.head.querySelector('meta[name="googlebot"]')?.getAttribute('content'), PRIVATE_GALLERY_ROBOTS_CONTENT)
})

test('private gallery robots.txt disallows all crawlers', () => {
  assert.equal(PRIVATE_GALLERY_ROBOTS_TXT, 'User-agent: *\nDisallow: /\n')
})
