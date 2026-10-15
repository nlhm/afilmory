export type ViewerDiagnosticStage
  = | 'load'
    | 'cache-read'
    | 'download'
    | 'format-processing'
    | 'renderer-image'
    | 'texture-prepare'
    | 'renderer-ready'
    | 'renderer-error'
    | 'promotion-wait'
    | 'original-request'
    | 'frame-gap'
    | 'long-task'
    | 'error'
    | 'cancelled'

export interface ViewerDiagnosticEvent {
  id: number
  at: number
  resource: string
  stage: ViewerDiagnosticStage
  durationMs?: number
  cache?: 'memory' | 'persistent' | 'http'
  bytes?: number
  renderer?: 'webgpu' | 'webgl'
  resourceWidth?: number
  resourceHeight?: number
  reason?: 'resolution' | 'hdr'
  resolution?: {
    requiredWidth: number
    requiredHeight: number
    previewWidth: number
    previewHeight: number
    devicePixelRatio: number
  }
}

type DiagnosticInput = Omit<ViewerDiagnosticEvent, 'id' | 'at' | 'resource'>

export class ViewerDiagnosticsStore {
  private listeners = new Set<() => void>()
  private sequence = 0
  private snapshot: readonly ViewerDiagnosticEvent[] = []

  constructor(
    readonly enabled: boolean,
    private capacity = 160,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  record(source: string, event: DiagnosticInput) {
    if (!this.enabled) {
      return
    }
    let resource = 'viewer'
    try {
      const url = new URL(source, 'https://gallery.invalid')
      resource = url.protocol === 'blob:' ? 'viewer' : url.pathname
    }
    catch {}
    this.snapshot = [
      ...this.snapshot,
      {
        ...event,
        id: ++this.sequence,
        at: Math.round(performance.now()),
        resource,
        durationMs: event.durationMs === undefined ? undefined : Math.round(event.durationMs * 10) / 10,
      },
    ].slice(-this.capacity)
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export const viewerDiagnostics = new ViewerDiagnosticsStore(
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('viewerDiagnostics') === '1',
)

export function monitorViewerFrames(source: string) {
  if (!viewerDiagnostics.enabled) {
    return () => {}
  }
  let previous = 0
  let frame: number
  const tick = (now: number) => {
    if (!document.hidden && previous && now - previous > 34) {
      viewerDiagnostics.record(source, { stage: 'frame-gap', durationMs: now - previous })
    }
    previous = document.hidden ? 0 : now
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  const resetFrameClock = () => {
    previous = 0
  }
  document.addEventListener('visibilitychange', resetFrameClock)
  let observer: PerformanceObserver | undefined
  if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!document.hidden) {
          viewerDiagnostics.record(source, { stage: 'long-task', durationMs: entry.duration })
        }
      }
    })
    observer.observe({ type: 'longtask' })
  }
  return () => {
    cancelAnimationFrame(frame)
    document.removeEventListener('visibilitychange', resetFrameClock)
    observer?.disconnect()
  }
}

export function exportViewerDiagnostics() {
  return JSON.stringify(
    {
      version: 1,
      commit: typeof GIT_COMMIT_HASH === 'undefined' ? undefined : GIT_COMMIT_HASH,
      capturedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
      hdr: window.matchMedia('(dynamic-range: high)').matches,
      longTasksSupported:
        typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask'),
      events: viewerDiagnostics.getSnapshot(),
    },
    null,
    2,
  )
}
