import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { DOMParser } from 'linkedom'

import type { ServerGalleryManifest, ServerPhotoManifestItem } from './manifest'
import { createBrowserGalleryManifest, injectManifestToDocument } from './manifest'

const PHOTO_ID = 'private/photo 01'

const photo = {
  id: PHOTO_ID,
  title: '</script><script>globalThis.exposed = true</script>',
  description: 'Private photo',
  dateTaken: '2026-06-29T00:00:00.000Z',
  tags: ['private'],
  originalUrl: 'https://assets.woodbrook.cn/originals/private-photo.jpg',
  thumbnailUrl: 'https://assets.woodbrook.cn/thumbnails/private-photo.jpg',
  ogImageUrl: 'https://assets.woodbrook.cn/og/private-photo.png',
  thumbHash: null,
  width: 1200,
  height: 800,
  aspectRatio: 1.5,
  format: 'JPG',
  s3Key: 'originals/private-photo.jpg',
  lastModified: '2026-06-29T00:00:00.000Z',
  size: 123,
  exif: null,
  toneAnalysis: null,
  location: null,
  video: {
    type: 'live-photo',
    videoUrl: 'https://assets.woodbrook.cn/originals/private-photo.mov',
    s3Key: 'originals/private-photo.mov',
  },
} as ServerPhotoManifestItem

const manifest: ServerGalleryManifest = {
  version: 'v10',
  cameras: [{ make: 'Test', model: 'Camera', displayName: 'Test Camera' }],
  data: [photo],
  lenses: [{ model: 'Lens', displayName: 'Test Lens' }],
}

test('browser manifest uses only internal media routes and omits object keys', () => {
  const browserManifest = createBrowserGalleryManifest(manifest)
  const browserPhoto = browserManifest.data[0]
  const serialized = JSON.stringify(browserManifest)

  assert.equal(browserPhoto.originalUrl, '/api/media/private%2Fphoto%2001?kind=original&v=2026-06-29T00%3A00%3A00.000Z')
  assert.equal(browserPhoto.thumbnailUrl, '/thumbnails/private-photo.jpg?v=2026-06-29T00%3A00%3A00.000Z')
  assert.deepEqual(browserPhoto.video, {
    type: 'live-photo',
    videoUrl: '/api/media/private%2Fphoto%2001?kind=live-video',
  })
  assert.equal('s3Key' in browserPhoto, false)
  assert.equal('ogImageUrl' in browserPhoto, false)
  assert.doesNotMatch(serialized, /assets\.woodbrook\.cn|originals\/private-photo|s3Key/)

  assert.equal(photo.s3Key, 'originals/private-photo.jpg')
  assert.equal(photo.video?.type === 'live-photo' && photo.video.s3Key, 'originals/private-photo.mov')
})

test('browser manifest prefers digest-based thumbnail versions when available', () => {
  const browserManifest = createBrowserGalleryManifest({
    ...manifest,
    data: [{ ...photo, digest: 'thumb-digest-123' }],
  })

  assert.equal(browserManifest.data[0].originalUrl, '/api/media/private%2Fphoto%2001?kind=original&v=thumb-digest-123')
  assert.equal(browserManifest.data[0].thumbnailUrl, '/thumbnails/private-photo.jpg?v=thumb-digest-123')
})

test('manifest injection escapes script-breaking content', () => {
  const document = new DOMParser().parseFromString(
    '<!doctype html><html><head><script id="manifest"></script></head><body></body></html>',
    'text/html',
  )

  injectManifestToDocument(document, manifest)
  const html = document.documentElement.outerHTML

  assert.match(html, /window\.__MANIFEST__/)
  assert.match(html, /\\u003c\/script\\u003e/)
  assert.doesNotMatch(html, /<script>globalThis\.exposed/)
  assert.equal(document.querySelectorAll('script').length, 1)
})

test('manifest injection requires the dedicated placeholder', () => {
  const document = new DOMParser().parseFromString('<html><head></head><body></body></html>', 'text/html')
  assert.throws(() => injectManifestToDocument(document, manifest), /script#manifest/)
})
