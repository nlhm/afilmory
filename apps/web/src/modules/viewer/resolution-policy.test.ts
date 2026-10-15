import assert from 'node:assert/strict'

import { it } from 'vitest'

import { needsOriginalResolution } from './resolution-policy'

const input = {
  viewport: {
    containerWidth: 390,
    containerHeight: 844,
    imageWidth: 2048,
    imageHeight: 1365,
    scale: 390 / 2048,
    relativeScale: 1,
    fitToScreenScale: 390 / 2048,
    translateX: 0,
    translateY: 0,
  },
  previewWidth: 2048,
  previewHeight: 1365,
  originalWidth: 6000,
  originalHeight: 4000,
  devicePixelRatio: 3,
}

it('a modest phone zoom keeps the preview while it has enough physical pixels', () => {
  assert.equal(needsOriginalResolution(input), false)
  assert.equal(
    needsOriginalResolution({ ...input, viewport: { ...input.viewport, scale: input.viewport.scale * 1.5 } }),
    false,
  )
})

it('zooming beyond preview resolution requests the original', () => {
  assert.equal(
    needsOriginalResolution({ ...input, viewport: { ...input.viewport, scale: input.viewport.scale * 2 } }),
    true,
  )
})

it('a large high-density viewport requests detail even at fit', () => {
  assert.equal(
    needsOriginalResolution({ ...input, viewport: { ...input.viewport, scale: 1600 / 2048 }, devicePixelRatio: 2 }),
    true,
  )
})

it('portrait images use both dimensions and avoid requesting an original with no more detail', () => {
  const portrait = {
    ...input,
    viewport: { ...input.viewport, imageWidth: 1365, imageHeight: 2048, scale: 0.5 },
    previewWidth: 1365,
    previewHeight: 2048,
    originalWidth: 4000,
    originalHeight: 6000,
  }
  assert.equal(needsOriginalResolution(portrait), true)
  assert.equal(
    needsOriginalResolution({ ...input, originalWidth: 2048, originalHeight: 1365, devicePixelRatio: 10 }),
    false,
  )
})

it('invalid or incomplete geometry does not start an original request', () => {
  assert.equal(needsOriginalResolution({ ...input, previewWidth: 0 }), false)
  assert.equal(needsOriginalResolution({ ...input, devicePixelRatio: Number.NaN }), false)
})
