import { useEffect, useMemo, useRef, useState } from 'react'

import { ImageLoaderManager } from '~/lib/image-loader-manager'
import type { PhotoManifest } from '~/types/photo'

import type { PhotoNavigationDirection } from './photo-prefetch'
import { getPhotoPrefetchIndices, PhotoPrefetchQueue, resolvePhotoNavigationDirection } from './photo-prefetch'

interface PhotoPrefetchNavigationState {
  currentIndex: number | null
  direction: PhotoNavigationDirection
}

interface NavigatorWithConnection extends Navigator {
  connection?: EventTarget & {
    saveData?: boolean
  }
}

const getSaveDataPreference = () => {
  if (typeof navigator === 'undefined') {
    return false
  }
  return Boolean((navigator as NavigatorWithConnection).connection?.saveData)
}

const createPhotoPrefetchQueue = () =>
  new PhotoPrefetchQueue((url) => {
    const imageLoader = new ImageLoaderManager()
    return {
      cancel: () => imageLoader.cleanup(),
      promise: imageLoader.loadImage(url),
    }
  }, 2)

export const usePhotoPrefetch = ({
  currentImageReady,
  currentIndex,
  isOpen,
  photos,
}: {
  currentImageReady: boolean
  currentIndex: number
  isOpen: boolean
  photos: PhotoManifest[]
}) => {
  const queueRef = useRef<PhotoPrefetchQueue | null>(null)
  const [isDocumentVisible, setIsDocumentVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible')
  const [saveData, setSaveData] = useState(getSaveDataPreference)
  const [navigation, setNavigation] = useState<PhotoPrefetchNavigationState>({
    currentIndex: null,
    direction: 'unknown',
  })

  useEffect(() => {
    const queue = createPhotoPrefetchQueue()
    queueRef.current = queue

    return () => {
      queue.stop()
      if (queueRef.current === queue) {
        queueRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const connection = (navigator as NavigatorWithConnection).connection
    const handleConnectionChange = () => setSaveData(getSaveDataPreference())
    const handleVisibilityChange = () => setIsDocumentVisible(document.visibilityState === 'visible')

    document.addEventListener('visibilitychange', handleVisibilityChange)
    connection?.addEventListener('change', handleConnectionChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      connection?.removeEventListener('change', handleConnectionChange)
    }
  }, [])

  useEffect(() => {
    setNavigation((previous) => {
      if (!isOpen) {
        return previous.currentIndex === null && previous.direction === 'unknown'
          ? previous
          : { currentIndex: null, direction: 'unknown' }
      }

      if (previous.currentIndex === currentIndex) {
        return previous
      }

      return {
        currentIndex,
        direction: resolvePhotoNavigationDirection(previous.currentIndex, currentIndex),
      }
    })
  }, [currentIndex, isOpen])

  const prefetchUrls = useMemo(() => {
    return getPhotoPrefetchIndices(currentIndex, photos.length, navigation.direction)
      .map(index => photos[index]?.originalUrl)
      .filter((url): url is string => Boolean(url))
  }, [currentIndex, navigation.direction, photos])

  const currentUrl = photos[currentIndex]?.originalUrl

  useEffect(() => {
    const queue = queueRef.current
    if (!queue) {
      return
    }

    if (!isOpen || !isDocumentVisible || saveData) {
      queue.setTargets([])
      return
    }

    if (!currentImageReady) {
      queue.setTargets([], currentUrl ? [currentUrl] : [])
      return
    }

    queue.setTargets(prefetchUrls, currentUrl ? [currentUrl] : [])
  }, [currentImageReady, currentUrl, isDocumentVisible, isOpen, prefetchUrls, saveData])
}
