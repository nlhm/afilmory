import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { convertHeicWithWebCodecs } from './heic-webcodecs'
import type { HeifPhoto } from './heif'

const mocks = vi.hoisted(() => ({ parseHeif: vi.fn(), heicTo: vi.fn() }))
vi.mock('./heif', () => ({ parseHeif: mocks.parseHeif }))
vi.mock('heic-to', () => ({ heicTo: mocks.heicTo }))

const canvases: TestCanvas[] = []
const decoders: TestDecoder[] = []
const closeFrames = vi.fn()
let supportsCodec = true
let decodeError = false

class TestCanvas {
  readonly draws: number[][] = []
  readonly rotations: number[] = []

  constructor(public width: number, public height: number) {
    canvases.push(this)
  }

  getContext(_type: string, options: { colorSpace?: string }) {
    return {
      getImageData: () => ({ colorSpace: options.colorSpace }),
      drawImage: (_image: unknown, x: number, y: number) => this.draws.push([x, y]),
      translate: () => {},
      rotate: (angle: number) => this.rotations.push(angle),
    }
  }

  async convertToBlob({ type }: { type: string }) {
    return new Blob(['decoded'], { type })
  }
}

class TestChunk {
  constructor(public init: EncodedVideoChunkInit) {}
}

class TestDecoder {
  state = 'unconfigured'
  readonly timestamps: number[] = []
  config?: VideoDecoderConfig

  constructor(private handlers: VideoDecoderInit) {
    decoders.push(this)
  }

  static async isConfigSupported() {
    return { supported: supportsCodec }
  }

  configure(config: VideoDecoderConfig) {
    this.config = config
    this.state = 'configured'
  }

  decode(chunk: TestChunk) {
    this.timestamps.push(chunk.init.timestamp)
    this.handlers.output({ timestamp: chunk.init.timestamp, close: closeFrames } as unknown as VideoFrame)
  }

  async flush() {
    if (decodeError) {
      throw new Error('Decoder failed')
    }
  }

  close() {
    this.state = 'closed'
  }
}

let photo: HeifPhoto
beforeEach(() => {
  vi.clearAllMocks()
  canvases.length = decoders.length = 0
  supportsCodec = true
  decodeError = false
  const tile = {
    width: 4,
    height: 3,
    codec: 'hvc1.1.6.L93',
    description: new Uint8Array([1]),
    data: new Uint8Array([2]),
  }
  photo = {
    base: {
      width: 6,
      height: 3,
      cols: 2,
      rotation: 0,
      colorSpace: 'display-p3',
      tiles: [tile, tile],
      standalone: () => new Blob(),
    },
  }
  mocks.parseHeif.mockReturnValue(photo)
  vi.stubGlobal('VideoDecoder', TestDecoder)
  vi.stubGlobal('EncodedVideoChunk', TestChunk)
  vi.stubGlobal('OffscreenCanvas', TestCanvas)
})
afterEach(() => vi.unstubAllGlobals())

it('rejects unavailable browser APIs and unsupported HEVC so conversion can fall back', async () => {
  vi.stubGlobal('VideoDecoder', undefined)
  await expect(convertHeicWithWebCodecs(new Blob(), 'image/jpeg', 0.85)).rejects.toThrow('WebCodecs unavailable')
  vi.stubGlobal('VideoDecoder', TestDecoder)
  supportsCodec = false
  await expect(convertHeicWithWebCodecs(new Blob(), 'image/jpeg', 0.85)).rejects.toThrow('HEVC decoder unavailable')
  expect(canvases).toHaveLength(0)
  expect(decoders).toHaveLength(0)
})

it('assembles and rotates ordered HEVC tiles, then releases frames, decoder and canvases', async () => {
  photo.base.rotation = 3
  const result = await convertHeicWithWebCodecs(new Blob(), 'image/jpeg', 0.85)
  expect(result.blob.type).toBe('image/jpeg')
  expect(result.gainMap).toBeUndefined()
  expect(decoders[0].config?.hardwareAcceleration).toBe('prefer-hardware')
  expect(decoders[0].timestamps).toEqual([0, 1])
  expect(canvases[0].draws).toEqual([[0, 0], [4, 0]])
  expect(canvases[1].rotations).toEqual([-3 * Math.PI / 2])
  expect(closeFrames).toHaveBeenCalledTimes(2)
  expect(decoders[0].state).toBe('closed')
  expect(canvases.map(canvas => [canvas.width, canvas.height])).toEqual([[1, 1], [1, 1]])
})

it('releases decoder resources after hardware decoding fails', async () => {
  decodeError = true
  await expect(convertHeicWithWebCodecs(new Blob(), 'image/jpeg', 1)).rejects.toThrow('Decoder failed')
  expect(decoders[0].state).toBe('closed')
  expect([canvases[0].width, canvases[0].height]).toEqual([1, 1])
  expect(closeFrames).toHaveBeenCalledTimes(2)
})

it('keeps the SDR base usable when the optional gain map cannot be decoded', async () => {
  photo.gain = { image: photo.base, headroom: 4 }
  mocks.heicTo.mockRejectedValueOnce(new Error('Unsupported auxiliary'))
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const result = await convertHeicWithWebCodecs(new Blob(), 'image/jpeg', 1)
    expect(result.blob.size).toBeGreaterThan(0)
    expect(result.gainMap).toBeUndefined()
    expect(decoders[0].state).toBe('closed')
  }
  finally {
    warning.mockRestore()
  }
})

it('preserves Apple gain-map headroom and releases the auxiliary bitmap', async () => {
  photo.gain = { image: photo.base, headroom: 4 }
  const close = vi.fn()
  mocks.heicTo.mockResolvedValueOnce({ width: 2, height: 1, close })
  const result = await convertHeicWithWebCodecs(new Blob(), 'image/jpeg', 1)
  expect(result.gainMap?.headroom).toBe(4)
  expect(result.gainMap?.blob.type).toBe('image/png')
  expect(close).toHaveBeenCalledOnce()
  expect(canvases.map(canvas => [canvas.width, canvas.height])).toEqual([[1, 1], [1, 1]])
})
