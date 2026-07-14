export type PhotoNavigationDirection = 'backward' | 'forward' | 'unknown'

export interface PrefetchTaskHandle {
  cancel: () => void
  promise: Promise<unknown>
}

export type StartPrefetchTask = (url: string) => PrefetchTaskHandle

export function resolvePhotoNavigationDirection(
  previousIndex: number | null,
  currentIndex: number,
): PhotoNavigationDirection {
  if (previousIndex === null) {
    return 'unknown'
  }

  const delta = currentIndex - previousIndex
  if (delta === 1) {
    return 'forward'
  }
  if (delta === -1) {
    return 'backward'
  }
  return 'unknown'
}

export function getPhotoPrefetchIndices(
  currentIndex: number,
  photoCount: number,
  direction: PhotoNavigationDirection,
): number[] {
  const offsets = direction === 'forward' ? [1, 2, -1] : direction === 'backward' ? [-1, -2, 1] : [-1, 1]

  return offsets.map(offset => currentIndex + offset).filter(index => index >= 0 && index < photoCount)
}

export class PhotoPrefetchQueue {
  private readonly activeTasks = new Map<string, PrefetchTaskHandle>()
  private readonly completedTargets = new Set<string>()
  private desiredTargets = new Set<string>()
  private readonly maxConcurrent: number
  private pendingTargets: string[] = []
  private readonly startTask: StartPrefetchTask
  private stopped = false

  constructor(startTask: StartPrefetchTask, maxConcurrent = 2) {
    this.startTask = startTask
    this.maxConcurrent = Math.max(1, Math.floor(maxConcurrent))
  }

  setTargets(urls: string[], retainActiveUrls: string[] = []): void {
    if (this.stopped) {
      return
    }

    const normalizedUrls = [...new Set(urls.filter(Boolean))]
    const nextTargets = new Set(normalizedUrls)
    const retainedActiveTargets = new Set(retainActiveUrls)

    this.desiredTargets = nextTargets

    for (const completedUrl of this.completedTargets) {
      if (!nextTargets.has(completedUrl)) {
        this.completedTargets.delete(completedUrl)
      }
    }

    for (const [url, task] of this.activeTasks) {
      if (!nextTargets.has(url) && !retainedActiveTargets.has(url)) {
        task.cancel()
        this.activeTasks.delete(url)
      }
    }

    this.pendingTargets = normalizedUrls.filter(url => !this.activeTasks.has(url) && !this.completedTargets.has(url))
    this.drain()
  }

  stop(): void {
    if (this.stopped) {
      return
    }

    this.stopped = true
    this.desiredTargets.clear()
    this.pendingTargets = []
    this.completedTargets.clear()

    for (const task of this.activeTasks.values()) {
      task.cancel()
    }
    this.activeTasks.clear()
  }

  private drain(): void {
    while (!this.stopped && this.activeTasks.size < this.maxConcurrent) {
      const url = this.pendingTargets.shift()
      if (!url || !this.desiredTargets.has(url) || this.activeTasks.has(url)) {
        if (!url) {
          return
        }
        continue
      }

      const task = this.startTask(url)
      this.activeTasks.set(url, task)

      void task.promise
        .then(() => {
          if (this.desiredTargets.has(url)) {
            this.completedTargets.add(url)
          }
        })
        .catch(() => {
          // Prefetch failures are intentionally silent. Foreground loading owns user-visible errors.
        })
        .finally(() => {
          if (this.activeTasks.get(url) !== task) {
            return
          }

          this.activeTasks.delete(url)
          this.drain()
        })
    }
  }
}
