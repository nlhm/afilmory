import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import sharp from 'sharp'

import { encodePhotoPreview } from './preview.js'

test('previews bound the longest edge for portrait and landscape photographs', async () => {
  for (const [width, height] of [[3000, 1500], [1500, 3000]]) {
    const source = await sharp({ create: { width, height, channels: 3, background: 'red' } }).png().toBuffer()
    const { data, info } = await encodePhotoPreview(source)
    assert.equal(Math.max(info.width, info.height), 2048)
    assert.equal(Math.min(info.width, info.height), 1024)
    assert.equal((await sharp(data).metadata()).format, 'jpeg')
  }
})

test('previews preserve EXIF orientation and do not enlarge small photos', async () => {
  const source = await sharp({ create: { width: 600, height: 400, channels: 3, background: 'blue' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer()
  const { info } = await encodePhotoPreview(source)
  assert.equal(info.width, 400)
  assert.equal(info.height, 600)
})
