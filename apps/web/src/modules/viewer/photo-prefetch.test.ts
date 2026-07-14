import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import type { PrefetchTaskHandle } from './photo-prefetch'
import { getPhotoPrefetchIndices, PhotoPrefetchQueue, resolvePhotoNavigationDirection } from './photo-prefetch'

test('resolvePhotoNavigationDirection only treats adjacent navigation as directional browsing', () => {
  assert.equal(resolvePhotoNavigationDirection(null, 3), 'unknown')
  assert.equal(resolvePhotoNavigationDirection(3, 4), 'forward')
  assert.equal(resolvePhotoNavigationDirection(3, 2), 'backward')
  assert.equal(resolvePhotoNavigationDirection(3, 8), 'unknown')
})

test('getPhotoPrefetchIndices uses a balanced initial window and a directional browsing window', () => {
  assert.deepEqual(getPhotoPrefetchIndices(3, 10, 'unknown'), [2, 4])
  assert.deepEqual(getPhotoPrefetchIndices(3, 10, 'forward'), [4, 5, 2])
  assert.deepEqual(getPhotoPrefetchIndices(3, 10, 'backward'), [2, 1, 4])
  assert.deepEqual(getPhotoPrefetchIndices(0, 2, 'forward'), [1])
  assert.deepEqual(getPhotoPrefetchIndices(1, 2, 'backward'), [0])
})

test('PhotoPrefetchQueue limits concurrency and cancels work outside the new window', async () => {
  const started: string[] = []
  const cancelled: string[] = []
  const resolvers = new Map<string, () => void>()

  const queue = new PhotoPrefetchQueue((url): PrefetchTaskHandle => {
    started.push(url)
    return {
      cancel: () => cancelled.push(url),
      promise: new Promise<void>(resolve => resolvers.set(url, resolve)),
    }
  }, 2)

  queue.setTargets(['one', 'two', 'three'])
  assert.deepEqual(started, ['one', 'two'])

  queue.setTargets(['two', 'four'])
  assert.deepEqual(cancelled, ['one'])
  assert.deepEqual(started, ['one', 'two', 'four'])

  resolvers.get('two')?.()
  resolvers.get('four')?.()
  await Promise.resolve()
  await Promise.resolve()

  queue.stop()
})

test('PhotoPrefetchQueue retains an active task when it becomes the foreground image', () => {
  const cancelled: string[] = []
  const queue = new PhotoPrefetchQueue(
    url => ({
      cancel: () => cancelled.push(url),
      promise: new Promise(() => {}),
    }),
    2,
  )

  queue.setTargets(['next'])
  queue.setTargets([], ['next'])

  assert.deepEqual(cancelled, [])
  queue.stop()
  assert.deepEqual(cancelled, ['next'])
})
