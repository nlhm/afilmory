import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useViewerMobileInteractions } from '../../../../../packages/viewer-motion/src/useViewerMobileInteractions'

interface GestureInput {
  active: boolean
  axis: 'y'
  event: { target: null, touches: unknown[] }
  first: boolean
  last: boolean
  touches: number
  movement: [number, number]
  velocity: [number, number]
  direction: [number, number]
  memo?: unknown
}

const gesture = vi.hoisted(() => ({ handler: undefined as undefined | ((input: GestureInput) => { ignore: boolean }) }))

vi.mock('@use-gesture/react', () => ({
  useDrag: (handler: typeof gesture.handler) => {
    gesture.handler = handler
    return () => ({})
  },
}))

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof import('react')>('react')),
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
  useRef: (current: unknown) => ({ current }),
  useEffect: () => {},
  useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, vi.fn()],
}))

vi.mock('motion/react', () => ({
  useMotionValue: (initial: number) => {
    let current = initial
    return {
      get: () => current,
      set: (next: number) => {
        current = next
      },
    }
  },
  useTransform: (input: (() => number) | { get: () => number }) => ({
    get: () => (typeof input === 'function' ? input() : input.get()),
  }),
  animate: (value: { set: (to: number) => void }, to: number, options?: { onComplete?: () => void }) => {
    value.set(to)
    options?.onComplete?.()
    return { stop: () => {} }
  },
}))

beforeEach(() => {
  vi.stubGlobal('HTMLElement', class {})
})
afterEach(() => vi.unstubAllGlobals())

function drag(touches: number, movementY: number, memo?: unknown, last = false) {
  return gesture.handler!({
    active: !last,
    axis: 'y',
    first: !memo,
    last,
    touches,
    event: { target: null, touches: Array.from({ length: touches }) },
    movement: [0, movementY],
    direction: [0, Math.sign(movementY)],
    velocity: [0, 0],
    memo,
  })
}

it('cancels an outer drag when a second finger joins and permits a fresh swipe after release', () => {
  const onDismiss = vi.fn()
  const viewer = useViewerMobileInteractions({ enabled: true, isImageZoomed: false, onDismiss })
  let memo = drag(1, 100)
  expect(viewer.dismissY.get()).toBe(100)
  memo = drag(2, 240, memo)
  expect(memo.ignore).toBe(true)
  expect(viewer.dismissY.get()).toBe(0)
  memo = drag(1, 240, memo)
  drag(0, 240, memo, true)
  expect(onDismiss).not.toHaveBeenCalled()

  memo = drag(1, 240)
  drag(0, 240, memo, true)
  expect(onDismiss).toHaveBeenCalledOnce()
})

it('does not reveal details from residual pinch movement, then accepts a fresh upward swipe', () => {
  const viewer = useViewerMobileInteractions({ enabled: true, isImageZoomed: false, onDismiss: vi.fn() })
  let memo = drag(2, -100)
  memo = drag(1, -260, memo)
  drag(0, -260, memo, true)
  expect(viewer.inspectorProgress.get()).toBe(0)

  memo = drag(1, -260)
  drag(0, -260, memo, true)
  expect(viewer.inspectorProgress.get()).toBe(1)
})

it('keeps a zoom-owned gesture ignored even when zoom state unlocks before its final event', () => {
  const onDismiss = vi.fn()
  useViewerMobileInteractions({ enabled: true, isImageZoomed: true, onDismiss })
  const memo = drag(1, 240)
  useViewerMobileInteractions({ enabled: true, isImageZoomed: false, onDismiss })
  drag(0, 240, memo, true)
  expect(onDismiss).not.toHaveBeenCalled()
})
