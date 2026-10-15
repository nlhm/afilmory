import assert from 'node:assert/strict'

import { afterEach, it, vi } from 'vitest'

import { ViewerDiagnosticsStore } from './viewer-diagnostics'

it('normal browsing does not retain diagnostics or notify listeners', () => {
  const store = new ViewerDiagnosticsStore(false)
  store.subscribe(() => assert.fail('disabled diagnostics notified a listener'))
  store.record('/api/media/photo?signature=secret', { stage: 'download', durationMs: 10 })
  assert.deepEqual(store.getSnapshot(), [])
})

it('diagnostics strip credentials, hosts, queries and blob URLs', () => {
  const store = new ViewerDiagnosticsStore(true)
  store.record('https://user:password@storage.example/photo.jpg?X-Amz-Signature=secret#token', { stage: 'download' })
  store.record('blob:https://gallery.test/private-id', { stage: 'renderer-ready' })
  assert.equal(store.getSnapshot()[0].resource, '/photo.jpg')
  assert.equal(store.getSnapshot()[1].resource, 'viewer')
  assert.doesNotMatch(JSON.stringify(store.getSnapshot()), /secret|password|storage\.example|private-id/)
})

it('diagnostics retain a bounded immutable history and subscriptions can be released', () => {
  const store = new ViewerDiagnosticsStore(true, 2)
  let notifications = 0
  const unsubscribe = store.subscribe(() => {
    notifications++
  })
  store.record('/one', { stage: 'load' })
  const firstSnapshot = store.getSnapshot()
  unsubscribe()
  store.record('/two', { stage: 'load' })
  store.record('/three', { stage: 'load' })
  assert.equal(notifications, 1)
  assert.equal(firstSnapshot.length, 1)
  assert.deepEqual(
    store.getSnapshot().map(event => event.resource),
    ['/two', '/three'],
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('frame monitoring reports visible gaps, resets across hidden tabs and releases its listeners', async () => {
  vi.resetModules()
  const doc = { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  let nextFrame: FrameRequestCallback = () => {}
  const cancelFrame = vi.fn()
  vi.stubGlobal('window', { location: { search: '?viewerDiagnostics=1' } })
  vi.stubGlobal('document', doc)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame = callback
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', cancelFrame)
  vi.stubGlobal('PerformanceObserver', undefined)
  const { monitorViewerFrames, viewerDiagnostics } = await import('./viewer-diagnostics')
  const stop = monitorViewerFrames('/api/media/photo?token=secret')
  nextFrame(100)
  nextFrame(150)
  assert.equal(viewerDiagnostics.getSnapshot()[0].durationMs, 50)
  const resetClock = doc.addEventListener.mock.calls[0][1]
  doc.hidden = true
  resetClock()
  doc.hidden = false
  resetClock()
  nextFrame(5000)
  assert.equal(viewerDiagnostics.getSnapshot().length, 1)
  stop()
  assert.equal(cancelFrame.mock.calls.length, 1)
  assert.deepEqual(doc.removeEventListener.mock.calls[0], ['visibilitychange', resetClock])
})
