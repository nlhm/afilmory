import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { afterViewerInteraction } from './interaction-idle'

let frames: Map<number, FrameRequestCallback>
let nextId: number

beforeEach(() => {
  frames = new Map()
  nextId = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextId, callback)
    return nextId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})
afterEach(() => vi.unstubAllGlobals())

function nextFrame() {
  const callbacks = [...frames.values()]
  frames.clear()
  for (const callback of callbacks) {
    callback(0)
  }
}

it('keeps the preview active until the current zoom animation finishes', () => {
  let interacting = true
  const replaceRenderer = vi.fn()
  afterViewerInteraction(() => interacting, replaceRenderer)
  for (let i = 0; i < 12; i++) {
    nextFrame()
    expect(replaceRenderer).not.toHaveBeenCalled()
  }
  interacting = false
  nextFrame()
  expect(replaceRenderer).toHaveBeenCalledOnce()
  expect(frames.size).toBe(0)
})

it('promotes an already idle viewer immediately without adding an artificial delay', () => {
  const replaceRenderer = vi.fn()
  afterViewerInteraction(() => false, replaceRenderer)
  expect(replaceRenderer).toHaveBeenCalledOnce()
  expect(frames.size).toBe(0)
})

it('cancels stale promotions when another resource replaces them or the viewer unmounts', () => {
  let interacting = true
  const stalePromotion = vi.fn()
  const cancel = afterViewerInteraction(() => interacting, stalePromotion)
  const staleFrame = [...frames.values()][0]
  cancel()
  interacting = false
  staleFrame(0)
  nextFrame()
  expect(stalePromotion).not.toHaveBeenCalled()
  expect(frames.size).toBe(0)
})
