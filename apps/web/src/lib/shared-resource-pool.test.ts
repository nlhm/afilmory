import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'

import { SharedResourcePool } from './shared-resource-pool'

test('cancelling a preload keeps a joined foreground request alive and broadcasts progress', async () => {
  const pool = new SharedResourcePool<string, number>()
  let finish!: (value: string) => void
  let signal!: AbortSignal
  let publish!: (value: number) => void
  let starts = 0
  const start = (nextSignal: AbortSignal, nextPublish: (value: number) => void) => {
    starts++
    signal = nextSignal
    publish = nextPublish
    return new Promise<string>((resolve) => {
      finish = resolve
    })
  }
  const preload = pool.subscribe('photo', start)
  const cancelled = assert.rejects(preload.promise, { name: 'AbortError' })
  const updates: number[] = []
  const viewer = pool.subscribe('photo', start, value => updates.push(value))
  await Promise.resolve()
  preload.cancel()
  await cancelled
  assert.equal(signal.aborted, false)
  publish(80)
  finish('image')
  assert.equal(await viewer.promise, 'image')
  assert.equal(starts, 1)
  assert.deepEqual(updates, [80])
})

test('the last consumer cancels the task and a later request starts fresh', async () => {
  const pool = new SharedResourcePool<string, number>()
  let signal!: AbortSignal
  const first = pool.subscribe('photo', (nextSignal) => {
    signal = nextSignal
    return new Promise<string>(() => {})
  })
  const cancelled = assert.rejects(first.promise, { name: 'AbortError' })
  await Promise.resolve()
  first.cancel()
  await cancelled
  assert.equal(signal.aborted, true)
  const next = pool.subscribe('photo', async () => 'fresh')
  assert.equal(await next.promise, 'fresh')
})

test('a joining consumer receives the latest state and shared failures permit retry', async () => {
  const pool = new SharedResourcePool<string, number>()
  let fail!: (error: Error) => void
  const first = pool.subscribe('photo', (_signal, publish) => {
    publish(20)
    return new Promise<string>((_resolve, reject) => {
      fail = reject
    })
  })
  await Promise.resolve()
  const updates: number[] = []
  const second = pool.subscribe('photo', async () => 'unused', value => updates.push(value))
  const failed = Promise.all([
    assert.rejects(first.promise, /network/),
    assert.rejects(second.promise, /network/),
  ])
  fail(new Error('network'))
  await failed
  assert.deepEqual(updates, [20])
  assert.equal(await pool.subscribe('photo', async () => 'retry').promise, 'retry')
})
