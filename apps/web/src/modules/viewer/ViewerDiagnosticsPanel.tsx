import { useEffect, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { exportViewerDiagnostics, monitorViewerFrames, viewerDiagnostics } from '~/lib/viewer-diagnostics'

interface ViewerDiagnosticsPanelProps {
  active: boolean
  source: string
}

const EnabledViewerDiagnosticsPanel = ({ active, source }: ViewerDiagnosticsPanelProps) => {
  const { t } = useTranslation()
  const events = useSyncExternalStore(
    viewerDiagnostics.subscribe,
    viewerDiagnostics.getSnapshot,
    viewerDiagnostics.getSnapshot,
  )

  useEffect(() => {
    if (active) {
      return monitorViewerFrames(source)
    }
  }, [active, source])

  const exportReport = () => {
    const url = URL.createObjectURL(new Blob([exportViewerDiagnostics()], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `afilmory-viewer-${new Date().toISOString().replaceAll(':', '-')}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <details
      data-viewer-diagnostics="true"
      className="bg-material-medium border-accent/20 text-text fixed bottom-3 left-3 z-60 max-w-[calc(100vw-1.5rem)] rounded-xl border text-xs backdrop-blur-2xl"
    >
      <summary className="focus-visible:outline-accent cursor-pointer rounded-lg px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2">
        {t('viewer.diagnostics.title')}
        {' '}
        (
        {events.length}
        )
      </summary>
      <div className="flex max-w-sm flex-col gap-2 px-3 pb-3">
        <p className="text-text-secondary">{t('viewer.diagnostics.description')}</p>
        <button
          type="button"
          onClick={exportReport}
          className="bg-fill-secondary hover:bg-accent/10 focus-visible:outline-accent self-start rounded-md px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t('viewer.diagnostics.export')}
        </button>
        <pre
          data-viewer-diagnostics-records="true"
          className="text-text-secondary max-h-56 overflow-auto font-mono text-xs select-text"
        >
          {JSON.stringify(events.slice(-16), null, 2)}
        </pre>
      </div>
    </details>
  )
}

export const ViewerDiagnosticsPanel = (props: ViewerDiagnosticsPanelProps) =>
  viewerDiagnostics.enabled ? <EnabledViewerDiagnosticsPanel {...props} /> : null
