import type { ImageViewportState } from '@afilmory/webgl-viewer'

interface OriginalResolutionInput {
  viewport: ImageViewportState
  previewWidth: number
  previewHeight: number
  originalWidth: number
  originalHeight: number
  devicePixelRatio: number
}

export function needsOriginalResolution({
  viewport,
  previewWidth,
  previewHeight,
  originalWidth,
  originalHeight,
  devicePixelRatio,
}: OriginalResolutionInput): boolean {
  const values = [
    previewWidth,
    previewHeight,
    originalWidth,
    originalHeight,
    viewport.imageWidth,
    viewport.imageHeight,
    viewport.scale,
    devicePixelRatio,
  ]
  if (values.some(value => !Number.isFinite(value) || value <= 0)) {
    return false
  }

  const requiredWidth = viewport.imageWidth * viewport.scale * devicePixelRatio
  const requiredHeight = viewport.imageHeight * viewport.scale * devicePixelRatio
  return (
    (originalWidth > previewWidth && requiredWidth > previewWidth * 1.08)
    || (originalHeight > previewHeight && requiredHeight > previewHeight * 1.08)
  )
}
