import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import type { ServerGalleryManifest, ServerPhotoManifestItem } from './manifest'
import { buildStorageObjectKey, resolveGalleryMediaTargetFromManifest } from './media-core'

const photo = {
  id: 'private/photo 01',
  title: 'Private photo',
  description: 'Private photo',
  dateTaken: '2026-06-29T00:00:00.000Z',
  tags: ['private'],
  originalUrl: 'https://assets.woodbrook.cn/originals/private-photo.jpg',
  thumbnailUrl: 'https://assets.woodbrook.cn/thumbnails/private-photo.jpg',
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
  cameras: [],
  data: [photo],
  lenses: [],
}

test('media lookup resolves only manifest-backed originals and live-photo videos', () => {
  const original = resolveGalleryMediaTargetFromManifest(manifest, 'private/photo 01', 'original')
  const liveVideo = resolveGalleryMediaTargetFromManifest(manifest, 'private/photo 01', 'live-video')

  assert.equal(original?.objectKey, 'originals/private-photo.jpg')
  assert.equal(liveVideo?.objectKey, 'originals/private-photo.mov')
  assert.equal(resolveGalleryMediaTargetFromManifest(manifest, 'private/photo 01', 'live-video')?.contentType, 'video')
})

test('media lookup rejects unknown IDs and unsupported live-video targets', () => {
  assert.equal(resolveGalleryMediaTargetFromManifest(manifest, '../originals/private-photo.jpg', 'original'), null)
  assert.equal(resolveGalleryMediaTargetFromManifest(manifest, 'https://assets.woodbrook.cn/originals/private-photo.jpg', 'original'), null)
  assert.equal(resolveGalleryMediaTargetFromManifest(manifest, 'missing-photo-id', 'original'), null)
})

test('storage key builder applies an optional prefix without exposing path traversal semantics', () => {
  assert.equal(buildStorageObjectKey(undefined, 'originals/private-photo.jpg'), 'originals/private-photo.jpg')
  assert.equal(buildStorageObjectKey('gallery', 'originals/private-photo.jpg'), 'gallery/originals/private-photo.jpg')
  assert.equal(buildStorageObjectKey('/gallery/', '/originals/private-photo.jpg'), 'gallery/originals/private-photo.jpg')
})
