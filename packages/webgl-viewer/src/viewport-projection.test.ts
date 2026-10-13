import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { projectImageViewport } from './viewport-projection'

test('switching a preview to its original preserves zoom and the visible position', () => {
  const previous = {
    containerWidth: 1000,
    containerHeight: 800,
    imageWidth: 2000,
    imageHeight: 1500,
    relativeScale: 3,
    translateX: -250,
    translateY: 120,
  }
  const next = { containerWidth: 1000, containerHeight: 800, imageWidth: 6000, imageHeight: 4500 }
  const projected = projectImageViewport(previous, next)
  assert.equal(projected.scale * next.imageWidth, previous.relativeScale * 1000)
  assert.equal(projected.translateX, -250)
  assert.equal(projected.translateY, 120)
})
