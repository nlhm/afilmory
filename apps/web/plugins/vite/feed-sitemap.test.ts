import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { createFeedSitemapPlugin } from './feed-sitemap'

test('private gallery build does not emit feed.xml or sitemap.xml', () => {
  const emitted: string[] = []
  const plugin = createFeedSitemapPlugin({ url: 'https://gallery.test' } as never)

  plugin.generateBundle?.call({
    emitFile(file) {
      emitted.push(file.fileName)
      return 'ignored'
    },
  } as never)

  assert.deepEqual(emitted, [])
})
