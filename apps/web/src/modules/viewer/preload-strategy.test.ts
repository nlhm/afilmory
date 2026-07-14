import assert from 'node:assert/strict'
import test from 'node:test'

import { getPhotoPreloadIndices } from './preload-strategy'

test('preloads one photo on each side before a navigation direction is known', () => {
  assert.deepEqual(
    getPhotoPreloadIndices({
      currentIndex: 3,
      direction: null,
      photoCount: 8,
    }),
    [2, 4],
  )
})

test('preloads two photos ahead and one behind when navigating forward', () => {
  assert.deepEqual(
    getPhotoPreloadIndices({
      currentIndex: 3,
      direction: 'next',
      photoCount: 8,
    }),
    [4, 5, 2],
  )
})

test('preloads two photos ahead and one behind when navigating backward', () => {
  assert.deepEqual(
    getPhotoPreloadIndices({
      currentIndex: 3,
      direction: 'previous',
      photoCount: 8,
    }),
    [2, 1, 4],
  )
})

test('keeps preload indices within the photo collection', () => {
  assert.deepEqual(
    getPhotoPreloadIndices({
      currentIndex: 0,
      direction: 'previous',
      photoCount: 3,
    }),
    [1],
  )
  assert.deepEqual(
    getPhotoPreloadIndices({
      currentIndex: 2,
      direction: 'next',
      photoCount: 3,
    }),
    [1],
  )
})
