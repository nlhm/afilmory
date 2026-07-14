import { useEffect, useMemo, useRef } from 'react'

import type { ImagePreloadTask } from '~/lib/image-loader-manager'
import { preloadImage } from '~/lib/image-loader-manager'
import type { PhotoManifest } from '~/types/photo'

import type { PhotoNavigationDirection } from './preload-strategy'
import { getPhotoPreloadIndices } from './preload-strategy'

const MAX_CONCURRENT_PRELOADS = 2

function resolveImageSrc(src: string): string {
  return src.startsWith('/') ? new URL(src, window.location.origin).toString() : src
}

class PhotoPreloadQueue {
  private activeTasks = new Map<string, ImagePreloadTask>()
  private queuedSources: string[] = []
  private stopTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false

  start() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
      this.stopTimer = null
    }
    this.stopped = false
  }

  update(sources: string[], retainedSources: string[] = []) {
    if (this.stopped) {
      return
    }

    const desiredSources = new Set([...sources, ...retainedSources])
    for (const [source, task] of this.activeTasks) {
      if (!desiredSources.has(source)) {
        task.cancel()
      }
    }

    this.queuedSources = [...new Set(sources)].filter(source => !this.activeTasks.has(source))
    this.pump()
  }

  stop() {
    this.stopped = true
    this.queuedSources = []
    if (this.stopTimer) {
      clearTimeout(this.stopTimer)
    }
    this.stopTimer = setTimeout(() => {
      for (const task of this.activeTasks.values()) {
        task.cancel()
      }
      this.stopTimer = null
    }, 0)
  }

  private pump() {
    while (
      !this.stopped
      && this.activeTasks.size < MAX_CONCURRENT_PRELOADS
      && this.queuedSources.length > 0
    ) {
      const source = this.queuedSources.shift()
      if (!source || this.activeTasks.has(source)) {
        continue
      }

      const task = preloadImage(source)
      this.activeTasks.set(source, task)
      void task.promise
        .catch((error) => {
          if (!(error instanceof Error && error.name === 'AbortError')) {
            console.warn(`Failed to preload viewer image: ${source}`, error)
          }
        })
        .finally(() => {
          if (this.activeTasks.get(source) === task) {
            this.activeTasks.delete(source)
          }
          this.pump()
        })
    }
  }
}

interface UsePhotoPreloaderOptions {
  photos: PhotoManifest[]
  currentIndex: number
  isOpen: boolean
  readyPhotoId: string | null
}

export function usePhotoPreloader({ photos, currentIndex, isOpen, readyPhotoId }: UsePhotoPreloaderOptions) {
  const queue = useMemo(() => new PhotoPreloadQueue(), [])
  const previousIndexRef = useRef<number | null>(null)
  const previousPhotoIdRef = useRef<string | null>(null)
  const directionRef = useRef<PhotoNavigationDirection>(null)

  useEffect(() => {
    queue.start()

    if (!isOpen) {
      previousIndexRef.current = null
      previousPhotoIdRef.current = null
      directionRef.current = null
      queue.update([])
      return
    }

    const currentPhoto = photos[currentIndex]
    if (!currentPhoto) {
      queue.update([])
      return
    }

    const previousIndex = previousIndexRef.current
    const previousPhotoId = previousPhotoIdRef.current

    if (previousIndex !== null && previousPhotoId !== currentPhoto.id) {
      if (currentIndex > previousIndex) {
        directionRef.current = 'next'
      }
      else if (currentIndex < previousIndex) {
        directionRef.current = 'previous'
      }
      else {
        directionRef.current = null
      }
    }

    previousIndexRef.current = currentIndex
    previousPhotoIdRef.current = currentPhoto.id

    // Wait until the current full-size resource has finished loading so
    // background work never competes with the image the user is viewing.
    if (readyPhotoId !== currentPhoto.id) {
      queue.update([], [resolveImageSrc(currentPhoto.originalUrl)])
      return
    }

    const sources = getPhotoPreloadIndices({
      currentIndex,
      direction: directionRef.current,
      photoCount: photos.length,
    }).map(index => resolveImageSrc(photos[index]!.originalUrl))

    queue.update(sources)
  }, [currentIndex, isOpen, photos, queue, readyPhotoId])

  useEffect(() => () => queue.stop(), [queue])
}
