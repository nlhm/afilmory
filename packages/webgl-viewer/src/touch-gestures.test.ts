import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import {
  defaultAlignmentAnimation,
  defaultDoubleClickConfig,
  defaultPanningConfig,
  defaultPinchConfig,
  defaultVelocityAnimation,
  defaultWheelConfig,
} from './constants'
import { ImageViewerEngineBase } from './ImageViewerEngineBase'

let now: number
let frames: Map<number, FrameRequestCallback>
let nextFrameId: number

beforeEach(() => {
  now = 0
  frames = new Map()
  nextFrameId = 0
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrameId, callback)
    return nextFrameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

class TouchViewer extends ImageViewerEngineBase {
  readonly zoomChanged = vi.fn()

  constructor(smooth = false) {
    super({ getBoundingClientRect: () => ({ left: 0, top: 0 }) } as HTMLCanvasElement, {
      src: '',
      className: '',
      width: 2000,
      height: 1500,
      originalWidth: 6000,
      originalHeight: 4500,
      initialScale: 1,
      minScale: 0.1,
      maxScale: 10,
      wheel: defaultWheelConfig,
      pinch: defaultPinchConfig,
      doubleClick: defaultDoubleClickConfig,
      panning: defaultPanningConfig,
      alignmentAnimation: defaultAlignmentAnimation,
      velocityAnimation: defaultVelocityAnimation,
      limitToBounds: true,
      centerOnInit: true,
      smooth,
      debug: false,
      onZoomChange: () => {},
      onViewportChange: () => {},
      onImageCopied: () => {},
      onLoadingStateChange: () => {},
    })
    this.onZoomChange = this.zoomChanged
    this.imageWidth = 2000
    this.imageHeight = 1500
    this.canvasWidth = 390
    this.canvasHeight = 844
    this.imageLoaded = true
    this.fitImageToScreen()
  }

  async loadImage() {}
  protected render() {}
  protected async updateTileCache() {}

  setRelativeScale(relative: number) {
    this.scale = this.getFitToScreenScale() * relative
    this.translateX = 12
    this.translateY = 10
  }

  touch(type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel', points: number[]) {
    const event = {
      type,
      touches: points.map(clientX => ({ clientX, clientY: 400 })),
      preventDefault: vi.fn(),
    } as unknown as TouchEvent
    if (type === 'touchstart') {
      this.handleTouchStart(event)
    }
    else if (type === 'touchmove') {
      this.handleTouchMove(event)
    }
    else {
      this.handleTouchEnd(event)
    }
  }
}

it('clamps a coarse pinch below fit and releases navigation after all fingers lift', () => {
  const viewer = new TouchViewer()
  viewer.touch('touchstart', [100, 300])
  expect(viewer.zoomChanged.mock.lastCall?.[2]).toBe(true)
  viewer.touch('touchmove', [190, 210])
  expect(viewer.getViewport().relativeScale).toBe(1)
  expect(viewer.isInteracting()).toBe(true)
  viewer.touch('touchend', [])
  expect(viewer.getViewport().relativeScale).toBe(1)
  expect(viewer.getViewport().translateX).toBe(0)
  expect(viewer.zoomChanged.mock.lastCall?.[2]).toBe(false)
  expect(viewer.isInteracting()).toBe(false)
})

it('snaps a nearly fitted image to exact fit and centers it when the pinch ends', () => {
  const viewer = new TouchViewer()
  viewer.setRelativeScale(1.4)
  viewer.touch('touchstart', [100, 300])
  viewer.touch('touchmove', [125, 275])
  expect(viewer.getViewport().relativeScale).toBeCloseTo(1.05)
  viewer.touch('touchend', [])
  expect(viewer.getViewport().relativeScale).toBe(1)
  expect(viewer.getViewport().translateX).toBe(0)
  expect(viewer.getViewport().translateY).toBe(0)
})

it('keeps a deliberate detail zoom when released outside the snap zone', () => {
  const viewer = new TouchViewer()
  viewer.setRelativeScale(2)
  viewer.touch('touchstart', [100, 300])
  viewer.touch('touchmove', [125, 275])
  viewer.touch('touchend', [])
  expect(viewer.getViewport().relativeScale).toBeCloseTo(1.5)
})

it('retains pinch ownership while one finger remains and ignores its residual drag', () => {
  const viewer = new TouchViewer()
  viewer.touch('touchstart', [100, 300])
  viewer.touch('touchend', [100])
  const viewport = viewer.getViewport()
  viewer.touch('touchmove', [200])
  expect(viewer.getViewport()).toEqual(viewport)
  expect(viewer.isInteracting()).toBe(true)
  expect(viewer.zoomChanged.mock.lastCall?.[2]).toBe(true)
  viewer.touch('touchend', [])
  expect(viewer.isInteracting()).toBe(false)
  expect(viewer.zoomChanged.mock.lastCall?.[2]).toBe(false)
})

it('settles a cancelled near-fit pinch and does not interpret the next touch as a double tap', () => {
  const viewer = new TouchViewer()
  viewer.setRelativeScale(1.05)
  viewer.touch('touchstart', [100, 300])
  viewer.touch('touchcancel', [100])
  expect(viewer.getViewport().relativeScale).toBe(1)
  expect(viewer.isInteracting()).toBe(false)
  viewer.touch('touchstart', [100])
  expect(viewer.getViewport().relativeScale).toBe(1)
})

it('finishes a smooth snap exactly and lets a new gesture take over near fit', () => {
  const viewer = new TouchViewer(true)
  viewer.setRelativeScale(1.05)
  viewer.touch('touchstart', [100, 300])
  viewer.touch('touchend', [])
  expect(viewer.isInteracting()).toBe(true)
  now = 250
  for (const callback of [...frames.values()]) {
    callback(now)
  }
  frames.clear()
  expect(viewer.getViewport().relativeScale).toBe(1)
  expect(viewer.isInteracting()).toBe(false)

  viewer.setRelativeScale(1.04)
  viewer.touch('touchstart', [100, 300])
  viewer.touch('touchend', [])
  viewer.touch('touchstart', [100])
  expect(viewer.getViewport().relativeScale).toBe(1)
  expect(viewer.zoomChanged.mock.lastCall?.[2]).toBe(false)
})

it('uses original dimensions for the maximum pinch scale while displaying a preview', () => {
  const viewer = new TouchViewer()
  viewer.touch('touchstart', [190, 200])
  viewer.touch('touchmove', [0, 1000])
  expect(viewer.getScale()).toBe(1)
})

it('does not treat a swipe followed by another touch as a double tap', () => {
  const viewer = new TouchViewer()
  viewer.touch('touchstart', [100])
  expect(viewer.zoomChanged).not.toHaveBeenCalled()
  viewer.touch('touchmove', [125])
  viewer.touch('touchend', [])
  viewer.touch('touchstart', [125])
  expect(viewer.getViewport().relativeScale).toBe(1)
})

it('still zooms on two stationary taps', () => {
  const viewer = new TouchViewer()
  viewer.touch('touchstart', [100])
  viewer.touch('touchend', [])
  viewer.touch('touchstart', [100])
  expect(viewer.getViewport().relativeScale).toBeGreaterThan(1)
})

it('clears double-tap tracking when a single-finger gesture is cancelled', () => {
  const viewer = new TouchViewer()
  viewer.touch('touchstart', [100])
  viewer.touch('touchcancel', [])
  viewer.touch('touchstart', [100])
  expect(viewer.getViewport().relativeScale).toBe(1)
})
