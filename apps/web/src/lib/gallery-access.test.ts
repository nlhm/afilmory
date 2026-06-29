import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { purgeLegacyPhotoCaches } from './gallery-access'

test('purgeLegacyPhotoCaches deletes only legacy protected image caches', async () => {
  const deleted: string[] = []
  const changed = await purgeLegacyPhotoCaches({
    async delete(name: string) {
      deleted.push(name)
      return true
    },
    async keys() {
      return ['google-fonts-cache', 'images-cache', 'images-cache-v2', 'workbox-precache']
    },
  })

  assert.equal(changed, true)
  assert.deepEqual(deleted, ['images-cache', 'images-cache-v2'])
})
