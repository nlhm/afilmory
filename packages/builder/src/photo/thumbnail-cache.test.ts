import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import type { PhotoManifestItem } from '@afilmory/typing'

import { shouldProcessPhoto } from './cache-manager.js'
import type { PhotoProcessorOptions } from './processor.js'
import { canReuseThumbnail } from './thumbnail-cache.js'

const existingItem = { thumbHash: 'cached-thumbhash' } as PhotoManifestItem
const defaultOptions: PhotoProcessorOptions = {
  isForceManifest: false,
  isForceMode: false,
  isForceThumbnails: false,
}

test('thumbnail cache is reusable only when the source and thumbnail settings are unchanged', () => {
  assert.equal(canReuseThumbnail(existingItem, defaultOptions, false), true)
  assert.equal(canReuseThumbnail(existingItem, defaultOptions, true), false)
  assert.equal(canReuseThumbnail(existingItem, { ...defaultOptions, isForceThumbnails: true }, false), false)
  assert.equal(canReuseThumbnail(existingItem, { ...defaultOptions, isForceMode: true }, false), false)
  assert.equal(canReuseThumbnail({ ...existingItem, thumbHash: null }, defaultOptions, false), false)
})

test('photo processing rebuilds incomplete digest metadata', async () => {
  const result = await shouldProcessPhoto(
    'photo-1',
    { ...existingItem, digest: '', thumbnailDigest: '' },
    { LastModified: new Date('2026-06-30T00:00:00.000Z') },
    defaultOptions,
  )

  assert.deepEqual(result, { shouldProcess: true, reason: '缓存摘要缺失' })
})
