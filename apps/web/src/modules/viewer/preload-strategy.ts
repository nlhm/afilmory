export type PhotoNavigationDirection = 'previous' | 'next' | null

interface GetPhotoPreloadIndicesOptions {
  currentIndex: number
  direction: PhotoNavigationDirection
  photoCount: number
}

export function getPhotoPreloadIndices({
  currentIndex,
  direction,
  photoCount,
}: GetPhotoPreloadIndicesOptions): number[] {
  const offsets = direction === 'next' ? [1, 2, -1] : direction === 'previous' ? [-1, -2, 1] : [-1, 1]

  return offsets
    .map(offset => currentIndex + offset)
    .filter(index => index >= 0 && index < photoCount)
}
