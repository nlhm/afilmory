export interface ViewportGeometry {
  containerWidth: number
  containerHeight: number
  imageWidth: number
  imageHeight: number
  relativeScale: number
  translateX: number
  translateY: number
}

export function projectImageViewport(previous: ViewportGeometry, next: Omit<ViewportGeometry, 'relativeScale' | 'translateX' | 'translateY'>) {
  const fit = Math.min(next.containerWidth / next.imageWidth, next.containerHeight / next.imageHeight)
  return {
    scale: previous.relativeScale * fit,
    translateX: previous.translateX * next.containerWidth / previous.containerWidth,
    translateY: previous.translateY * next.containerHeight / previous.containerHeight,
  }
}
